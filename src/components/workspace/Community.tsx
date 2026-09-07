import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { supabase, useAuth } from '@/lib/auth';
import { Heart, MessageCircle, Pencil, Plus, Send, Trash2, X } from 'lucide-react';

type PublicProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
  skills: string[] | null;
  certification_links: string[] | null;
  role: string;
};

type Post = {
  id: string;
  author_id: string;
  organization_id: string | null;
  title: string | null;
  content: string;
  cover_url: string | null;
  is_public: boolean;
  created_at: string;
  profiles: { full_name: string | null; avatar_url: string | null } | { full_name: string | null; avatar_url: string | null }[] | null;
};

type Comment = {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  created_at: string;
  profiles: { full_name: string | null; avatar_url: string | null } | { full_name: string | null; avatar_url: string | null }[] | null;
};

function profileOf(value: Post['profiles'] | Comment['profiles']) {
  return Array.isArray(value) ? value[0] : value;
}
function initials(name: string) {
  const p = name.trim().split(/\s+/);
  return p.length > 1 ? `${p[0][0]}${p[p.length - 1][0]}`.toUpperCase() : p[0].slice(0, 2).toUpperCase();
}

export function PublicFeed({ limit = 6 }: { limit?: number }) {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeComments, setActiveComments] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [reactioned, setReactioned] = useState<Record<string, boolean>>({});
  const [counts, setCounts] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    if (!supabase) { setLoading(false); return; }
    const { data } = await supabase
      .from('posts')
      .select('id, author_id, organization_id, title, content, cover_url, is_public, created_at, profiles(full_name, avatar_url)')
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(limit);
    const rows = (data as Post[]) || [];
    setPosts(rows);
    const ids = rows.map((p) => p.id);
    if (ids.length) {
      const { data: reactions } = await supabase.from('post_reactions').select('post_id, user_id').in('post_id', ids);
      const mine = (reactions || []).filter((r) => r.user_id === (user?.id || '')).reduce<Record<string, boolean>>((a, r) => ({ ...a, [r.post_id]: true }), {});
      const total: Record<string, number> = {};
      (reactions || []).forEach((r) => { total[r.post_id] = (total[r.post_id] || 0) + 1; });
      setReactioned(mine); setCounts(total);
    }
    setLoading(false);
  }, [limit, user?.id]);


  useEffect(() => { void load(); }, [load]);

  const toggleReaction = async (postId: string) => {
    if (!supabase || !user) return;
    if (reactioned[postId]) {
      await supabase.from('post_reactions').delete().eq('post_id', postId).eq('user_id', user.id);
      setReactioned((x) => ({ ...x, [postId]: false }));
      setCounts((x) => ({ ...x, [postId]: Math.max(0, (x[postId] || 1) - 1) }));
    } else {
      await supabase.from('post_reactions').insert({ post_id: postId, user_id: user.id, reaction: 'like' });
      setReactioned((x) => ({ ...x, [postId]: true }));
      setCounts((x) => ({ ...x, [postId]: (x[postId] || 0) + 1 }));
    }
  };

  const toggleComments = async (postId: string) => {
    if (!supabase) return;
    if (activeComments === postId) { setActiveComments(null); return; }
    const { data } = await supabase.from('post_comments')
      .select('id, post_id, author_id, content, created_at, profiles(full_name, avatar_url)')
      .eq('post_id', postId).order('created_at');
    setComments((x) => ({ ...x, [postId]: (data as Comment[]) || [] }));
    setActiveComments(postId);
  };

  const addComment = async (postId: string) => {
    if (!supabase || !user || !commentText[postId]?.trim()) return;
    const { data } = await supabase.from('post_comments').insert({ post_id: postId, author_id: user.id, content: commentText[postId].trim() }).select('id, post_id, author_id, content, created_at, profiles(full_name, avatar_url)').single();
    if (data) setComments((x) => ({ ...x, [postId]: [...(x[postId] || []), data as Comment] }));
    setCommentText((x) => ({ ...x, [postId]: '' }));
  };

  if (loading) return <LoadingPosts />;
  if (!posts.length) return <div className="empty-inline">No public posts yet.</div>;

  return <div className="social-feed">
    {posts.map((post) => {
      const author = profileOf(post.profiles);
      return <motion.article className="social-post panel" key={post.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="social-post-author">
          {author?.avatar_url ? <img src={author.avatar_url} alt="" className="member-avatar" /> : <span className="member-avatar">{initials(author?.full_name || 'User')}</span>}
          <div><strong>{author?.full_name || 'Sysmobyte Admin'}</strong><small>{new Date(post.created_at).toLocaleString()}</small></div>
        </div>
        {post.title && <h3>{post.title}</h3>}
        <p className="social-post-content">{post.content}</p>
        {post.cover_url && <img src={post.cover_url} alt="" className="social-post-cover" />}
        <div className="social-post-actions">
          <button className={reactioned[post.id] ? 'reacted' : ''} onClick={() => void toggleReaction(post.id)}><Heart size={16} /> {counts[post.id] || 0}</button>
          <button onClick={() => void toggleComments(post.id)}><MessageCircle size={16} /> Comments</button>
        </div>
        {activeComments === post.id && <div className="social-comments">
          {(comments[post.id] || []).map((c) => {
            const ca = profileOf(c.profiles);
            return <div className="social-comment" key={c.id}><span className="member-avatar small">{initials(ca?.full_name || 'U')}</span><div><strong>{ca?.full_name || 'User'}</strong><p>{c.content}</p></div></div>;
          })}
          <div className="social-comment-form"><input value={commentText[post.id] || ''} onChange={(e) => setCommentText((x) => ({ ...x, [post.id]: e.target.value }))} placeholder="Write a comment..." onKeyDown={(e) => { if (e.key === 'Enter') void addComment(post.id); }} /><button onClick={() => void addComment(post.id)}><Send size={15} /></button></div>
        </div>}
      </motion.article>;
    })}
  </div>;
}

