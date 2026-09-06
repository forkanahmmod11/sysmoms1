import { useEffect, useMemo, useState } from 'react';
import { FileText, FolderKanban, LoaderCircle, Search, UserRound } from 'lucide-react';
import { supabase, type UserProfile } from '@/lib/auth';

export type SearchTarget = 'overview' | 'tasks' | 'projects' | 'team' | 'messages';
type Result = { id: string; title: string; subtitle: string; type: string; target: SearchTarget; score: number };

function score(text: string, q: string, recency = 0) {
  const t = text.toLowerCase(), s = q.toLowerCase();
  if (t === s) return 100 + recency;
  if (t.startsWith(s)) return 80 + recency;
  if (t.includes(s)) return 60 + recency;
  return 0;
}

export function SearchRecommendations({ profile, onSelect }: { profile: UserProfile | null; onSelect: (target: SearchTarget) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    const client = supabase;
    if (!client || !profile?.organization?.id || q.length < 2) { setResults([]); return; }
    let alive = true;
    const run = async () => {
      setLoading(true);
      const orgId = profile.organization!.id;
      const pattern = `%${q}%`;
      const [projects, tasks, members, messages] = await Promise.all([
        client.from('projects').select('id,name,description,created_at').eq('organization_id', orgId).or(`name.ilike.${pattern},description.ilike.${pattern}`).limit(8),
        client.from('tasks').select('id,title,description,created_at').eq('organization_id', orgId).or(`title.ilike.${pattern},description.ilike.${pattern}`).limit(8),
        client.from('organization_members').select('user_id,profiles(full_name,email)').eq('organization_id', orgId).limit(50),
        client.from('messages').select('id,content,created_at').eq('organization_id', orgId).ilike('content', pattern).limit(8),
      ]);
      if (!alive) return;
      const rows: Result[] = [];
      for (const r of (projects.data || []) as any[]) { const sc=score(`${r.name} ${r.description||''}`,q); if(sc) rows.push({id:r.id,title:r.name,subtitle:r.description||'Project',type:'Project',target:'projects',score:sc}); }
      for (const r of (tasks.data || []) as any[]) { const sc=score(`${r.title} ${r.description||''}`,q); if(sc) rows.push({id:r.id,title:r.title,subtitle:r.description||'Task',type:'Task',target:'tasks',score:sc}); }
      for (const r of (members.data || []) as any[]) { const p=Array.isArray(r.profiles)?r.profiles[0]:r.profiles; const title=p?.full_name||p?.email||''; const sc=score(`${title} ${p?.email||''}`,q); if(sc) rows.push({id:r.user_id,title,subtitle:p?.email||'Team member',type:'Person',target:'team',score:sc}); }
      for (const r of (messages.data || []) as any[]) { const sc=score(r.content,q); if(sc) rows.push({id:r.id,title:r.content,subtitle:'Workspace message',type:'Message',target:'messages',score:sc}); }
      rows.sort((a,b)=>b.score-a.score);
      setResults(rows.slice(0,12)); setLoading(false);
    };
    const timer=setTimeout(run,180); return ()=>{alive=false; clearTimeout(timer)};
  }, [query, profile?.organization?.id]);

  const recent = useMemo(() => { try { return JSON.parse(localStorage.getItem('sysmobyte_recent_searches') || '[]') as string[]; } catch { return []; } }, [query]);
  const icon = (type:string) => type==='Project'?<FolderKanban size={17}/>:type==='Task'?<FileText size={17}/>:type==='Person'?<UserRound size={17}/>:<Search size={17}/>;
  const select = (r:Result) => { const arr=[r.title,...recent.filter(x=>x!==r.title)].slice(0,6); localStorage.setItem('sysmobyte_recent_searches',JSON.stringify(arr)); onSelect(r.target); };

  return <div className="search-results"><div className="search-popover"><Search size={17}/><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search projects, tasks, people, messages..."/><span>⌘ K</span></div>
    {loading && <div className="search-empty"><LoaderCircle size={16} className="spin"/> Searching your isolated workspace…</div>}
    {!loading && query.trim().length < 2 && <div className="search-empty">Type at least 2 characters. Recommendations are ranked by exact match, title match and relevance. Only your workspace is searched.</div>}
    {!loading && query.trim().length >= 2 && results.length===0 && <div className="search-empty">No results in your workspace.</div>}
    {results.map(r=><button key={`${r.type}-${r.id}`} className="search-result" onClick={()=>select(r)}>{icon(r.type)}<span className="search-result-meta"><strong>{r.title}</strong><span>{r.type} · {r.subtitle}</span></span></button>)}
  </div>;
}
