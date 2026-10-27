export interface TestCase {
  id: number; dataset_id: number; name: string; input: string;
  actual_output: string; expected_output: string; context: string[];
  retrieval_context: string[]; metadata_json: Record<string, unknown>;
  created_at: string; updated_at: string;
}
export interface Dataset {
  id: number; name: string; description: string; tags: string[];
  created_at: string; updated_at: string; cases: TestCase[];
}
export interface Metric {
  id: number; key: string; name: string; category: string; description: string;
  threshold: number; enabled: boolean; requires_model: boolean;
}
export interface Result {
  id: number; test_case_id: number; metric_key: string; score: number;
  threshold: number; passed: boolean; reason: string; latency_ms: number;
  test_case: TestCase;
}
export interface Run {
  id: number; dataset_id: number; name: string; status: string; progress: number;
  model: string; metric_keys: string[]; passed: number; failed: number;
  average_score: number | null; duration_ms: number | null; error: string | null;
  created_at: string; updated_at: string; completed_at: string | null; results: Result[];
}
export interface Trace {
  id: number; run_id: number; test_case_id: number; name: string; status: string;
  duration_ms: number; spans: Array<Record<string, unknown>>; created_at: string;
}
export interface ApiKeyItem { id: number; name: string; prefix: string; last_used_at: string | null; created_at: string; }
export interface Dashboard {
  stats: { datasets: number; test_cases: number; runs: number; pass_rate: number };
  trend: Array<{ id: number; label: string; date: string; score: number | null; pass_rate: number }>;
  recent_runs: Run[];
}