export function PublicPostAdmin() {
  const { profile } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [editing, setEditing] = useState<Post | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const canManage = profile?.role === 'super_admin' || profile?.role === 'admin';
  const load = useCallback(async () => {
    if (!supabase) return;
    let query = supabase.from('posts').select('id, author_id, organization_id, title, content, cover_url, is_public, created_at, profiles(full_name, avatar_url)').eq('is_public', true).order('created_at', { ascending: false });
    if (profile?.role === 'admin' && profile.organization?.id) query = query.eq('organization_id', profile.organization.id);
    const { data } = await query;
    setPosts((data as Post[]) || []);
  }, [profile?.role, profile?.organization?.id]);
  useEffect(() => { void load(); }, [load]);

  if (!canManage) return <div className="empty-inline">Admin access is required to manage public posts.</div>;

  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setSaving(true);
    const f = new FormData(e.currentTarget);
    const title = String(f.get('title') || '');
    const content = String(f.get('content') || '');
    const cover_url = String(f.get('cover_url') || '');
    if (!supabase) return;
    if (editing) {
      await supabase.from('posts').update({ title: title || null, content, cover_url: cover_url || null, is_public: true }).eq('id', editing.id);
    } else {
      await supabase.rpc('create_public_post', { p_title: title, p_content: content, p_cover_url: cover_url || null });
    }
    setSaving(false); setEditing(null); setShowForm(false); await load();
  };

  const remove = async (id: string) => {
    if (!supabase || !window.confirm('Delete this public post?')) return;
    await supabase.from('posts').delete().eq('id', id);
    await load();
  };

  return <div className="section-view">
    <div className="page-heading"><div><div className="eyebrow dark"><span className="eyebrow-dot" /> Community</div><h1>Public Posts</h1><p>Publish announcements and updates that appear on every workspace dashboard.</p></div><button className="primary-button small" onClick={() => { setEditing(null); setShowForm(!showForm); }}><Plus size={17} /> New post</button></div>
    {showForm && <div className="panel form-panel">
      <form onSubmit={save}>
        <label className="form-field"><span>Title</span><input name="title" defaultValue={editing?.title || ''} placeholder="Important announcement" /></label>
        <label className="form-field"><span>Post</span><textarea name="content" defaultValue={editing?.content || ''} placeholder="Write your announcement..." required rows={6} /></label>
        <label className="form-field"><span>Cover image URL (optional)</span><input name="cover_url" defaultValue={editing?.cover_url || ''} placeholder="https://..." /></label>
        <div className="form-actions"><button type="button" className="secondary-button" onClick={() => setShowForm(false)}><X size={15} /> Cancel</button><button className="primary-button small" disabled={saving}>{saving ? 'Publishing...' : 'Publish'}</button></div>
      </form>
    </div>}
    <div className="social-feed">
      {posts.map((post) => <div className="panel social-post" key={post.id}>
        <div className="social-post-author"><span className="member-avatar">{initials(profile?.fullName || 'Admin')}</span><div><strong>{post.title || 'Untitled post'}</strong><small>{new Date(post.created_at).toLocaleString()}</small></div></div>
        <p className="social-post-content">{post.content}</p>
        <div className="social-post-actions"><button onClick={() => { setEditing(post); setShowForm(true); }}><Pencil size={15} /> Edit</button><button onClick={() => void remove(post.id)}><Trash2 size={15} /> Delete</button></div>
      </div>)}
      {!posts.length && <div className="panel empty-inline">No public posts yet. Publish the first one.</div>}
    </div>
  </div>;
}

