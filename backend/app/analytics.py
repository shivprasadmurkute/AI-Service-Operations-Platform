from sqlalchemy.orm import Session
from sqlalchemy import func
from .models import Ticket

def get_summary(db: Session):
    total = db.query(func.count(Ticket.id)).scalar() or 0
    open_count = db.query(func.count(Ticket.id)).filter(Ticket.status.in_(["Open", "In Progress"])).scalar() or 0
    resolved = db.query(Ticket).filter(Ticket.resolution_hours.is_not(None)).all()
    resolution_values = [t.resolution_hours for t in resolved if t.resolution_hours is not None]
    csat_values = [t.csat for t in resolved if t.csat is not None]
    compliant = sum(1 for t in resolved if t.resolution_hours <= t.sla_target_hours)
    sla = (compliant / len(resolved) * 100) if resolved else 0
    avg_resolution = sum(resolution_values) / len(resolution_values) if resolution_values else 0
    avg_csat = sum(csat_values) / len(csat_values) if csat_values else 0
    return {
        "total_tickets": total,
        "open_tickets": open_count,
        "resolved_tickets": len(resolved),
        "sla_compliance_pct": round(sla, 1),
        "avg_resolution_hours": round(avg_resolution, 1),
        "avg_csat": round(avg_csat, 2)
    }

def get_insights(db: Session):
    tickets = db.query(Ticket).all()
    by_priority, by_team, by_customer = {}, {}, {}
    for t in tickets:
        by_priority[t.priority] = by_priority.get(t.priority, 0) + 1
        by_team.setdefault(t.team, {"tickets": 0, "breaches": 0})
        by_team[t.team]["tickets"] += 1
        if t.resolution_hours is not None and t.resolution_hours > t.sla_target_hours:
            by_team[t.team]["breaches"] += 1
        by_customer[t.customer] = by_customer.get(t.customer, 0) + 1
    team_performance = [
        {"team": k, "tickets": v["tickets"], "sla_breaches": v["breaches"],
         "breach_rate_pct": round(v["breaches"] / v["tickets"] * 100, 1) if v["tickets"] else 0}
        for k, v in by_team.items()
    ]
    team_performance.sort(key=lambda x: x["breach_rate_pct"], reverse=True)
    return {
        "priority_distribution": [{"priority": k, "count": v} for k, v in by_priority.items()],
        "team_performance": team_performance,
        "customer_volumes": [{"customer": k, "tickets": v} for k, v in sorted(by_customer.items(), key=lambda x: x[1], reverse=True)],
        "recommendations": build_recommendations(team_performance, by_priority)
    }

def build_recommendations(teams, priorities):
    notes = []
    if teams and teams[0]["breach_rate_pct"] >= 20:
        notes.append(f"Review workload and escalation handling for {teams[0]['team']}; it has the highest observed SLA breach rate.")
    if priorities.get("Critical", 0) + priorities.get("High", 0) > 0:
        notes.append("Review Critical and High priority queues at the start of each shift.")
    notes.append("Track recurring categories weekly and create problem-management records for repeat incidents.")
    return notes

def estimate_risk(priority: str, category: str, age_hours: float, sla_target_hours: float, status: str):
    priority_score = {"Critical": 45, "High": 30, "Medium": 15, "Low": 5}.get(priority, 15)
    category_score = {"Network": 12, "Database": 12, "Application": 8, "Access": 4}.get(category, 3)
    age_ratio = age_hours / max(sla_target_hours, 1)
    age_score = min(40, max(0, age_ratio * 30))
    status_score = 10 if status == "Open" else 4 if status == "In Progress" else 0
    score = min(100, round(priority_score + category_score + age_score + status_score))
    band = "High" if score >= 70 else "Medium" if score >= 40 else "Low"
    return {
        "risk_score": score,
        "risk_band": band,
        "explanation": f"Score combines priority ({priority_score}), category ({category_score}), ticket age ({round(age_score)}), and status ({status_score}) points. Rule-based estimate; not a trained ML prediction."
    }
