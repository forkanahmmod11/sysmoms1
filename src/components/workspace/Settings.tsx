import { useEffect, useState, type FormEvent } from 'react';
import { supabase, useAuth, ROLE_LABELS, type Role } from '@/lib/auth';
import { Check, LoaderCircle } from 'lucide-react';

export function SettingsView() {
  const { profile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState(profile?.fullName || '');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatarUrl || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase || !profile?.id) return;
    (async () => {
      const { data } = await supabase.from('profiles').select('full_name, bio, avatar_url').eq('id', profile.id).maybeSingle();
      const p = data as { full_name: string; bio: string | null; avatar_url: string | null } | null;
      if (p) {
        setFullName(p.full_name || '');
        setBio(p.bio || '');
        setAvatarUrl(p.avatar_url || '');
      }
    })();
  }, [profile?.id]);

  const handleSave = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    if (!supabase || !profile?.id) { setSaving(false); return; }
    const { error: updateError } = await supabase.from('profiles')
      .update({ full_name: fullName, bio: bio || null, avatar_url: avatarUrl || null, updated_at: new Date().toISOString() })
      .eq('id', profile.id);
    if (updateError) { setError(updateError.message); setSaving(false); return; }
    await refreshProfile();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="section-view">
      <div className="page-heading">
        <div>
          <div className="eyebrow dark"><span className="eyebrow-dot" /> Workspace</div>
          <h1>Settings</h1>
          <p>Make Sysmobyte work the way you do.</p>
        </div>
      </div>

      <div className="settings-layout">
        <div className="panel form-panel">
          <h3 className="settings-section-title">Profile information</h3>
          <form onSubmit={handleSave}>
            <label className="form-field"><span>Full name</span><input value={fullName} onChange={(e) => setFullName(e.target.value)} required /></label>
            <label className="form-field"><span>Avatar URL (optional)</span><input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://..." /></label>
            <label className="form-field"><span>Bio (optional)</span><textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} placeholder="Tell your team about yourself" /></label>
            {error && <div className="auth-error">{error}</div>}
            <div className="form-actions">
              <button type="submit" className="primary-button small" disabled={saving}>
                {saving ? <LoaderCircle size={16} className="spin" /> : saved ? <><Check size={16} /> Saved</> : 'Save changes'}
              </button>
            </div>
          </form>
        </div>

        <div className="panel form-panel">
          <h3 className="settings-section-title">Account</h3>
          <div className="settings-info-row"><span>Email</span><strong>{profile?.email || 'N/A'}</strong></div>
          <div className="settings-info-row"><span>Role</span><strong>{ROLE_LABELS[profile?.role as Role] || profile?.role || 'employee'}</strong></div>
          <div className="settings-info-row"><span>Organization</span><strong>{profile?.organization?.name || 'None'}</strong></div>
          <div className="settings-info-row"><span>User ID</span><strong className="mono">{profile?.id?.slice(0, 8) || 'N/A'}...</strong></div>
        </div>
      </div>
    </div>
  );
}
