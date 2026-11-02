import { useEffect, useMemo, useState } from 'react'
import { Activity, AlertTriangle, CheckCircle2, Clock3, Headphones, RefreshCw, Search, ShieldCheck, Ticket as TicketIcon, Zap } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { createTicket, getInsights, getSummary, getTickets, predictRisk } from './api'
import type { Summary, Ticket, Insights } from './types'

const emptySummary: Summary = {total_tickets:0,open_tickets:0,resolved_tickets:0,sla_compliance_pct:0,avg_resolution_hours:0,avg_csat:0}
const emptyInsights: Insights = {priority_distribution:[],team_performance:[],customer_volumes:[],recommendations:[]}

function App() {
  const [summary, setSummary] = useState<Summary>(emptySummary)
  const [insights, setInsights] = useState<Insights>(emptyInsights)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [risk, setRisk] = useState<{risk_score:number;risk_band:string;explanation:string}|null>(null)
  const [riskForm, setRiskForm] = useState({priority:'High',category:'Network',age_hours:6,sla_target_hours:8,status:'In Progress'})

  async function load() {
    setLoading(true); setError('')
    try {
      const [s, i, t] = await Promise.all([getSummary(), getInsights(), getTickets(search)])
      setSummary(s); setInsights(i); setTickets(t)
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to connect to API') }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])
  useEffect(() => {
    const timer = window.setTimeout(() => { void getTickets(search).then(setTickets).catch(() => undefined) }, 250)
    return () => window.clearTimeout(timer)
  }, [search])

  const kpis = useMemo(() => [
    {label:'Total tickets',value:summary.total_tickets.toLocaleString(),icon:TicketIcon,sub:'All recorded incidents'},
    {label:'Open workload',value:summary.open_tickets.toLocaleString(),icon:Activity,sub:'Open + in progress'},
    {label:'SLA compliance',value:`${summary.sla_compliance_pct}%`,icon:ShieldCheck,sub:'Resolved within target'},
    {label:'Avg. resolution',value:`${summary.avg_resolution_hours}h`,icon:Clock3,sub:'Resolved tickets only'},
    {label:'Customer satisfaction',value:summary.avg_csat ? `${summary.avg_csat}/5` : '—',icon:CheckCircle2,sub:'Average CSAT score'}
  ], [summary])

  async function runRisk(e: React.FormEvent) {
    e.preventDefault()
    try { setRisk(await predictRisk(riskForm)) }
    catch (e) { setError(e instanceof Error ? e.message : 'Risk calculation failed') }
  }

  async function addDemoTicket() {
    const now = new Date()
    const ticket = {
      ticket_number: `INC-${Math.floor(900000 + Math.random()*99999)}`,
      title: 'New VPN connectivity issue', description: 'Demo ticket created from dashboard',
      category: 'Network', priority: 'High', status: 'Open', team: 'Infrastructure',
      customer: 'Northwind', created_at: now.toISOString(), sla_target_hours: 8
    }
    try { await createTicket(ticket); await load() }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not create ticket') }
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-icon"><Headphones size={21}/></div><div><b>ServiceOps</b><small>INTELLIGENCE</small></div></div>
      <div className="nav-label">WORKSPACE</div>
      <div className="nav-item active"><Activity size={17}/> Operations overview</div>
      <div className="nav-item"><TicketIcon size={17}/> Incident management</div>
      <div className="nav-item"><ShieldCheck size={17}/> SLA performance</div>
      <div className="sidebar-bottom"><div className="status-dot"/> API-powered analytics<small>Portfolio demo · Synthetic data</small></div>
    </aside>
    <main className="main">
      <header className="topbar"><div><div className="eyebrow">SERVICE MANAGEMENT / ANALYTICS</div><h1>Operations overview</h1><p>Monitor service health, incident trends and SLA performance.</p></div><button className="refresh" onClick={() => void load()}><RefreshCw size={15}/> Refresh data</button></header>
      {error && <div className="error"><AlertTriangle size={16}/>{error}</div>}
      <section className="kpi-grid">
        {kpis.map(k => <div className="kpi-card" key={k.label}><div className="kpi-top"><span>{k.label}</span><k.icon size={18}/></div><strong>{loading ? '...' : k.value}</strong><small>{k.sub}</small></div>)}
      </section>
      <section className="content-grid">
        <div className="panel chart-panel"><div className="panel-heading"><div><h2>Tickets by priority</h2><p>Current distribution across the service desk</p></div><span className="tag">LIVE DATA</span></div>
          <div className="chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={insights.priority_distribution} margin={{top:10,right:12,left:-18,bottom:0}}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#253149"/><XAxis dataKey="priority" tick={{fill:'#91a0b8',fontSize:12}} axisLine={false} tickLine={false}/><YAxis tick={{fill:'#91a0b8',fontSize:11}} axisLine={false} tickLine={false}/><Tooltip contentStyle={{background:'#111c2e',border:'1px solid #2c3a52',borderRadius:10,color:'#fff'}}/><Bar dataKey="count" fill="#6d8cff" radius={[6,6,0,0]}/></BarChart></ResponsiveContainer></div>
        </div>
        <div className="panel"><div className="panel-heading"><div><h2>Service intelligence</h2><p>Actionable operational observations</p></div><Zap size={18} className="accent"/></div>
          <div className="recommendations">{insights.recommendations.map((r,i)=><div className="recommendation" key={i}><span>{String(i+1).padStart(2,'0')}</span><p>{r}</p></div>)}</div>
        </div>
      </section>
      <section className="content-grid lower-grid">
        <div className="panel"><div className="panel-heading"><div><h2>Team SLA performance</h2><p>Share of tickets breaching SLA by team</p></div></div>
          {insights.team_performance.map(t=><div className="team-row" key={t.team}><div className="team-label"><b>{t.team}</b><span>{t.breach_rate_pct}% · {t.sla_breaches} breaches</span></div><div className="progress"><span style={{width:`${Math.min(t.breach_rate_pct,100)}%`}}/></div></div>)}
        </div>
        <div className="panel risk-panel"><div className="panel-heading"><div><h2>Ticket SLA risk estimator</h2><p>Explainable baseline scoring</p></div><AlertTriangle size={18} className="accent"/></div>
          <form onSubmit={runRisk} className="risk-form">
            <label>Priority<select value={riskForm.priority} onChange={e=>setRiskForm({...riskForm,priority:e.target.value})}><option>Critical</option><option>High</option><option>Medium</option><option>Low</option></select></label>
            <label>Category<select value={riskForm.category} onChange={e=>setRiskForm({...riskForm,category:e.target.value})}><option>Network</option><option>Database</option><option>Application</option><option>Access</option><option>Hardware</option></select></label>
            <div className="form-two"><label>Ticket age (hours)<input type="number" min="0" step="0.5" value={riskForm.age_hours} onChange={e=>setRiskForm({...riskForm,age_hours:Number(e.target.value)})}/></label><label>SLA target (hours)<input type="number" min="1" value={riskForm.sla_target_hours} onChange={e=>setRiskForm({...riskForm,sla_target_hours:Number(e.target.value)})}/></label></div>
            <label>Status<select value={riskForm.status} onChange={e=>setRiskForm({...riskForm,status:e.target.value})}><option>Open</option><option>In Progress</option></select></label>
            <button className="primary" type="submit">Estimate SLA risk</button>
          </form>
          {risk && <div className="risk-result"><div><span>RISK SCORE</span><strong>{risk.risk_score}/100</strong><b className={`risk-badge ${risk.risk_band.toLowerCase()}`}>{risk.risk_band} risk</b></div><p>{risk.explanation}</p></div>}
        </div>
      </section>
      <section className="panel tickets-panel"><div className="panel-heading"><div><h2>Recent service tickets</h2><p>Search across ticket number, title and customer</p></div><button className="secondary" onClick={() => void addDemoTicket()}>+ Add demo ticket</button></div>
        <div className="search-box"><Search size={16}/><input placeholder="Search tickets..." value={search} onChange={e=>setSearch(e.target.value)}/></div>
        <div className="table-wrap"><table><thead><tr><th>Ticket</th><th>Issue</th><th>Customer</th><th>Priority</th><th>Status</th><th>Team</th></tr></thead><tbody>
          {tickets.map(t=><tr key={t.id}><td className="ticket-id">{t.ticket_number}</td><td>{t.title}</td><td>{t.customer}</td><td><span className={`priority ${t.priority.toLowerCase()}`}>{t.priority}</span></td><td>{t.status}</td><td>{t.team}</td></tr>)}
          {!tickets.length && <tr><td colSpan={6} className="empty">No matching tickets found.</td></tr>}
        </tbody></table></div>
      </section>
      <footer>ServiceOps Intelligence <span>Built with React · FastAPI · PostgreSQL · AWS</span></footer>
    </main>
  </div>
}

export default App
