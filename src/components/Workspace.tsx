import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth, supabase, type UserProfile } from '@/lib/auth';
import { TasksView } from '@/components/workspace/Tasks';
import { ProjectsView } from '@/components/workspace/Projects';
import { TeamView } from '@/components/workspace/Team';
import { ScheduleView } from '@/components/workspace/Schedule';
import { MessagesView } from '@/components/workspace/Messages';
import { TransactionsView } from '@/components/workspace/Transactions';
import { SettingsView } from '@/components/workspace/Settings';
import {
  ArrowUpRight, Bell, CalendarDays, ChevronDown, CircleHelp, ClipboardCheck,
  Clock3, CreditCard, FolderKanban, LayoutDashboard, LoaderCircle, Menu,
  MessageSquare, MoreHorizontal, Plus, Search, Settings, Target, TrendingUp,
  UsersRound, X, Zap, Shield,
} from 'lucide-react';

export type View = 'overview' | 'tasks' | 'projects' | 'team' | 'schedule' | 'messages' | 'transactions' | 'settings';

type NavItem = { label: string; icon: typeof LayoutDashboard; view: View; badge?: string };

const navItems: NavItem[] = [
  { label: 'Overview', icon: LayoutDashboard, view: 'overview' },
  { label: 'My tasks', icon: ClipboardCheck, view: 'tasks' },
  { label: 'Projects', icon: FolderKanban, view: 'projects' },
  { label: 'Team', icon: UsersRound, view: 'team' },
  { label: 'Schedule', icon: CalendarDays, view: 'schedule' },
  { label: 'Messages', icon: MessageSquare, view: 'messages' },
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Workspace({ onLogout, onEnterPlatform }: { onLogout: () => void; onEnterPlatform?: () => void }) {
  const { profile } = useAuth();
  const [view, setView] = useState<View>('overview');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [taskBadge, setTaskBadge] = useState<string | undefined>();
  const [msgBadge, setMsgBadge] = useState<string | undefined>();

  const activeLabel = useMemo(() => navItems.find((item) => item.view === view)?.label || 'Overview', [view]);

  useEffect(() => {
    if (!supabase || !profile?.id) return;
    (async () => {
      const [{ count: tasks }, { count: msgs }] = await Promise.all([
        supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('user_id', profile.id).neq('status', 'done'),
        supabase.from('messages').select('id', { count: 'exact', head: true }).eq('receiver_id', profile.id).is('read_at', null),
      ]);
      if (tasks) setTaskBadge(String(tasks).padStart(2, '0'));
      if (msgs) setMsgBadge(String(msgs).padStart(2, '0'));
    })();
  }, [profile?.id, view]);

  const navWithBadges = navItems.map((item) => ({
    ...item,
    badge: item.view === 'tasks' ? taskBadge : item.view === 'messages' ? msgBadge : item.badge,
  }));

  return (
    <main className="workspace">
      <AnimatePresence>
        {mobileMenu && (
          <motion.div className="sidebar-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} onClick={() => setMobileMenu(false)} />
        )}
      </AnimatePresence>
      <aside className={`sidebar ${mobileMenu ? 'open' : ''}`}>
        <div className="sidebar-top">
          <Logo />
          <button className="close-mobile" onClick={() => setMobileMenu(false)}><X size={19} /></button>
        </div>
        <div className="workspace-switcher">
          <span className="workspace-symbol">{profile?.organization?.name?.[0] || 'S'}</span>
          <span><strong>{profile?.organization?.name || 'Sysmobyte HQ'}</strong><small>{profile?.organization?.subdomain ? `${profile.organization.subdomain}.sysmobyte.app` : 'Workspace'}</small></span>
          {onEnterPlatform ? <button className="workspace-switch-icon" onClick={onEnterPlatform} title="Back to platform admin"><Shield size={14} /></button> : <ChevronDown size={15} />}
        </div>
        <p className="nav-label">Workspace</p>
        <nav className="side-nav">
          {navWithBadges.map((item) => (
            <button key={item.view} className={view === item.view ? 'active' : ''} onClick={() => { setView(item.view); setMobileMenu(false); }}>
              <item.icon size={18} /><span>{item.label}</span>{item.badge && <b>{item.badge}</b>}
            </button>
          ))}
        </nav>
        <p className="nav-label">Manage</p>
        <nav className="side-nav">
          <button className={view === 'transactions' ? 'active' : ''} onClick={() => { setView('transactions'); setMobileMenu(false); }}>
            <CreditCard size={18} /><span>Transactions</span>
          </button>
          <button className={view === 'settings' ? 'active' : ''} onClick={() => { setView('settings'); setMobileMenu(false); }}>
            <Settings size={18} /><span>Settings</span>
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="help-box">
            <CircleHelp size={18} />
            <span><strong>Need a hand?</strong><small>Visit help center</small></span>
            <ArrowUpRight size={15} />
          </div>
          <UserCard profile={profile} onLogout={onLogout} />
        </div>
      </aside>
      <section className="workspace-main">
        <header className="workspace-header">
          <button className="mobile-menu-button" onClick={() => setMobileMenu(true)}><Menu size={21} /></button>
          <div className="breadcrumb"><span>Workspace</span><span>/</span><strong>{activeLabel}</strong></div>
          <div className="header-actions">
            <button className={`icon-button ${searchOpen ? 'selected' : ''}`} onClick={() => setSearchOpen(!searchOpen)}><Search size={19} /></button>
            <button className="icon-button notification"><Bell size={19} /><i /></button>
            <HeaderAvatar profile={profile} />
          </div>
          {searchOpen && <div className="search-popover"><Search size={17} /><input autoFocus placeholder="Search anything..." /><span>Cmd K</span></div>}
        </header>
        <div className="content-area">
          <AnimatePresence mode="wait">
            <motion.div key={view} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>
              {view === 'overview' && <Overview onView={setView} profile={profile} />}
              {view === 'tasks' && <TasksView />}
              {view === 'projects' && <ProjectsView />}
              {view === 'team' && <TeamView />}
              {view === 'schedule' && <ScheduleView />}
              {view === 'messages' && <MessagesView />}
              {view === 'transactions' && <TransactionsView />}
              {view === 'settings' && <SettingsView />}
            </motion.div>
          </AnimatePresence>
        </div>
      </section>
    </main>
  );
}

function Logo() {
  return <div className="brand"><span className="brand-mark"><span /><span /><span /></span><span>sysmo<span className="brand-accent">byte</span></span></div>;
}

function UserCard({ profile, onLogout }: { profile: UserProfile | null; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const name = profile?.fullName || 'Guest';
  const role = profile?.role || 'employee';
  return (
    <div className="user-card-wrap">
      <button className="user-card" onClick={() => setOpen(!open)}>
        {profile?.avatarUrl ? <img src={profile.avatarUrl} alt={name} className="profile-avatar img" /> : <span className="profile-avatar">{initials(name)}</span>}
        <span><strong>{name}</strong><small>{role.replace(/_/g, ' ')}</small></span>
        <MoreHorizontal size={17} />
      </button>
      {open && <div className="user-popover"><button onClick={onLogout}>Sign out</button></div>}
    </div>
  );
}

function HeaderAvatar({ profile }: { profile: UserProfile | null }) {
  const name = profile?.fullName || 'Guest';
  return profile?.avatarUrl ? <img src={profile.avatarUrl} alt={name} className="header-avatar img" /> : <div className="header-avatar">{initials(name)}</div>;
}

type TaskRow = { id: string; title: string; status: string; priority: string; due_date: string | null; profiles: { full_name: string }[] | null; projects: { name: string }[] | null };
type EventRow = { id: string; title: string; start_time: string; end_time: string | null; location: string | null };
type NoticeRow = { id: string; title: string; content: string; priority: string; created_at: string; profiles: { full_name: string }[] | null };

function Overview({ onView, profile }: { onView: (view: View) => void; profile: UserProfile | null }) {
  const [stats, setStats] = useState({ projects: 0, tasksTotal: 0, tasksDone: 0, members: 0, eventsToday: 0 });
  const [recentTasks, setRecentTasks] = useState<TaskRow[]>([]);
  const [todayEvents, setTodayEvents] = useState<EventRow[]>([]);
  const [notices, setNotices] = useState<NoticeRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!supabase) { setLoading(false); return; }
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

      const [{ count: projects }, { count: tasksTotal }, { count: tasksDone }, { count: members }, { count: eventsToday }, { data: tasks }, { data: events }, { data: noticesData }] = await Promise.all([
        supabase.from('projects').select('id', { count: 'exact', head: true }),
        supabase.from('tasks').select('id', { count: 'exact', head: true }),
        supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('status', 'done'),
        supabase.from('organization_members').select('id', { count: 'exact', head: true }),
        supabase.from('events').select('id', { count: 'exact', head: true }).gte('start_time', todayStart.toISOString()).lte('start_time', todayEnd.toISOString()),
        supabase.from('tasks').select('id, title, status, priority, due_date, profiles(full_name), projects(name)').order('created_at', { ascending: false }).limit(5),
        supabase.from('events').select('id, title, start_time, end_time, location').gte('start_time', todayStart.toISOString()).lte('start_time', todayEnd.toISOString()).order('start_time').limit(5),
        supabase.from('notices').select('id, title, content, priority, created_at, profiles(full_name)').order('created_at', { ascending: false }).limit(3),
      ]);

      setStats({ projects: projects || 0, tasksTotal: tasksTotal || 0, tasksDone: tasksDone || 0, members: members || 0, eventsToday: eventsToday || 0 });
      setRecentTasks((tasks as TaskRow[]) || []);
      setTodayEvents((events as EventRow[]) || []);
      setNotices((noticesData as NoticeRow[]) || []);
      setLoading(false);
    })();
  }, []);

  const firstName = (profile?.fullName || 'Ahmed').split(' ')[0];
  const completionRate = stats.tasksTotal > 0 ? Math.round((stats.tasksDone / stats.tasksTotal) * 100) : 0;
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  const statCards = [
    { label: 'Active projects', value: String(stats.projects), change: `${stats.projects} total`, icon: FolderKanban, tone: 'cyan' },
    { label: 'Tasks completed', value: `${completionRate}%`, change: `${stats.tasksDone}/${stats.tasksTotal} done`, icon: Target, tone: 'lime' },
    { label: 'Team members', value: String(stats.members), change: 'In workspace', icon: UsersRound, tone: 'orange' },
    { label: 'Events today', value: String(stats.eventsToday), change: stats.eventsToday > 0 ? 'Scheduled' : 'Free day', icon: Clock3, tone: 'blue' },
  ];

  const statusColors: Record<string, string> = { todo: 'blue', in_progress: 'cyan', review: 'orange', done: 'lime' };
  const statusLabels: Record<string, string> = { todo: 'To do', in_progress: 'In progress', review: 'Review', done: 'Done' };

  return (
    <div className="overview">
      <div className="page-heading">
        <div>
          <div className="eyebrow dark"><span className="eyebrow-dot" /> {today}</div>
          <h1>Good day, {firstName} <span>&#10022;</span></h1>
          <p>Here's what's happening across your workspace today.</p>
        </div>
        <button className="primary-button small" onClick={() => onView('tasks')}><Plus size={17} /> Add task</button>
      </div>

      {loading ? (
        <div className="loading-grid">
          {[0, 1, 2, 3].map((i) => <div className="skeleton-card" key={i}><div className="skeleton-line w-60" /><div className="skeleton-line w-40" /><div className="skeleton-line w-80" /></div>)}
        </div>
      ) : (
        <div className="stats-grid">
          {statCards.map((stat) => (
            <div className="stat-card" key={stat.label}>
              <div className={`stat-icon ${stat.tone}`}><stat.icon size={19} /></div>
              <div className="stat-content">
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
                <small>{stat.change}</small>
              </div>
              <MoreHorizontal size={17} className="stat-more" />
            </div>
          ))}
        </div>
      )}

      {notices.length > 0 && (
        <div className="notices-strip">
          {notices.map((n) => (
            <div className={`notice-card ${n.priority}`} key={n.id}>
              <div className="notice-icon"><Zap size={15} /></div>
              <div><strong>{n.title}</strong><span>{n.content}</span></div>
            </div>
          ))}
        </div>
      )}

      <div className="dashboard-grid">
        <section className="panel project-panel">
          <div className="panel-heading">
            <div><span className="panel-eyebrow">Portfolio pulse</span><h2>Project performance</h2></div>
            <button className="period-button">Last 30 days <ChevronDown size={14} /></button>
          </div>
          <div className="chart-wrap">
            <div className="donut-chart">
              <div><strong>{completionRate}%</strong><span>overall</span></div>
            </div>
            <div className="legend-list">
              <div><span className="legend-dot cyan" /><span>On track</span><strong>{String(stats.projects)}</strong></div>
              <div><span className="legend-dot orange" /><span>At risk</span><strong>00</strong></div>
              <div><span className="legend-dot muted" /><span>Not started</span><strong>00</strong></div>
              <div className="legend-total"><span>Total projects</span><strong>{String(stats.projects)}</strong></div>
            </div>
          </div>
          <button className="panel-link" onClick={() => onView('projects')}>View all projects <ArrowUpRight size={16} /></button>
        </section>

        <section className="panel activity-panel">
          <div className="panel-heading">
            <div><span className="panel-eyebrow">Live feed</span><h2>Recent tasks</h2></div>
            <button className="more-button"><MoreHorizontal size={18} /></button>
          </div>
          <div className="activity-list">
            {recentTasks.length === 0 && <div className="empty-inline">No tasks yet. Create one to get started.</div>}
            {recentTasks.map((t) => (
              <div className="activity-item" key={t.id}>
                <span className={`activity-avatar ${statusColors[t.status] || 'cyan'}`}>{initials(t.profiles?.[0]?.full_name || 'U')}</span>
                <p><strong>{t.profiles?.[0]?.full_name || 'Unknown'}</strong> {t.status === 'done' ? 'completed' : 'updated'} <b>{t.title}</b>
                  {t.projects?.[0]?.name && <small>{t.projects[0].name}</small>}
                </p>
                <MoreHorizontal size={16} />
              </div>
            ))}
          </div>
          <button className="panel-link" onClick={() => onView('tasks')}>View all tasks <ArrowUpRight size={16} /></button>
        </section>
      </div>

      <div className="lower-grid">
        <section className="panel tasks-panel">
          <div className="panel-heading">
            <div><span className="panel-eyebrow">Your focus</span><h2>Upcoming tasks</h2></div>
            <button className="panel-link" onClick={() => onView('tasks')}>View all <ArrowUpRight size={15} /></button>
          </div>
          <div className="task-list">
            {recentTasks.length === 0 && <div className="empty-inline">No tasks yet.</div>}
            {recentTasks.slice(0, 4).map((t) => (
              <div className="task-row" key={t.id}>
                <span className={`task-check ${statusColors[t.status] || 'blue'}`} />
                <div className="task-info"><strong>{t.title}</strong><span>{t.projects?.[0]?.name || 'No project'}</span></div>
                <span className={`task-status ${statusColors[t.status] || 'blue'}`}>{statusLabels[t.status] || t.status}</span>
                <span className="task-due">{t.due_date ? new Date(t.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No due date'}</span>
                <MoreHorizontal size={17} />
              </div>
            ))}
          </div>
        </section>

        <section className="panel agenda-panel">
          <div className="panel-heading">
            <div><span className="panel-eyebrow">Up next</span><h2>Today's agenda</h2></div>
            <button className="calendar-button"><CalendarDays size={16} /></button>
          </div>
          <div className="agenda">
            {todayEvents.length === 0 && <div className="empty-inline">No events scheduled for today.</div>}
            {todayEvents.map((e, i) => (
              <div className={`agenda-item ${i === 0 ? 'now' : ''}`} key={e.id}>
                <span className="agenda-time">{new Date(e.start_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                <div><strong>{e.title}</strong><span>{e.location || 'No location'}</span></div>
                {i === 0 && <span className="now-pill">Soon</span>}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
