import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Camera, LoaderCircle, X } from 'lucide-react';
import { supabase, useAuth } from '@/lib/auth';

const BUCKET = 'profile-media';
const MAX_BYTES = 5 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

export type PhotoKind = 'avatar' | 'cover';

const copy: Record<PhotoKind, { title: string; hint: string; column: 'avatar_url' | 'cover_url' }> = {
  avatar: { title: 'Change profile photo', hint: 'Square images look best. JPG, PNG, WebP or GIF up to 5 MB.', column: 'avatar_url' },
  cover: { title: 'Change cover photo', hint: 'Wide images look best. JPG, PNG, WebP or GIF up to 5 MB.', column: 'cover_url' },
};

export function ProfilePhotoDialog({ kind, currentUrl, onClose, onSaved }: {
  kind: PhotoKind;
  currentUrl: string | null;
  onClose: () => void;
  onSaved: (url: string) => void;
}) {
  const { profile, refreshProfile } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(currentUrl);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const text = copy[kind];

  useEffect(() => {
    if (!file) { setPreview(currentUrl); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file, currentUrl]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && !saving) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.files?.[0] ?? null;
    setError(null);
    if (!next) return;
    if (!EXTENSIONS[next.type]) { setError('Please choose a JPG, PNG, WebP or GIF image.'); return; }
    if (next.size > MAX_BYTES) { setError('That image is larger than 5 MB. Please choose a smaller one.'); return; }
    setFile(next);
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || !profile?.id || !file) return;
    setSaving(true);
    setError(null);
    try {
      const path = `${profile.id}/${kind}-${Date.now()}.${EXTENSIONS[file.type]}`;
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, cacheControl: '3600' });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ [text.column]: data.publicUrl, updated_at: new Date().toISOString() })
        .eq('id', profile.id);
      if (updateError) throw updateError;
      await refreshProfile();
      onSaved(data.publicUrl);
      onClose();
    } catch (cause) {
      console.error('profile photo upload failed', cause);
      setError('We could not save your photo. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="photo-dialog-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <form className="photo-dialog" onSubmit={save} role="dialog" aria-modal="true" aria-labelledby="photo-dialog-title">
        <div className="photo-dialog-head">
          <h2 id="photo-dialog-title">{text.title}</h2>
          <button type="button" className="photo-dialog-close" onClick={onClose} disabled={saving} aria-label="Close"><X size={18} /></button>
        </div>
        <div className={`photo-dialog-preview ${kind}`}>
          {preview ? <img src={preview} alt="" /> : <span><Camera size={22} /></span>}
        </div>
        <label className="photo-dialog-picker">
          <Camera size={16} /> {file ? file.name : 'Choose an image'}
          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleFile} disabled={saving} />
        </label>
        <p className="photo-dialog-hint">{text.hint}</p>
        {error && <div className="auth-error">{error}</div>}
        <div className="photo-dialog-actions">
          <button type="button" className="secondary-profile-button" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" className="primary-button small" disabled={!file || saving}>
            {saving ? <><LoaderCircle size={15} className="spin" /> Saving...</> : 'Save photo'}
          </button>
        </div>
      </form>
    </div>
  );
}
