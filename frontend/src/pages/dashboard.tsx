import { Activity, Database, Gauge, TestTube2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, EmptyState, ErrorState, LoadingState, PageHeader, Badge, statusTone } from '../components/ui';
import { useResource } from '../hooks/use-resource';
import { api, formatDate, percent } from '../lib/api';
import type { Dashboard as DashboardData } from '../lib/types';

export function DashboardPage() {
  const { data, loading, error, reload } = useResource(() => api<DashboardData>('/dashboard'), []);
  if (loading) return <LoadingState />;
  if (error || !data) return <ErrorState message={error ?? 'Dashboard response was empty'} retry={reload} />;
  const stats = [
    ['Datasets', data.stats.datasets, Database, 'Curated evaluation inputs'],
    ['Test cases', data.stats.test_cases, TestTube2, 'Inputs with expected behavior'],
    ['Runs', data.stats.runs, Activity, 'Recorded evaluations'],
    ['Pass rate', percent(data.stats.pass_rate), Gauge, 'Across completed test cases'],
  ] as const;
  return <>
    <PageHeader eyebrow="Evaluation overview" title="Know what changed before users do." description="A live view of evaluation health, regression movement, and the evidence behind every verdict." />
    <div className="stat-grid">{stats.map(([label, value, Icon, note]) => <Card className="stat-card" key={label}><header><span>{label}</span><Icon size={15} /></header><strong>{value}</strong><small>{note}</small></Card>)}</div>
    <div className="content-grid">
      <Card><div className="card-head"><div><h2>Quality movement</h2><p>Average score across completed runs</p></div><Badge tone="violet">Last 12</Badge></div>{data.trend.length ? <div className="card-body chart-box"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data.trend}><defs><linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8b7cff" stopOpacity={.34}/><stop offset="1" stopColor="#8b7cff" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="rgba(255,255,255,.05)" vertical={false}/><XAxis dataKey="label" hide/><YAxis domain={[0,1]} tick={{fill:'#626a7a',fontSize:9}} axisLine={false} tickLine={false}/><Tooltip contentStyle={{background:'#0b0d11',border:'1px solid rgba(255,255,255,.1)',borderRadius:8,fontSize:10}} formatter={(value) => percent(Number(value))}/><Area type="monotone" dataKey="score" stroke="#8b7cff" strokeWidth={2} fill="url(#scoreFill)"/></AreaChart></ResponsiveContainer></div> : <EmptyState title="No quality history yet" description="Create a dataset and run its first evaluation. The score trend will appear here." action={<Link to="/datasets"><span className="button button-primary">Create a dataset</span></Link>} />}</Card>
      <Card><div className="card-head"><div><h2>Recent runs</h2><p>Latest evaluation activity</p></div><Link className="muted" to="/runs">View all</Link></div>{data.recent_runs.length ? <div className="table-wrap"><table className="data-table"><tbody>{data.recent_runs.map(run => <tr key={run.id}><td><Link to={`/runs/${run.id}`}>{run.name}</Link><div className="muted">{formatDate(run.created_at)}</div></td><td><Badge tone={statusTone(run.status)}>{run.status}</Badge></td><td className={`score ${(run.average_score ?? 0) >= .7 ? 'good':'bad'}`}>{run.average_score == null ? '—' : percent(run.average_score)}</td></tr>)}</tbody></table></div> : <EmptyState title="No runs recorded" description="Evaluation runs will appear here as soon as you execute a dataset." />}</Card>
    </div>
  </>;
}
