import { GitCompareArrows } from 'lucide-react';
import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState, PageHeader } from '../components/ui';
import { useResource } from '../hooks/use-resource';
import { api, percent } from '../lib/api';
import type { Run } from '../lib/types';

type Comparison={metrics:string[];runs:Array<{id:number;name:string;average_score:number;pass_rate:number;metric_scores:Record<string,number>}>};
const colors=['#8b7cff','#69e6b7','#f5bf67','#ff6b81'];
export function ExperimentsPage(){
  const runs=useResource(()=>api<Run[]>('/runs?status=completed'),[]);const [selected,setSelected]=useState<number[]>([]);const [comparison,setComparison]=useState<Comparison>();const [error,setError]=useState<string>();
  const compare=async()=>{setError(undefined);try{setComparison(await api<Comparison>(`/runs/compare?ids=${selected.join(',')}`))}catch(e){setError(e instanceof Error?e.message:'Comparison failed')}};
  const chart=comparison?.metrics.map(metric=>({metric,...Object.fromEntries(comparison.runs.map(run=>[run.name,run.metric_scores[metric]??0]))}))??[];
  if(runs.loading)return <LoadingState/>;if(runs.error)return <ErrorState message={runs.error} retry={runs.reload}/>;
  return <><PageHeader eyebrow="Controlled comparison" title="Experiments" description="Compare two to four completed runs across the same scoring surface. Differences stay tied to recorded evidence." actions={<Button onClick={compare} disabled={selected.length<2}><GitCompareArrows size={14}/>Compare selected</Button>}/>
  <div className="content-grid"><Card><div className="card-head"><div><h2>Completed runs</h2><p>Select 2–4 versions</p></div><Badge tone="violet">{selected.length} selected</Badge></div>{runs.data?.length?<div className="table-wrap"><table className="data-table"><tbody>{runs.data.map(run=><tr key={run.id}><td><input type="checkbox" checked={selected.includes(run.id)} disabled={!selected.includes(run.id)&&selected.length>=4} onChange={e=>setSelected(current=>e.target.checked?[...current,run.id]:current.filter(id=>id!==run.id))}/></td><td>{run.name}</td><td className="score">{percent(run.average_score)}</td><td>{run.passed}/{run.passed+run.failed} pass</td></tr>)}</tbody></table></div>:<EmptyState title="Nothing to compare" description="Complete at least two evaluation runs first."/>}</Card>
  <Card><div className="card-head"><div><h2>Experiment summary</h2><p>Overall outcome</p></div></div>{comparison?<div className="card-body">{comparison.runs.map((run,index)=><div className="metric-row" style={{gridTemplateColumns:'1fr auto'}} key={run.id}><div><h3 style={{color:colors[index]}}>{run.name}</h3><p>Pass rate {percent(run.pass_rate)}</p></div><strong className="score">{percent(run.average_score)}</strong></div>)}</div>:<EmptyState title="Select runs" description="The comparison will calculate from persisted metric results."/>}</Card></div>
  {error&&<ErrorState message={error}/>} {comparison&&<Card className="top-gap"><div className="card-head"><div><h2>Metric comparison</h2><p>Average score by metric</p></div></div><div className="card-body chart-box"><ResponsiveContainer width="100%" height="100%"><BarChart data={chart}><CartesianGrid stroke="rgba(255,255,255,.05)" vertical={false}/><XAxis dataKey="metric" tick={{fill:'#798192',fontSize:9}} axisLine={false}/><YAxis domain={[0,1]} tick={{fill:'#798192',fontSize:9}} axisLine={false}/><Tooltip contentStyle={{background:'#0b0d11',border:'1px solid rgba(255,255,255,.1)',fontSize:10}}/><Legend wrapperStyle={{fontSize:10}}/>{comparison.runs.map((run,index)=><Bar key={run.id} dataKey={run.name} fill={colors[index]} radius={[3,3,0,0]}/>)}</BarChart></ResponsiveContainer></div></Card>}</>;
}
