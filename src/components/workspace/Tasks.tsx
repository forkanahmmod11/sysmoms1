import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { supabase, useAuth } from '@/lib/auth';
import { ClipboardCheck, LoaderCircle, MoreHorizontal, Plus, Search, X } from 'lucide-react';

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  user_id: string;
  projects: { name: string }[] | null;
};

type Project = { id: string; name: string };

const statusColors: Record<string, string> = { todo: 'blue', in_progress: 'cyan', review: 'orange', done: 'lime' };
const statusLabels: Record<string, string> = { todo: 'To do', in_progress: 'In progress', review: 'Review', done: 'Done' };
const priorities = ['low', 'medium', 'high', 'urgent'] as const;
const statuses = ['todo', 'in_progress', 'review', 'done'] as const;

export function TasksView() {
  const { profile } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'todo' | 'in_progress' | 'done'>('all');
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) { setLoading(false); return; }
    const [{ data: taskData }, { data: projData }] = await Promise.all([
      supabase.from('tasks').select('id, title, description, status, priority, due_date, user_id, projects(name)').order('created_at', { ascending: false }),
      supabase.from('projects').select('id, name').order('name'),
    ]);
    setTasks((taskData as Task[]) || []);
    setProjects((projData as Project[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    if (!supabase || !profile?.id) { setCreating(false); return; }
    const form = new FormData(e.currentTarget);
    const title = String(form.get('title') || '');
    const description = String(form.get('description') || '');
    const status = String(form.get('status') || 'todo');
    const priority = String(form.get('priority') || 'medium');
    const projectId = String(form.get('project_id') || '');
    const dueDate = String(form.get('due_date') || '');
    const { error: insertError } = await supabase.from('tasks').insert({
      title, description: description || null, status, priority,
      project_id: projectId || null, due_date: dueDate || null,
      user_id: profile.id,
    });
    if (insertError) { setError(insertError.message); setCreating(false); return; }
    setShowForm(false);
    setCreating(false);
    load();
  };

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    if (!supabase) return;
    setTasks(tasks.map((t) => t.id === taskId ? { ...t, status: newStatus } : t));
    await supabase.from('tasks').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', taskId);
    setMenuOpen(null);
  };

  const handleDelete = async (taskId: string) => {
    if (!supabase) return;
    setTasks(tasks.filter((t) => t.id !== taskId));
    await supabase.from('tasks').delete().eq('id', taskId);
    setMenuOpen(null);
  };

  const filtered = filter === 'all' ? tasks : filter === 'done' ? tasks.filter((t) => t.status === 'done') : tasks.filter((t) => t.status === filter);

  return (
    <div className="section-view">
      <div className="page-heading">
        <div>
          <div className="eyebrow dark"><span className="eyebrow-dot" /> Workspace</div>
          <h1>My tasks</h1>
          <p>Keep your momentum moving forward.</p>
        </div>
        <button className="primary-button small" onClick={() => setShowForm(!showForm)}><Plus size={17} /> New task</button>
      </div>

      {showForm && (
        <div className="panel form-panel">
          <form onSubmit={handleCreate}>
            <label className="form-field"><span>Task title</span><input name="title" placeholder="What needs to be done?" required /></label>
            <label className="form-field"><span>Description (optional)</span><textarea name="description" placeholder="Add details..." rows={3} /></label>
            <div className="form-row-grid">
              <label className="form-field"><span>Status</span>
                <select name="status" defaultValue="todo">
                  {statuses.map((s) => <option key={s} value={s}>{statusLabels[s]}</option>)}
                </select>
              </label>
              <label className="form-field"><span>Priority</span>
                <select name="priority" defaultValue="medium">
                  {priorities.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                </select>
              </label>
              <label className="form-field"><span>Project (optional)</span>
                <select name="project_id" defaultValue="">
                  <option value="">No project</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
              <label className="form-field"><span>Due date</span><input type="date" name="due_date" /></label>
            </div>
            {error && <div className="auth-error">{error}</div>}
            <div className="form-actions">
              <button type="button" className="secondary-button" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="primary-button small" disabled={creating}>{creating ? <LoaderCircle size={16} className="spin" /> : 'Create task'}</button>
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
              <button className={filter === 'in_progress' ? 'selected' : ''} onClick={() => setFilter('in_progress')}>In progress</button>
              <button className={filter === 'done' ? 'selected' : ''} onClick={() => setFilter('done')}>Completed</button>
            </div>
            <button className="filter-button"><Search size={16} /> Filter</button>
          </div>
          {filtered.length === 0 && <div className="empty-inline">No tasks here. Create one to get started.</div>}
          {filtered.map((t) => (
            <div className="table-row" key={t.id}>
              <span className={`task-check ${statusColors[t.status] || 'blue'}`} />
              <div className="table-primary">
                <strong>{t.title}</strong>
                <span>{t.projects?.[0]?.name || 'No project'}{t.due_date ? ` · Due ${new Date(t.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}</span>
              </div>
              <span className={`task-status ${statusColors[t.status] || 'blue'}`}>{statusLabels[t.status] || t.status}</span>
              <div className="row-menu-wrap">
                <button className="row-menu-btn" onClick={() => setMenuOpen(menuOpen === t.id ? null : t.id)}><MoreHorizontal size={18} /></button>
                {menuOpen === t.id && (
                  <div className="row-menu">
                    <div className="row-menu-label">Move to:</div>
                    {statuses.map((s) => <button key={s} onClick={() => handleStatusChange(t.id, s)} disabled={t.status === s}>{statusLabels[s]}</button>)}
                    <div className="row-menu-divider" />
                    <button className="danger" onClick={() => handleDelete(t.id)}>Delete task</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
