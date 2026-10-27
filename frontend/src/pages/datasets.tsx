import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';
import { Badge, Button, Card, EmptyState, ErrorState, Field, LoadingState, Modal, PageHeader, TextArea } from '../components/ui';
import { useResource } from '../hooks/use-resource';
import { api, formatDate } from '../lib/api';
import type { Dataset, TestCase } from '../lib/types';

const datasetSchema = z.object({ name: z.string().min(2, 'Use at least two characters'), description: z.string().max(2000), tags: z.string() });
type DatasetForm = z.infer<typeof datasetSchema>;
const caseSchema = z.object({ name: z.string().min(1), input: z.string().min(1, 'Input is required'), actual_output: z.string(), expected_output: z.string().min(1, 'Expected output is required') });
type CaseForm = z.infer<typeof caseSchema>;

export function DatasetsPage() {
  const [open, setOpen] = useState(false); const navigate = useNavigate();
  const { data, loading, error, reload } = useResource(() => api<Dataset[]>('/datasets'), []);
  const form = useForm<DatasetForm>({ resolver: zodResolver(datasetSchema), defaultValues: { name:'', description:'', tags:'' } });
  const submit = form.handleSubmit(async values => { try { const created = await api<Dataset>('/datasets', { method:'POST', body:JSON.stringify({ ...values, tags: values.tags.split(',').map(v => v.trim()).filter(Boolean) }) }); toast.success('Dataset created'); setOpen(false); navigate(`/datasets/${created.id}`); } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not create dataset'); } });
  return <><PageHeader eyebrow="Test assets" title="Datasets" description="Curate stable inputs, expected behavior, and retrieval context before spending a single evaluation token." actions={<Button onClick={() => setOpen(true)}><Plus size={15}/>New dataset</Button>} />
    {loading ? <LoadingState /> : error ? <ErrorState message={error} retry={reload}/> : data?.length ? <div className="list-grid">{data.map(dataset => <Card className="entity-card" key={dataset.id}><div className="tag-row"><Badge tone="violet">{dataset.cases.length} cases</Badge>{dataset.tags.slice(0,2).map(tag => <Badge key={tag}>{tag}</Badge>)}</div><h3>{dataset.name}</h3><p>{dataset.description || 'No description yet.'}</p><footer><span>Updated {formatDate(dataset.updated_at)}</span><Link to={`/datasets/${dataset.id}`} aria-label={`Open ${dataset.name}`}><ArrowRight size={16}/></Link></footer></Card>)}</div> : <Card><EmptyState title="Build your first test set" description="Start with representative prompts and the output your system should produce." action={<Button onClick={() => setOpen(true)}>Create dataset</Button>}/></Card>}
    <Modal open={open} onOpenChange={setOpen} title="New dataset" description="Create the evaluation boundary first; add test cases next."><form className="form-stack" onSubmit={submit}><Field label="Name" {...form.register('name')} />{form.formState.errors.name && <small className="score bad">{form.formState.errors.name.message}</small>}<TextArea label="Description" {...form.register('description')} /><Field label="Tags" hint="Comma-separated, for example: rag, checkout, regression" {...form.register('tags')} /><div className="form-actions"><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={form.formState.isSubmitting}>Create dataset</Button></div></form></Modal>
  </>;
}

export function DatasetDetailPage() {
  const { id } = useParams(); const navigate = useNavigate(); const [open, setOpen] = useState(false); const [selected, setSelected] = useState<TestCase>();
  const { data, loading, error, reload } = useResource(() => api<Dataset>(`/datasets/${id}`), [id]);
  const form = useForm<CaseForm>({ resolver:zodResolver(caseSchema), defaultValues:{ name:'', input:'', actual_output:'', expected_output:'' } });
  const openCase = (item?: TestCase) => { setSelected(item); form.reset(item ? { name:item.name,input:item.input,actual_output:item.actual_output,expected_output:item.expected_output } : {name:'',input:'',actual_output:'',expected_output:''}); setOpen(true); };
  const submit = form.handleSubmit(async values => { try { const path = selected ? `/datasets/${id}/cases/${selected.id}` : `/datasets/${id}/cases`; await api(path,{method:selected?'PATCH':'POST',body:JSON.stringify({...values,context:[],retrieval_context:[],metadata_json:{}})}); toast.success(selected?'Test case updated':'Test case added'); setOpen(false); await reload(); } catch(e){ toast.error(e instanceof Error?e.message:'Could not save test case'); } });
  const removeDataset = async () => { if(!confirm('Delete this dataset? This cannot be undone.')) return; try { await api(`/datasets/${id}`,{method:'DELETE'}); toast.success('Dataset deleted'); navigate('/datasets'); } catch(e){ toast.error(e instanceof Error?e.message:'Could not delete dataset'); } };
  const removeCase = async (caseId:number) => { if(!confirm('Delete this test case?')) return; await api(`/datasets/${id}/cases/${caseId}`,{method:'DELETE'}); await reload(); };
  if(loading) return <LoadingState/>; if(error||!data) return <ErrorState message={error??'Dataset not found'} retry={reload}/>;
  return <><PageHeader eyebrow="Dataset detail" title={data.name} description={data.description || 'Add a description to explain what this dataset protects.'} actions={<Button variant="danger" onClick={removeDataset}><Trash2 size={14}/>Delete</Button>} />
    <Card><div className="card-head"><div><h2>Test cases</h2><p>{data.cases.length} curated inputs</p></div><Button onClick={() => openCase()}><Plus size={14}/>Add case</Button></div>{data.cases.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Name</th><th>Input</th><th>Expected</th><th></th></tr></thead><tbody>{data.cases.map(item => <tr key={item.id}><td><button className="button button-ghost" onClick={() => openCase(item)}>{item.name}</button></td><td>{item.input.slice(0,80)}</td><td>{item.expected_output.slice(0,80)}</td><td><button className="icon-button" onClick={() => removeCase(item.id)} aria-label="Delete case"><Trash2 size={13}/></button></td></tr>)}</tbody></table></div> : <EmptyState title="No test cases" description="Add an input, the observed output, and expected behavior to make this dataset executable." action={<Button onClick={() => openCase()}>Add first case</Button>}/>}</Card>
    <Modal open={open} onOpenChange={setOpen} title={selected?'Edit test case':'Add test case'} description="Actual output is what your system produced; expected output is the contract."><form className="form-stack" onSubmit={submit}><Field label="Name" {...form.register('name')}/><TextArea label="Input" {...form.register('input')}/><TextArea label="Actual output" {...form.register('actual_output')}/><TextArea label="Expected output" {...form.register('expected_output')}/>{Object.values(form.formState.errors)[0]?.message && <small className="score bad">{String(Object.values(form.formState.errors)[0]?.message)}</small>}<div className="form-actions"><Button variant="ghost" type="button" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={form.formState.isSubmitting}>Save case</Button></div></form></Modal>
  </>;
}
