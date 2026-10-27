import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/app-shell';
import { LoadingState } from './components/ui';

const DashboardPage = lazy(() => import('./pages/dashboard').then(m => ({ default: m.DashboardPage })));
const DatasetsPage = lazy(() => import('./pages/datasets').then(m => ({ default: m.DatasetsPage })));
const DatasetDetailPage = lazy(() => import('./pages/datasets').then(m => ({ default: m.DatasetDetailPage })));
const MetricsPage = lazy(() => import('./pages/metrics').then(m => ({ default: m.MetricsPage })));
const RunsPage = lazy(() => import('./pages/runs').then(m => ({ default: m.RunsPage })));
const RunDetailPage = lazy(() => import('./pages/runs').then(m => ({ default: m.RunDetailPage })));
const ExperimentsPage = lazy(() => import('./pages/experiments').then(m => ({ default: m.ExperimentsPage })));
const TracesPage = lazy(() => import('./pages/traces').then(m => ({ default: m.TracesPage })));
const ApiKeysPage = lazy(() => import('./pages/system').then(m => ({ default: m.ApiKeysPage })));
const SettingsPage = lazy(() => import('./pages/system').then(m => ({ default: m.SettingsPage })));
const DocsPage = lazy(() => import('./pages/system').then(m => ({ default: m.DocsPage })));

export default function App(){return <Suspense fallback={<LoadingState/>}><Routes><Route element={<AppShell/>}><Route index element={<DashboardPage/>}/><Route path="datasets" element={<DatasetsPage/>}/><Route path="datasets/:id" element={<DatasetDetailPage/>}/><Route path="metrics" element={<MetricsPage/>}/><Route path="runs" element={<RunsPage/>}/><Route path="runs/:id" element={<RunDetailPage/>}/><Route path="experiments" element={<ExperimentsPage/>}/><Route path="traces" element={<TracesPage/>}/><Route path="api-keys" element={<ApiKeysPage/>}/><Route path="settings" element={<SettingsPage/>}/><Route path="docs" element={<DocsPage/>}/><Route path="*" element={<Navigate to="/" replace/>}/></Route></Routes></Suspense>}