export function UserProfileView({ userId, onBack }: { userId: string; onBack?: () => void }) {
  const { user, profile: me } = useAuth();
  const [data, setData] = useState<PublicProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!supabase) return;
    const [{ data: p }, { data: psts }] = await Promise.all([
      supabase.from('profiles').select('id, full_name, email, avatar_url, cover_url, bio, skills, certification_links, role').eq('id', userId).single(),
      supabase.from('posts').select('id, author_id, organization_id, title, content, cover_url, is_public, created_at, profiles(full_name, avatar_url)').eq('author_id', userId).order('created_at', { ascending: false }).limit(20),
    ]);
    setData(p as PublicProfile | null); setPosts((psts as Post[]) || []); setLoading(false);
  }, [userId]);
  useEffect(() => { void load(); }, [load]);

  const isOwner = user?.id === userId;
  const saveProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!supabase || !isOwner) return;
    const f = new FormData(e.currentTarget);
    await supabase.from('profiles').update({
      full_name: String(f.get('full_name') || '').trim(),
      avatar_url: String(f.get('avatar_url') || '').trim() || null,
      cover_url: String(f.get('cover_url') || '').trim() || null,
      bio: String(f.get('bio') || '').trim() || null,
      skills: String(f.get('skills') || '').split(',').map((s) => s.trim()).filter(Boolean),
      certification_links: String(f.get('certifications') || '').split('\n').map((s) => s.trim()).filter(Boolean),
    }).eq('id', userId);
    setEditing(false); await load();
  };

  if (loading) return <LoadingPosts />;
  if (!data) return <div className="empty-inline">Profile not found.</div>;

  return <div className="section-view profile-page">
    {onBack && <button className="secondary-button small" onClick={onBack}>← Back</button>}
    <div className="profile-hero panel">
      {data.cover_url && <img src={data.cover_url} alt="" className="profile-cover" />}
      <div className="profile-hero-body">
        {data.avatar_url ? <img src={data.avatar_url} alt="" className="profile-avatar-large" /> : <span className="profile-avatar-large">{initials(data.full_name || 'User')}</span>}
        <div className="profile-main"><h1>{data.full_name || 'User'}</h1><span>{data.role.replace(/_/g, ' ')}</span><p>{data.bio || 'No bio added yet.'}</p></div>
        {isOwner && <button className="secondary-button small" onClick={() => setEditing(!editing)}>{editing ? 'Close editor' : 'Edit profile'}</button>}
      </div>
    </div>
    {isOwner && <div className="panel form-panel profile-post-composer">
      <form onSubmit={async (e) => {
        e.preventDefault();
        if (!supabase) return;
        const f = new FormData(e.currentTarget);
        const title = String(f.get('post_title') || '').trim();
        const content = String(f.get('post_content') || '').trim();
        if (!content) return;
        const { error } = await supabase.from('posts').insert({
          author_id: userId,
          organization_id: me?.organization?.id || null,
          title: title || null,
          content,
          is_public: false
        });
        if (!error) { e.currentTarget.reset(); await load(); }
      }}>
        <div className="panel-heading"><div><span className="panel-eyebrow">Your profile</span><h2>Create a post</h2></div></div>
        <label className="form-field"><span>Title (optional)</span><input name="post_title" placeholder="What are you working on?" /></label>
        <label className="form-field"><span>Post</span><textarea name="post_content" rows={4} placeholder="Share an update with your workspace..." required /></label>
        <div className="form-actions"><button className="primary-button small" type="submit"><Plus size={15} /> Post</button></div>
      </form>
    </div>}
    {editing && <div className="panel form-panel">
      <form onSubmit={saveProfile}>
        <label className="form-field"><span>Name</span><input name="full_name" defaultValue={data.full_name || ''} /></label>
        <label className="form-field"><span>Profile picture URL</span><input name="avatar_url" defaultValue={data.avatar_url || ''} placeholder="https://..." /></label>
        <label className="form-field"><span>Cover image URL</span><input name="cover_url" defaultValue={data.cover_url || ''} placeholder="https://..." /></label>
        <label className="form-field"><span>Bio</span><textarea name="bio" defaultValue={data.bio || ''} rows={4} /></label>
        <label className="form-field"><span>Skills (comma separated)</span><input name="skills" defaultValue={(data.skills || []).join(', ')} /></label>
        <label className="form-field"><span>Certification links (one per line)</span><textarea name="certifications" defaultValue={(data.certification_links || []).join('\n')} rows={4} /></label>
        <div className="form-actions"><button type="submit" className="primary-button small">Save profile</button></div>
      </form>
    </div>}
    <div className="profile-grid">
      <section className="panel profile-details"><h2>Skills</h2><div className="skill-list">{(data.skills || []).map((s) => <span key={s}>{s}</span>)}{!(data.skills || []).length && <small>No skills added.</small>}</div><h2>Certifications</h2><div className="cert-list">{(data.certification_links || []).map((c) => <a key={c} href={c} target="_blank" rel="noreferrer">{c}</a>)}{!(data.certification_links || []).length && <small>No certification links added.</small>}</div></section>
      <section><h2 className="profile-post-heading">Posts</h2><div className="social-feed">{posts.map((p) => <article className="panel social-post" key={p.id}><strong>{p.title || 'Post'}</strong><small>{new Date(p.created_at).toLocaleString()}</small><p className="social-post-content">{p.content}</p></article>)}{!posts.length && <div className="empty-inline">No posts yet.</div>}</div></section>
    </div>
  </div>;
}

function LoadingPosts() {
  return <div className="loading-grid">{[0, 1, 2].map((i) => <div className="skeleton-card" key={i}><div className="skeleton-line w-60" /><div className="skeleton-line w-80" /><div className="skeleton-line w-40" /></div>)}</div>;
}
