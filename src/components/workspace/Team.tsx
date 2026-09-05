import { useCallback, useEffect, useState } from 'react';
import { supabase, ROLE_LABELS, type Role } from '@/lib/auth';
import { LoaderCircle, MoreHorizontal, Search, UsersRound } from 'lucide-react';

type Member = {
  id: string;
  user_id: string;
  role: Role;
  profiles: { full_name: string; email: string; avatar_url: string | null; status: string }[] | null;
  organizations: { name: string }[] | null;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function TeamView() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    if (!supabase) { setLoading(false); return; }
    const { data } = await supabase.from('organization_members')
      .select('id, user_id, role, profiles(full_name, email, avatar_url, status), organizations(name)')
      .order('created_at', { ascending: false });
    setMembers((data as Member[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = members.filter((m) => {
    const name = m.profiles?.[0]?.full_name || '';
    const email = m.profiles?.[0]?.email || '';
    return name.toLowerCase().includes(search.toLowerCase()) || email.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="section-view">
      <div className="page-heading">
        <div>
          <div className="eyebrow dark"><span className="eyebrow-dot" /> Workspace</div>
          <h1>Team</h1>
          <p>The people making progress happen.</p>
        </div>
      </div>

      <div className="panel section-table">
        <div className="table-toolbar">
          <div className="table-tabs"><button className="selected">All members ({members.length})</button></div>
          <div className="search-inline"><Search size={15} /><input placeholder="Search members..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        </div>

        {loading ? (
          <div className="loading-grid">
            {[0, 1, 2, 3].map((i) => <div className="skeleton-card" key={i}><div className="skeleton-line w-60" /><div className="skeleton-line w-40" /><div className="skeleton-line w-80" /></div>)}
          </div>
        ) : (
          <>
            {filtered.length === 0 && <div className="empty-inline">No team members found.</div>}
            {filtered.map((m) => (
              <div className="table-row" key={m.id}>
                {m.profiles?.[0]?.avatar_url ? (
                  <img src={m.profiles[0].avatar_url} alt="" className="member-avatar" />
                ) : (
                  <span className="member-avatar">{initials(m.profiles?.[0]?.full_name || '?')}</span>
                )}
                <div className="table-primary">
                  <strong>{m.profiles?.[0]?.full_name || 'Unknown'}</strong>
                  <span>{m.profiles?.[0]?.email || ''}{m.organizations?.[0]?.name ? ` · ${m.organizations[0].name}` : ''}</span>
                </div>
                <span className={`member-status ${(m.profiles?.[0]?.status) || 'offline'}`}>
                  <i />{(m.profiles?.[0]?.status) || 'offline'}
                </span>
                <span className="role-badge">{ROLE_LABELS[m.role] || m.role}</span>
                <MoreHorizontal size={18} />
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
