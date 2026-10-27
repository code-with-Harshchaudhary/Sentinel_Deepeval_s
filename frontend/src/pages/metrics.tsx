import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Badge, Card, EmptyState, ErrorState, LoadingState, PageHeader } from '../components/ui';
import { useResource } from '../hooks/use-resource';
import { api } from '../lib/api';
import type { Metric } from '../lib/types';

export function MetricsPage() {
  const [query,setQuery]=useState(''); const {data,loading,error,reload}=useResource(()=>api<Metric[]>('/metrics'),[]);
  const filtered=useMemo(()=>data?.filter(item => `${item.name} ${item.description}`.toLowerCase().includes(query.toLowerCase()))??[],[data,query]);
  const update=async(metric:Metric,patch:Partial<Metric>)=>{try{await api(`/metrics/${metric.key}`,{method:'PATCH',body:JSON.stringify(patch)});await reload();toast.success(`${metric.name} updated`);}catch(e){toast.error(e instanceof Error?e.message:'Update failed')}};
  return <><PageHeader eyebrow="Scoring contracts" title="Metrics" description="Every metric states what it reads, how it scores, and where a release should fail."/><div className="toolbar"><div className="search-wrap"><Search size={15}/><input placeholder="Filter metrics" value={query} onChange={e=>setQuery(e.target.value)}/></div></div>
  {loading?<LoadingState/>:error?<ErrorState message={error} retry={reload}/>:filtered.length?<Card>{filtered.map(metric=><div className="metric-row" key={metric.key}><div><div className="tag-row"><Badge tone={metric.requires_model?'violet':'neutral'}>{metric.category}</Badge>{metric.requires_model&&<Badge tone="warning">Model required</Badge>}</div><h3>{metric.name}</h3><p>{metric.description}</p></div><label className="range-wrap"><input type="range" min="0" max="1" step=".05" value={metric.threshold} onChange={e=>update(metric,{threshold:Number(e.target.value)})}/><span className="mono">{metric.threshold.toFixed(2)}</span></label><input className="switch" type="checkbox" checked={metric.enabled} onChange={e=>update(metric,{enabled:e.target.checked})} aria-label={`Enable ${metric.name}`}/></div>)}</Card>:<Card><EmptyState title="No matching metrics" description="Clear the filter to see all installed metrics."/></Card>}</>;
}
