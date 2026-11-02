export type Summary = {
  total_tickets: number; open_tickets: number; resolved_tickets: number;
  sla_compliance_pct: number; avg_resolution_hours: number; avg_csat: number;
}
export type Ticket = {
  id: number; ticket_number: string; title: string; category: string;
  priority: string; status: string; team: string; customer: string;
  created_at: string; resolution_hours: number | null; csat: number | null;
  sla_target_hours: number;
}
export type Insights = {
  priority_distribution: {priority:string;count:number}[];
  team_performance: {team:string;tickets:number;sla_breaches:number;breach_rate_pct:number}[];
  customer_volumes: {customer:string;tickets:number}[];
  recommendations: string[];
}
