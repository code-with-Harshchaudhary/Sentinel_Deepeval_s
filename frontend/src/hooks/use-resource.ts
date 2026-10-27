import { useCallback, useEffect, useState } from 'react';

export function useResource<T>(loader: () => Promise<T>, dependencies: unknown[] = []) {
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const reload = useCallback(async () => {
    setLoading(true); setError(undefined);
    try { setData(await loader()); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Request failed'); }
    finally { setLoading(false); }
  }, dependencies); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void reload(); }, [reload]);
  return { data, loading, error, reload };
}
