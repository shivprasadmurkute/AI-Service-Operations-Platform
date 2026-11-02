import random
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from .models import Ticket

def seed_demo_data(db: Session, count: int = 500):
    if db.query(Ticket).count() > 0:
        return
    random.seed(42)
    categories = ["Network", "Application", "Hardware", "Access", "Database", "Email"]
    priorities = ["Critical", "High", "Medium", "Low"]
    teams = ["Infrastructure", "Application Support", "Service Desk", "Database"]
    customers = ["Northwind", "Contoso", "Fabrikam", "Adventure Works", "Globex"]
    statuses = ["Open", "In Progress", "Resolved", "Closed"]
    now = datetime.now(timezone.utc)
    rows = []
    for i in range(1, count + 1):
        created = now - timedelta(days=random.randint(0, 180), hours=random.randint(0, 23))
        priority = random.choices(priorities, weights=[8, 25, 48, 19])[0]
        target = {"Critical": 4, "High": 8, "Medium": 24, "Low": 72}[priority]
        status = random.choices(statuses, weights=[15, 20, 45, 20])[0]
        resolution = round(random.uniform(0.5, target * 1.5), 2) if status in ("Resolved", "Closed") else None
        resolved_at = created + timedelta(hours=resolution) if resolution else None
        csat = round(random.uniform(2.5, 5), 1) if resolution else None
        rows.append(Ticket(
            ticket_number=f"INC-{10000+i}",
            title=f"{random.choice(categories)} service issue #{i}",
            description="Synthetic demonstration ticket. No real customer information.",
            category=random.choice(categories),
            priority=priority,
            status=status,
            team=random.choice(teams),
            customer=random.choice(customers),
            created_at=created,
            resolved_at=resolved_at,
            sla_target_hours=target,
            resolution_hours=resolution,
            csat=csat
        ))
    db.add_all(rows)
    db.commit()
