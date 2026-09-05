import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { supabase } from '@/lib/auth';
import { FolderKanban, LoaderCircle, MoreHorizontal, Plus, Search } from 'lucide-react';

type Project = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  progress: number;
  organization_id: string | null;
};

const statusColors: Record<string, string> = { planning: 'blue', active: 'cyan', on_hold: 'orange', completed: 'lime' };

export function ProjectsView() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');

  const load = useCallback(async () => {
    if (!supabase) { setLoading(false); return; }
    const { data } = await supabase.from('projects').select('id, name, description, status, progress, organization_id').order('created_at', { ascending: false });
    setProjects((data as Project[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    if (!supabase) { setCreating(false); return; }
    const form = new FormData(e.currentTarget);
    const name = String(form.get('name') || '');
    const description = String(form.get('description') || '');
    const { data: userData } = await supabase.auth.getUser();
    const { data: profileData } = await supabase.from('profiles').select('organization_id').eq('id', userData.user?.id || '').maybeSingle();
    const { error: insertError } = await supabase.from('projects').insert({
      name, description: description || null,
      organization_id: (profileData as { organization_id: string | null })?.organization_id || null,
    });
    if (insertError) { setError(insertError.message); setCreating(false); return; }
    setShowForm(false);
    setCreating(false);
    load();
  };

  const filtered = filter === 'all' ? projects : filter === 'active' ? projects.filter((p) => p.status === 'active') : projects.filter((p) => p.status === 'completed');

  return (
    <div className="section-view">
      <div className="page-heading">
        <div>
          <div className="eyebrow dark"><span className="eyebrow-dot" /> Workspace</div>
          <h1>Projects</h1>
          <p>A clear view of everything in motion.</p>
        </div>
        <button className="primary-button small" onClick={() => setShowForm(!showForm)}><Plus size={17} /> New project</button>
      </div>

      {showForm && (
        <div className="panel form-panel">
          <form onSubmit={handleCreate}>
            <label className="form-field"><span>Project name</span><input name="name" placeholder="Nexus platform" required /></label>
            <label className="form-field"><span>Description (optional)</span><textarea name="description" placeholder="What is this project about?" rows={3} /></label>
            {error && <div className="auth-error">{error}</div>}
            <div className="form-actions">
              <button type="button" className="secondary-button" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="primary-button small" disabled={creating}>{creating ? <LoaderCircle size={16} className="spin" /> : 'Create'}</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="loading-grid">
          {[0, 1, 2, 3].map((i) => <div className="skeleton-card" key={i}><div className="skeleton-line w-60" /><div className="skeleton-line w-40" /><div className="skeleton-line w-80" /></div>)}
        </div>
      ) : (
        <div className="panel section-table">
          <div className="table-toolbar">
            <div className="table-tabs">
              <button className={filter === 'all' ? 'selected' : ''} onClick={() => setFilter('all')}>All</button>
              <button className={filter === 'active' ? 'selected' : ''} onClick={() => setFilter('active')}>Active</button>
              <button className={filter === 'completed' ? 'selected' : ''} onClick={() => setFilter('completed')}>Completed</button>
            </div>
            <button className="filter-button"><Search size={16} /> Filter</button>
          </div>
          {filtered.length === 0 && <div className="empty-inline">No projects yet. Create one to get started.</div>}
          {filtered.map((p) => (
            <div className="table-row" key={p.id}>
              <span className={`project-bullet ${statusColors[p.status] || 'cyan'}`} />
              <div className="table-primary">
                <strong>{p.name}</strong>
                <span>{p.description || 'No description'}</span>
              </div>
              <div className="progress-cell">
                <span><b>{p.progress}%</b> complete</span>
                <div className="progress-bar"><i style={{ width: `${p.progress}%` }} /></div>
              </div>
              <span className={`health ${p.status === 'completed' ? '' : p.status === 'active' ? '' : 'risk'}`}><i />{p.status.replace(/_/g, ' ')}</span>
              <MoreHorizontal size={18} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
