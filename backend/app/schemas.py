from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict

class TicketCreate(BaseModel):
    ticket_number: str = Field(min_length=3, max_length=32)
    title: str = Field(min_length=3, max_length=240)
    description: str = ""
    category: str = "Other"
    priority: str = "Medium"
    status: str = "Open"
    team: str = "Service Desk"
    customer: str = "Demo Customer"
    created_at: datetime
    resolved_at: datetime | None = None
    sla_target_hours: float = Field(default=24, gt=0)
    resolution_hours: float | None = Field(default=None, ge=0)
    csat: float | None = Field(default=None, ge=1, le=5)

class TicketOut(TicketCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
