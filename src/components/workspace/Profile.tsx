import { useEffect, useState } from 'react';
import { CalendarDays, Camera, Mail, MessageSquare, Pencil, ShieldCheck, Target } from 'lucide-react';
import { ROLE_LABELS, supabase, useAuth } from '@/lib/auth';
import { initials } from '@/lib/initials';
import { ProfilePhotoDialog, type PhotoKind } from '@/components/workspace/ProfilePhotoDialog';

type ProfileDetails = {
  full_name: string | null;
  bio: string | null;
  skills: string[] | null;
  cover_url: string | null;
  avatar_url: string | null;
  created_at: string | null;
};

export function ProfileView({ onEdit, onMessage }: { onEdit: () => void; onMessage: () => void }) {
  const { profile } = useAuth();
  const [details, setDetails] = useState<ProfileDetails | null>(null);
  const [stats, setStats] = useState({ done: 0, open: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingPhoto, setEditingPhoto] = useState<PhotoKind | null>(null);

  useEffect(() => {
    if (!supabase || !profile?.id) { setLoading(false); return; }
    let active = true;
    (async () => {
      const [{ data, error: profileError }, { count: done }, { count: open }] = await Promise.all([
        supabase.from('profiles').select('full_name, bio, skills, cover_url, avatar_url, created_at').eq('id', profile.id).maybeSingle(),
        supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('user_id', profile.id).eq('status', 'done'),
        supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('user_id', profile.id).neq('status', 'done'),
      ]);
      if (!active) return;
      if (profileError) setError('We could not load your profile details. Please refresh to try again.');
      setDetails((data as ProfileDetails | null) ?? null);
      setStats({ done: done ?? 0, open: open ?? 0 });
      setLoading(false);
    })();
    return () => { active = false; };
  }, [profile?.id]);

  const name = details?.full_name || profile?.fullName || 'User';
  const avatarUrl = details?.avatar_url || profile?.avatarUrl || null;
  const coverUrl = details?.cover_url || null;

  const handlePhotoSaved = (kind: PhotoKind, url: string) => {
    setDetails((prev) => (prev ? { ...prev, [kind === 'avatar' ? 'avatar_url' : 'cover_url']: url } : prev));
  };
  const joined = details?.created_at
    ? new Date(details.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '—';
  const skills = details?.skills ?? [];
  const roleLabel = ROLE_LABELS[profile?.role ?? 'employee'];

  return (
    <div className="profile-page">
      <section className="profile-hero panel">
        <div className="profile-cover" style={coverUrl ? { backgroundImage: `url(${coverUrl})` } : undefined}>
          <button type="button" className="profile-cover-edit" onClick={() => setEditingPhoto('cover')}><Camera size={15} /> Change cover</button>
        </div>
        <div className="profile-identity">
          <button type="button" className="profile-hero-avatar" onClick={() => setEditingPhoto('avatar')} aria-label="Change profile photo">
            {avatarUrl ? <img src={avatarUrl} alt={name} /> : <span>{initials(name)}</span>}
            <i><Camera size={15} /></i>
          </button>
          <div className="profile-title">
            <h1>{name}</h1>
            <p>{roleLabel}{profile?.organization?.name ? ` · ${profile.organization.name}` : ''}</p>
          </div>
          <div className="profile-actions">
            <button className="secondary-profile-button" onClick={onMessage}><MessageSquare size={16} /> Message</button>
            <button className="primary-button small" onClick={onEdit}><Pencil size={15} /> Edit profile</button>
          </div>
        </div>
        <div className="profile-stats">
          <div><strong>{loading ? '—' : stats.done}</strong><span>Tasks completed</span></div>
          <div><strong>{loading ? '—' : stats.open}</strong><span>Open tasks</span></div>
          <div><strong>{joined}</strong><span>Member since</span></div>
        </div>
      </section>

      {editingPhoto && (
        <ProfilePhotoDialog
          kind={editingPhoto}
          currentUrl={editingPhoto === 'avatar' ? avatarUrl : coverUrl}
          onClose={() => setEditingPhoto(null)}
          onSaved={(url) => handlePhotoSaved(editingPhoto, url)}
        />
      )}

      {error && <div className="auth-error">{error}</div>}

      <div className="profile-grid">
        <section className="panel profile-card">
          <div className="panel-heading"><div><span className="panel-eyebrow">About</span><h2>Bio</h2></div></div>
          <p className="profile-bio">{details?.bio || 'Add a short bio in Settings so your team knows what you work on.'}</p>
        </section>

        <section className="panel profile-card">
          <div className="panel-heading"><div><span className="panel-eyebrow">Details</span><h2>Contact & access</h2></div></div>
          <div className="profile-detail-list">
            <div><Mail size={16} /><span>{profile?.email || 'No email'}</span></div>
            <div><ShieldCheck size={16} /><span>{roleLabel}</span></div>
            <div><Target size={16} /><span>{profile?.organization?.name || 'No organization'}</span></div>
            <div><CalendarDays size={16} /><span>Joined {joined}</span></div>
          </div>
        </section>

        <section className="panel profile-card profile-card-wide">
          <div className="panel-heading"><div><span className="panel-eyebrow">Expertise</span><h2>Skills</h2></div></div>
          {skills.length > 0
            ? <div className="profile-skills">{skills.map((skill) => <span key={skill}>{skill}</span>)}</div>
            : <p className="profile-bio">No skills added yet.</p>}
        </section>
      </div>
    </div>
  );
}
