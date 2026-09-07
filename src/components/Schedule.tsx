import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { supabase } from '@/lib/auth';
import { CalendarDays, LoaderCircle, Plus, X } from 'lucide-react';

type EventRow = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_time: string;
  end_time: string | null;
};

export function ScheduleView() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const load = useCallback(async () => {
    if (!supabase) { setLoading(false); return; }
    const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59);
    const { data } = await supabase.from('events')
      .select('id, title, description, location, start_time, end_time')
      .gte('start_time', monthStart.toISOString())
      .lte('start_time', monthEnd.toISOString())
      .order('start_time');
    setEvents((data as EventRow[]) || []);
    setLoading(false);
  }, [currentMonth]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    if (!supabase) { setCreating(false); return; }
    const form = new FormData(e.currentTarget);
    const title = String(form.get('title') || '');
    const description = String(form.get('description') || '');
    const location = String(form.get('location') || '');
    const startTime = String(form.get('start_time') || '');
    const endTime = String(form.get('end_time') || '');
    const { data: userData } = await supabase.auth.getUser();
    const { data: profileData } = await supabase.from('profiles').select('organization_id').eq('id', userData.user?.id || '').maybeSingle();
    const { error: insertError } = await supabase.from('events').insert({
      title, description: description || null, location: location || null,
      start_time: startTime, end_time: endTime || null,
      organization_id: (profileData as { organization_id: string | null })?.organization_id || null,
    });
    if (insertError) { setError(insertError.message); setCreating(false); return; }
    setShowForm(false);
    setCreating(false);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!supabase) return;
    setEvents(events.filter((e) => e.id !== id));
    await supabase.from('events').delete().eq('id', id);
  };

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const days: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  const eventsByDay = new Map<number, EventRow[]>();
  events.forEach((e) => {
    const day = new Date(e.start_time).getDate();
    const arr = eventsByDay.get(day) || [];
    arr.push(e);
    eventsByDay.set(day, arr);
  });

  const today = new Date();
  const isToday = (d: number) => today.getDate() === d && today.getMonth() === month && today.getFullYear() === year;

  return (
    <div className="section-view">
      <div className="page-heading">
        <div>
          <div className="eyebrow dark"><span className="eyebrow-dot" /> Workspace</div>
          <h1>Schedule</h1>
          <p>Your time, intentionally arranged.</p>
        </div>
        <button className="primary-button small" onClick={() => setShowForm(!showForm)}><Plus size={17} /> New event</button>
      </div>

      {showForm && (
        <div className="panel form-panel">
          <form onSubmit={handleCreate}>
            <label className="form-field"><span>Event title</span><input name="title" placeholder="Team sync" required /></label>
            <label className="form-field"><span>Description (optional)</span><textarea name="description" rows={2} /></label>
            <div className="form-row-grid">
              <label className="form-field"><span>Location (optional)</span><input name="location" placeholder="Room 04 / Zoom" /></label>
              <label className="form-field"><span>Start time</span><input type="datetime-local" name="start_time" required /></label>
              <label className="form-field"><span>End time (optional)</span><input type="datetime-local" name="end_time" /></label>
            </div>
            {error && <div className="auth-error">{error}</div>}
            <div className="form-actions">
              <button type="button" className="secondary-button" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="primary-button small" disabled={creating}>{creating ? <LoaderCircle size={16} className="spin" /> : 'Create event'}</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="loading-grid">
          {[0, 1, 2, 3].map((i) => <div className="skeleton-card" key={i}><div className="skeleton-line w-60" /><div className="skeleton-line w-40" /><div className="skeleton-line w-80" /></div>)}
        </div>
      ) : (
        <div className="calendar-wrap">
          <div className="calendar-header">
            <button className="calendar-nav-btn" onClick={() => setCurrentMonth(new Date(year, month - 1, 1))}>Prev</button>
            <h2>{monthName}</h2>
            <button className="calendar-nav-btn" onClick={() => setCurrentMonth(new Date(year, month + 1, 1))}>Next</button>
          </div>
          <div className="calendar-grid">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div className="calendar-dow" key={d}>{d}</div>)}
            {days.map((d, i) => (
              <div className={`calendar-day ${d && isToday(d) ? 'today' : ''} ${!d ? 'empty' : ''}`} key={i}>
                {d && <span className="day-num">{d}</span>}
                {d && eventsByDay.get(d)?.map((e) => (
                  <div className="calendar-event" key={e.id} onClick={() => handleDelete(e.id)}>
                    <span className="calendar-event-time">{new Date(e.start_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                    <span className="calendar-event-title">{e.title}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
