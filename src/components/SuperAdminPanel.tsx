import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { supabase, useAuth, ROLE_LABELS, type Role, type Organization } from '@/lib/auth';
import { getAllRequests, approveRequest, rejectRequest, type SubscriptionRequest } from '@/lib/subscription';
import {
  ArrowUpRight, Building2, Check, ChevronDown, CircleHelp, CreditCard, FileText, FolderKanban,
  Globe, LayoutDashboard, LoaderCircle, Menu, MoreHorizontal, Plus, Search, Shield,
  ShieldCheck, Sparkles, ToggleLeft, ToggleRight, UsersRound, X, Zap,
} from 'lucide-react';

type SuperView = 'overview' | 'organizations' | 'members' | 'features' | 'projects' | 'subscriptions';

type OrgRow = Organization & { created_by: string | null; created_at: string };
type MemberRow = {
  id: string;
  user_id: string;
  organization_id: string;
  role: Role;
  profiles: { full_name: string; email: string; avatar_url: string | null }[] | null;
  organizations: { name: string }[] | null;
};
type FeatureRow = { id: string; key: string; name: string; description: string | null; category: string };
type OrgFeatureRow = { feature_id: string; enabled: boolean };
type ProjectRow = {
  id: string; name: string; description: string | null; status: string;
  progress: number; organization_id: string; organizations: { name: string }[] | null;
};

