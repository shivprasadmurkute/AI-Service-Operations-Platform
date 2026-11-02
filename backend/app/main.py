import os
from datetime import datetime, timezone
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import or_
from .database import Base, engine, get_db
from .models import Ticket
from .schemas import TicketCreate, TicketOut
from .seed import seed_demo_data
from .analytics import get_summary, get_insights, estimate_risk

app = FastAPI(title="IT Service Operations Intelligence API", version="1.0.0")

origins = [x.strip() for x in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if x.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)
    if os.getenv("SEED_DEMO_DATA", "true").lower() == "true":
        from .database import SessionLocal
        db = SessionLocal()
        try:
            seed_demo_data(db)
        finally:
            db.close()

@app.get("/health")
def health():
    return {"status": "ok", "service": "service-operations-api"}

@app.get("/api/v1/summary")
def summary(db: Session = Depends(get_db)):
    return get_summary(db)

@app.get("/api/v1/insights")
def insights(db: Session = Depends(get_db)):
    return get_insights(db)

@app.get("/api/v1/tickets", response_model=list[TicketOut])
def tickets(
    limit: int = Query(100, ge=1, le=500),
    status: str | None = None,
    priority: str | None = None,
    search: str | None = None,
    db: Session = Depends(get_db)
):
    query = db.query(Ticket)
    if status:
        query = query.filter(Ticket.status == status)
    if priority:
        query = query.filter(Ticket.priority == priority)
    if search:
        term = f"%{search}%"
        query = query.filter(or_(Ticket.ticket_number.ilike(term), Ticket.title.ilike(term), Ticket.customer.ilike(term)))
    return query.order_by(Ticket.created_at.desc()).limit(limit).all()

@app.post("/api/v1/tickets", response_model=TicketOut, status_code=201)
def create_ticket(payload: TicketCreate, db: Session = Depends(get_db)):
    if db.query(Ticket).filter(Ticket.ticket_number == payload.ticket_number).first():
        raise HTTPException(status_code=409, detail="Ticket number already exists")
    ticket = Ticket(**payload.model_dump())
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return ticket

@app.post("/api/v1/predict-risk")
def predict_risk(payload: dict):
    required = ["priority", "category", "age_hours", "sla_target_hours", "status"]
    missing = [key for key in required if key not in payload]
    if missing:
        raise HTTPException(status_code=422, detail=f"Missing fields: {', '.join(missing)}")
    try:
        age = float(payload["age_hours"])
        target = float(payload["sla_target_hours"])
        if age < 0 or target <= 0:
            raise ValueError()
    except (TypeError, ValueError):
        raise HTTPException(status_code=422, detail="age_hours must be >= 0 and sla_target_hours must be > 0")
    return estimate_risk(str(payload["priority"]), str(payload["category"]), age, target, str(payload["status"]))