const roleOrder: Role[] = ['super_admin','admin','moderator','full_stack_developer','backend_developer','frontend_developer','graphics_video_editor','marketing_specialist','hr','employee'];

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function SuperAdminPanel({ onLogout, onEnterWorkspace }: { onLogout: () => void; onEnterWorkspace: () => void }) {
  const { profile } = useAuth();
  const [view, setView] = useState<SuperView>('overview');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const navItems: { label: string; icon: typeof LayoutDashboard; view: SuperView; badge?: string }[] = [
    { label: 'Overview', icon: LayoutDashboard, view: 'overview' },
    { label: 'Organizations', icon: Building2, view: 'organizations' },
    { label: 'Members & Roles', icon: UsersRound, view: 'members' },
    { label: 'Subscriptions', icon: CreditCard, view: 'subscriptions' },
    { label: 'Features', icon: ToggleLeft, view: 'features' },
    { label: 'Projects', icon: FolderKanban, view: 'projects' },
  ];
  const activeLabel = navItems.find((item) => item.view === view)?.label || 'Overview';

  return (
    <main className="workspace super-admin">
      <aside className={`sidebar ${mobileMenu ? 'open' : ''}`}>
        <div className="sidebar-top">
          <div className="brand brand-light"><span className="brand-mark"><span /><span /><span /></span><span>sysmo<span className="brand-accent">byte</span></span></div>
          <button className="close-mobile" onClick={() => setMobileMenu(false)}><X size={19} /></button>
        </div>
        <button className="workspace-switcher super-badge switch-action" onClick={onEnterWorkspace} title="Open workspace dashboard">
          <span className="workspace-symbol"><Shield size={14} /></span>
          <span><strong>Super Admin</strong><small>Platform control center</small></span>
          <ArrowUpRight size={15} />
        </button>
        <p className="nav-label">Platform</p>
        <nav className="side-nav">
          {navItems.map((item) => (
            <button key={item.view} className={view === item.view ? 'active' : ''} onClick={() => { setView(item.view); setMobileMenu(false); }}>
              <item.icon size={18} /><span>{item.label}</span>{item.badge && <b>{item.badge}</b>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-box"><CircleHelp size={18} /><span><strong>Super admin mode</strong><small>Full platform access</small></span><ShieldCheck size={15} /></div>
          <button className="user-card" onClick={onLogout}>
            {profile?.avatarUrl ? <img src={profile.avatarUrl} alt={profile.fullName} className="profile-avatar img" /> : <span className="profile-avatar">{initials(profile?.fullName || 'Admin')}</span>}
            <span><strong>{profile?.fullName || 'Super Admin'}</strong><small>super_admin</small></span>
            <MoreHorizontal size={17} />
          </button>
        </div>
      </aside>
      <section className="workspace-main">
        <header className="workspace-header">
          <button className="mobile-menu-button" onClick={() => setMobileMenu(true)}><Menu size={21} /></button>
          <div className="breadcrumb"><span>Platform</span><span>/</span><strong>{activeLabel}</strong></div>
          <div className="header-actions">
            <button className={`icon-button ${searchOpen ? 'selected' : ''}`} onClick={() => setSearchOpen(!searchOpen)}><Search size={19} /></button>
            <button className="icon-button notification"><Shield size={19} /></button>
            <div className="header-avatar super">{profile?.avatarUrl ? <img src={profile.avatarUrl} alt="" className="header-avatar img" /> : initials(profile?.fullName || 'A')}</div>
          </div>
          {searchOpen && <div className="search-popover"><Search size={17} /><input autoFocus placeholder="Search organizations, members..." /><span>⌘ K</span></div>}
        </header>
        <div className="content-area">
          {view === 'overview' && <SuperOverview onNavigate={setView} />}
          {view === 'organizations' && <OrganizationsView />}
          {view === 'members' && <MembersView />}
          {view === 'subscriptions' && <SubscriptionsView />}
          {view === 'features' && <FeaturesView />}
          {view === 'projects' && <ProjectsView />}
        </div>
      </section>
    </main>
  );
}

function SuperOverview({ onNavigate }: { onNavigate: (view: SuperView) => void }) {
  const [stats, setStats] = useState({ orgs: 0, members: 0, features: 0, projects: 0 });
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!supabase) { setLoading(false); return; }
      const [{ data: orgData }, { count: memberCount }, { count: featureCount }, { count: projectCount }] = await Promise.all([
        supabase.from('organizations').select('*').order('created_at', { ascending: false }).limit(5),
        supabase.from('organization_members').select('id', { count: 'exact', head: true }),
        supabase.from('features').select('id', { count: 'exact', head: true }),
        supabase.from('projects').select('id', { count: 'exact', head: true }),
      ]);
      setOrgs((orgData as OrgRow[]) || []);
      setStats({ orgs: orgData?.length || 0, members: memberCount || 0, features: featureCount || 0, projects: projectCount || 0 });
      setLoading(false);
    })();
  }, []);

  const statCards = [
    { label: 'Organizations', value: stats.orgs, change: 'All active', icon: Building2, tone: 'cyan' },
    { label: 'Total members', value: stats.members, change: 'Across all orgs', icon: UsersRound, tone: 'lime' },
    { label: 'Features available', value: stats.features, change: 'Toggle per org', icon: ToggleLeft, tone: 'orange' },
    { label: 'Total projects', value: stats.projects, change: 'Platform-wide', icon: FolderKanban, tone: 'blue' },
  ];

  return (
    <div className="overview">
      <div className="page-heading">
        <div>
          <div className="eyebrow dark"><span className="eyebrow-dot" /> Platform control center</div>
          <h1>Super Admin Dashboard <span>✦</span></h1>
          <p>Manage organizations, admins, roles, and platform features from one place.</p>
        </div>
        <button className="primary-button small" onClick={() => onNavigate('organizations')}><Plus size={17} /> Add organization</button>
      </div>
      {loading ? <LoadingGrid /> : (
        <div className="stats-grid">
          {statCards.map((stat) => (
            <div className="stat-card" key={stat.label}>
              <div className={`stat-icon ${stat.tone}`}><stat.icon size={19} /></div>
              <div className="stat-content"><span>{stat.label}</span><strong>{stat.value}</strong><small>{stat.change}</small></div>
              <MoreHorizontal size={17} className="stat-more" />
            </div>
          ))}
        </div>
      )}
      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-heading">
            <div><span className="panel-eyebrow">Recent</span><h2>Organizations</h2></div>
            <button className="panel-link" onClick={() => onNavigate('organizations')}>View all <ArrowUpRight size={15} /></button>
          </div>
          <div className="org-list">
            {orgs.length === 0 && <div className="empty-inline">No organizations yet. Create one to get started.</div>}
            {orgs.map((org) => (
              <div className="org-row" key={org.id}>
                <span className="org-symbol">{org.name[0]}</span>
                <div className="org-info"><strong>{org.name}</strong><span>{org.subdomain ? `${org.subdomain}.sysmobyte.app` : 'No subdomain'}</span></div>
                <span className={`org-status ${org.status}`}>{org.status}</span>
                <MoreHorizontal size={17} />
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div><span className="panel-eyebrow">Quick actions</span><h2>Manage</h2></div>
          </div>
          <div className="quick-actions">
            <button className="quick-action" onClick={() => onNavigate('organizations')}><Building2 size={18} /><span>Add organization</span><ArrowUpRight size={15} /></button>
            <button className="quick-action" onClick={() => onNavigate('members')}><UsersRound size={18} /><span>Assign admin to org</span><ArrowUpRight size={15} /></button>
            <button className="quick-action" onClick={() => onNavigate('features')}><ToggleLeft size={18} /><span>Toggle OMS features</span><ArrowUpRight size={15} /></button>
            <button className="quick-action" onClick={() => onNavigate('projects')}><FolderKanban size={18} /><span>Manage project groups</span><ArrowUpRight size={15} /></button>
          </div>
        </section>
      </div>
    </div>
  );
}

function OrganizationsView() {
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) { setLoading(false); return; }
    const { data } = await supabase.from('organizations').select('*').order('created_at', { ascending: false });
    setOrgs((data as OrgRow[]) || []);
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
    const subdomain = String(form.get('subdomain') || '');
    const { data: userData } = await supabase.auth.getUser();
    const { error: insertError } = await supabase.from('organizations').insert({ name, subdomain: subdomain || null, created_by: userData.user?.id });
    if (insertError) { setError(insertError.message); setCreating(false); return; }
    setShowForm(false);
    setCreating(false);
    load();
  };

  return (
    <div className="section-view">
      <div className="page-heading">
        <div>
          <div className="eyebrow dark"><span className="eyebrow-dot" /> Platform</div>
          <h1>Organizations</h1>
          <p>Each organization is an isolated workspace on its own subdomain.</p>
        </div>
        <button className="primary-button small" onClick={() => setShowForm(!showForm)}><Plus size={17} /> New organization</button>
      </div>
      {showForm && (
        <div className="panel form-panel">
          <form onSubmit={handleCreate}>
            <label className="form-field"><span>Organization name</span><input name="name" placeholder="Acme Corp" required /></label>
            <label className="form-field"><span>Subdomain (optional)</span><input name="subdomain" placeholder="acme" /></label>
            {error && <div className="auth-error">{error}</div>}
            <div className="form-actions">
              <button type="button" className="secondary-button" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="primary-button small" disabled={creating}>{creating ? <LoaderCircle size={16} className="spin" /> : 'Create'}</button>
            </div>
          </form>
        </div>
      )}
      {loading ? <LoadingGrid /> : (
        <div className="panel section-table">
          <div className="table-toolbar">
            <div className="table-tabs"><button className="selected">All</button><button>Active</button><button>Suspended</button></div>
          </div>
          {orgs.length === 0 && <div className="empty-inline">No organizations yet.</div>}
          {orgs.map((org) => (
            <div className="table-row" key={org.id}>
              <span className="project-bullet cyan" />
              <div className="table-primary"><strong>{org.name}</strong><span>{org.subdomain ? `${org.subdomain}.sysmobyte.app` : 'No subdomain'}</span></div>
              <span className={`org-status ${org.status}`}>{org.status}</span>
              <MoreHorizontal size={18} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MembersView() {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [profiles, setProfiles] = useState<{ id: string; full_name: string; email: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) { setLoading(false); return; }
    const [{ data: memberData }, { data: orgData }, { data: profileData }] = await Promise.all([
      supabase.from('organization_members').select('id, user_id, organization_id, role, profiles(full_name, email, avatar_url), organizations(name)').order('created_at', { ascending: false }),
      supabase.from('organizations').select('*').order('name'),
      supabase.from('profiles').select('id, full_name, email').order('full_name'),
    ]);
    setMembers((memberData as MemberRow[]) || []);
    setOrgs((orgData as OrgRow[]) || []);
    setProfiles((profileData as { id: string; full_name: string; email: string }[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!supabase) return;
    const form = new FormData(e.currentTarget);
    const userId = String(form.get('user_id') || '');
    const orgId = String(form.get('org_id') || '');
    const role = String(form.get('role') || 'employee') as Role;
    const { error: insertError } = await supabase.from('organization_members').insert({ user_id: userId, organization_id: orgId, role });
    if (insertError) { setError(insertError.message); return; }
    if (role === 'admin') {
      await supabase.from('profiles').update({ organization_id: orgId, role: 'admin' }).eq('id', userId);
    }
    setShowForm(false);
    load();
  };

  const handleRoleChange = async (memberId: string, newRole: Role) => {
    if (!supabase) return;
    await supabase.from('organization_members').update({ role: newRole }).eq('id', memberId);
    load();
  };

  return (
    <div className="section-view">
      <div className="page-heading">
        <div>
          <div className="eyebrow dark"><span className="eyebrow-dot" /> Platform</div>
          <h1>Members & Roles</h1>
          <p>Assign users to organizations and control their roles (RBAC).</p>
        </div>
        <button className="primary-button small" onClick={() => setShowForm(!showForm)}><Plus size={17} /> Add member</button>
      </div>
      {showForm && (
        <div className="panel form-panel">
          <form onSubmit={handleAdd}>
            <label className="form-field"><span>User</span>
              <select name="user_id" required>
                <option value="">Select a user...</option>
                {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name} ({p.email})</option>)}
              </select>
            </label>
            <label className="form-field"><span>Organization</span>
              <select name="org_id" required>
                <option value="">Select an organization...</option>
                {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </label>
            <label className="form-field"><span>Role</span>
              <select name="role" defaultValue="employee">
                {roleOrder.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </label>
            {error && <div className="auth-error">{error}</div>}
            <div className="form-actions">
              <button type="button" className="secondary-button" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="primary-button small">Add</button>
            </div>
          </form>
        </div>
      )}
      {loading ? <LoadingGrid /> : (
        <div className="panel section-table">
          <div className="table-toolbar"><div className="table-tabs"><button className="selected">All members</button></div></div>
          {members.length === 0 && <div className="empty-inline">No members assigned yet.</div>}
          {members.map((m) => (
            <div className="table-row" key={m.id}>
              {m.profiles?.[0]?.avatar_url ? <img src={m.profiles[0].avatar_url} alt="" className="member-avatar" /> : <span className="member-avatar">{initials(m.profiles?.[0]?.full_name || '?')}</span>}
              <div className="table-primary"><strong>{m.profiles?.[0]?.full_name || 'Unknown'}</strong><span>{m.profiles?.[0]?.email || ''} · {m.organizations?.[0]?.name || ''}</span></div>
              <select className="role-select" value={m.role} onChange={(e) => handleRoleChange(m.id, e.target.value as Role)}>
                {roleOrder.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
              <MoreHorizontal size={18} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FeaturesView() {
  const [features, setFeatures] = useState<FeatureRow[]>([]);
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<string>('');
  const [orgFeatures, setOrgFeatures] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!supabase) { setLoading(false); return; }
      const [{ data: featData }, { data: orgData }] = await Promise.all([
        supabase.from('features').select('*').order('category'),
        supabase.from('organizations').select('*').order('name'),
      ]);
      setFeatures((featData as FeatureRow[]) || []);
      setOrgs((orgData as OrgRow[]) || []);
      if ((orgData as OrgRow[])?.length > 0) setSelectedOrg((orgData as OrgRow[])[0].id);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!supabase || !selectedOrg) return;
      const { data } = await supabase.from('organization_features').select('feature_id, enabled').eq('organization_id', selectedOrg);
      const map: Record<string, boolean> = {};
      (data as OrgFeatureRow[] | null)?.forEach((f) => { map[f.feature_id] = f.enabled; });
      setOrgFeatures(map);
    })();
  }, [selectedOrg]);

  const toggleFeature = async (featureId: string, enabled: boolean) => {
    if (!supabase || !selectedOrg) return;
    setOrgFeatures({ ...orgFeatures, [featureId]: enabled });
    await supabase.from('organization_features').upsert({ organization_id: selectedOrg, feature_id: featureId, enabled }, { onConflict: 'organization_id,feature_id' });
  };

  return (
    <div className="section-view">
      <div className="page-heading">
        <div>
          <div className="eyebrow dark"><span className="eyebrow-dot" /> Platform</div>
          <h1>Feature Control</h1>
          <p>Toggle OMS features on or off for each organization.</p>
        </div>
        {orgs.length > 0 && (
          <select className="org-select" value={selectedOrg} onChange={(e) => setSelectedOrg(e.target.value)}>
            {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        )}
      </div>
      {loading ? <LoadingGrid /> : (
        <div className="feature-toggle-grid">
          {features.map((f) => {
            const enabled = orgFeatures[f.id] ?? true;
            return (
              <div className="panel feature-toggle-card" key={f.id}>
                <div className="feature-toggle-info">
                  <div className="feature-toggle-icon"><Sparkles size={17} /></div>
                  <div><strong>{f.name}</strong><span>{f.description}</span><small>{f.category}</small></div>
                </div>
                <button className={`toggle-switch ${enabled ? 'on' : ''}`} onClick={() => toggleFeature(f.id, !enabled)}>
                  {enabled ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ProjectsView() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!supabase) { setLoading(false); return; }
      const { data } = await supabase.from('projects').select('id, name, description, status, progress, organization_id, organizations(name)').order('created_at', { ascending: false });
      setProjects((data as ProjectRow[]) || []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="section-view">
      <div className="page-heading">
        <div>
          <div className="eyebrow dark"><span className="eyebrow-dot" /> Platform</div>
          <h1>Projects</h1>
          <p>View and control all projects across every organization.</p>
        </div>
      </div>
      {loading ? <LoadingGrid /> : (
        <div className="panel section-table">
          <div className="table-toolbar"><div className="table-tabs"><button className="selected">All projects</button></div></div>
          {projects.length === 0 && <div className="empty-inline">No projects yet.</div>}
          {projects.map((p) => (
            <div className="table-row" key={p.id}>
              <span className="project-bullet lime" />
              <div className="table-primary"><strong>{p.name}</strong><span>{p.organizations?.[0]?.name || ''}</span></div>
              <div className="progress-cell"><span><b>{p.progress}%</b> complete</span><div className="progress-bar"><i style={{ width: `${p.progress}%` }} /></div></div>
              <span className={`health ${p.status === 'active' ? '' : 'risk'}`}><i />{p.status}</span>
              <MoreHorizontal size={18} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SubscriptionsView() {
  const [requests, setRequests] = useState<SubscriptionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [selectedReq, setSelectedReq] = useState<SubscriptionRequest | null>(null);
  const [rejectNotes, setRejectNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const { user } = useAuth();

  const load = useCallback(async () => {
    const data = await getAllRequests();
    setRequests(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (reqId: string) => {
    setActionLoading(true);
    await approveRequest(reqId, user?.id || '');
    setActionLoading(false);
    setSelectedReq(null);
    load();
  };

  const handleReject = async (reqId: string) => {
    setActionLoading(true);
    await rejectRequest(reqId, user?.id || '', rejectNotes || 'Request rejected by admin.');
    setActionLoading(false);
    setSelectedReq(null);
    setRejectNotes('');
    load();
  };

  const filtered = filter === 'all' ? requests : requests.filter((r) => r.status === filter);
  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  return (
    <div className="section-view">
      <div className="page-heading">
        <div>
          <div className="eyebrow dark"><span className="eyebrow-dot" /> Platform</div>
          <h1>Subscription Requests</h1>
          <p>Review and approve user workspace access requests. Approving creates an isolated OMS workspace for the user.</p>
        </div>
        {pendingCount > 0 && <span className="badge-pill">{pendingCount} pending</span>}
      </div>
      {loading ? <LoadingGrid /> : (
        <>
          <div className="panel section-table">
            <div className="table-toolbar">
              <div className="table-tabs">
                <button className={filter === 'pending' ? 'selected' : ''} onClick={() => setFilter('pending')}>Pending ({requests.filter((r) => r.status === 'pending').length})</button>
                <button className={filter === 'approved' ? 'selected' : ''} onClick={() => setFilter('approved')}>Approved</button>
                <button className={filter === 'rejected' ? 'selected' : ''} onClick={() => setFilter('rejected')}>Rejected</button>
                <button className={filter === 'all' ? 'selected' : ''} onClick={() => setFilter('all')}>All</button>
              </div>
            </div>
            {filtered.length === 0 && <div className="empty-inline">No {filter} requests.</div>}
            {filtered.map((req) => (
              <div className="table-row subscription-row" key={req.id}>
                <span className={`project-bullet ${req.status === 'pending' ? 'orange' : req.status === 'approved' ? 'lime' : 'red'}`} />
                <div className="table-primary">
                  <strong>{req.user_name || req.user_email}</strong>
                  <span>{req.plan_name} · {req.organization_name}</span>
                </div>
                <span className="sub-date">{new Date(req.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                <span className={`status-badge ${req.status}`}>{req.status}</span>
                {req.status === 'pending' ? (
                  <button className="primary-button small" onClick={() => setSelectedReq(req)}>Review</button>
                ) : (
                  <button className="text-button" onClick={() => setSelectedReq(req)}>View</button>
                )}
              </div>
            ))}
          </div>
          {selectedReq && (
            <div className="modal-backdrop" onClick={() => setSelectedReq(null)}>
              <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h2>Subscription Request</h2>
                  <button className="close-button" onClick={() => setSelectedReq(null)}><X size={18} /></button>
                </div>
                <div className="modal-body">
                  <div className="detail-grid">
                    <div className="detail-item"><span>User</span><strong>{selectedReq.user_name}</strong></div>
                    <div className="detail-item"><span>Email</span><strong>{selectedReq.user_email}</strong></div>
                    <div className="detail-item"><span>Plan</span><strong>{selectedReq.plan_name}</strong></div>
                    <div className="detail-item"><span>Organization</span><strong>{selectedReq.organization_name}</strong></div>
                    <div className="detail-item"><span>Submitted</span><strong>{new Date(selectedReq.submitted_at).toLocaleString()}</strong></div>
                    <div className="detail-item"><span>Status</span><strong className={`status-badge ${selectedReq.status}`}>{selectedReq.status}</strong></div>
                  </div>
                  {selectedReq.document_urls.length > 0 && (
                    <div className="detail-section">
                      <h3><FileText size={16} /> Documents</h3>
                      <div className="file-list">
                        {selectedReq.document_urls.map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="file-link">
                            <FileText size={15} /> Document {i + 1}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedReq.screenshot_urls.length > 0 && (
                    <div className="detail-section">
                      <h3>Screenshots</h3>
                      <div className="screenshot-grid">
                        {selectedReq.screenshot_urls.map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="screenshot-thumb">
                            <img src={url} alt={`Screenshot ${i + 1}`} />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedReq.status === 'pending' && (
                    <div className="detail-section">
                      <h3>Reject reason (optional)</h3>
                      <textarea
                        className="reject-notes"
                        placeholder="Reason for rejection..."
                        value={rejectNotes}
                        onChange={(e) => setRejectNotes(e.target.value)}
                        rows={3}
                      />
                    </div>
                  )}
                  {selectedReq.admin_notes && selectedReq.status !== 'pending' && (
                    <div className="detail-section">
                      <h3>Admin notes</h3>
                      <p>{selectedReq.admin_notes}</p>
                    </div>
                  )}
                </div>
                {selectedReq.status === 'pending' && (
                  <div className="modal-footer">
                    <button className="secondary-button" onClick={() => handleReject(selectedReq.id)} disabled={actionLoading}>
                      {actionLoading ? <LoaderCircle size={16} className="spin" /> : <X size={16} />} Reject
                    </button>
                    <button className="primary-button" onClick={() => handleApprove(selectedReq.id)} disabled={actionLoading}>
                      {actionLoading ? <LoaderCircle size={16} className="spin" /> : <Check size={16} />} Approve & Create Workspace
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function LoadingGrid() {
  return (
    <div className="loading-grid">
      {[0, 1, 2, 3].map((i) => <div className="skeleton-card" key={i}><div className="skeleton-line w-60" /><div className="skeleton-line w-40" /><div className="skeleton-line w-80" /></div>)}
    </div>
  );
}
