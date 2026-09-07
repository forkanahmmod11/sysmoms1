import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { supabase, useAuth } from '@/lib/auth';
import { LoaderCircle, Send } from 'lucide-react';

type Message = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  read_at: string | null;
  created_at: string;
};

type Contact = {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function MessagesView() {
  const { profile } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [activeContact, setActiveContact] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      if (!supabase) { setLoading(false); return; }
      const { data } = await supabase.from('profiles').select('id, full_name, email, avatar_url').neq('id', profile?.id || '').order('full_name');
      setContacts((data as Contact[]) || []);
      setLoading(false);
    })();
  }, [profile?.id]);

  const loadMessages = useCallback(async (contactId: string) => {
    if (!supabase || !profile?.id) return;
    const { data } = await supabase.from('messages')
      .select('id, sender_id, receiver_id, content, read_at, created_at')
      .or(`and(sender_id.eq.${profile.id},receiver_id.eq.${contactId}),and(sender_id.eq.${contactId},receiver_id.eq.${profile.id})`)
      .order('created_at', { ascending: true });
    setMessages((data as Message[]) || []);
    await supabase.from('messages').update({ read_at: new Date().toISOString() }).eq('sender_id', contactId).eq('receiver_id', profile.id).is('read_at', null);
  }, [profile?.id]);

  useEffect(() => {
    if (activeContact) loadMessages(activeContact);
  }, [activeContact, loadMessages]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !supabase || !profile?.id || !activeContact) return;
    setSending(true);
    const content = text.trim();
    setText('');
    const { data: userData } = await supabase.auth.getUser();
    const { data: profileData } = await supabase.from('profiles').select('organization_id').eq('id', userData.user?.id || '').maybeSingle();
    const { data: newMsg } = await supabase.from('messages').insert({
      sender_id: profile.id, receiver_id: activeContact, content,
      organization_id: (profileData as { organization_id: string | null })?.organization_id || null,
    }).select('id, sender_id, receiver_id, content, read_at, created_at').single();
    if (newMsg) setMessages([...messages, newMsg as Message]);
    setSending(false);
  };

  const activeContactData = contacts.find((c) => c.id === activeContact);

  return (
    <div className="section-view messages-view">
      <div className="page-heading">
        <div>
          <div className="eyebrow dark"><span className="eyebrow-dot" /> Workspace</div>
          <h1>Messages</h1>
          <p>Stay close to the conversations that matter.</p>
        </div>
      </div>

      {loading ? (
        <div className="loading-grid">
          {[0, 1, 2, 3].map((i) => <div className="skeleton-card" key={i}><div className="skeleton-line w-60" /><div className="skeleton-line w-40" /><div className="skeleton-line w-80" /></div>)}
        </div>
      ) : (
        <div className="messages-layout">
          <aside className="messages-sidebar">
            <div className="messages-sidebar-header"><h3>Conversations</h3></div>
            {contacts.length === 0 && <div className="empty-inline">No contacts available.</div>}
            {contacts.map((c) => (
              <button key={c.id} className={`contact-item ${activeContact === c.id ? 'active' : ''}`} onClick={() => setActiveContact(c.id)}>
                {c.avatar_url ? <img src={c.avatar_url} alt="" className="member-avatar" /> : <span className="member-avatar">{initials(c.full_name)}</span>}
                <div><strong>{c.full_name}</strong><span>{c.email}</span></div>
              </button>
            ))}
          </aside>

          <section className="messages-chat">
            {!activeContact ? (
              <div className="messages-empty">
                <div className="empty-icon"><Send size={24} /></div>
                <h2>Select a conversation</h2>
                <p>Choose someone from the list to start chatting.</p>
              </div>
            ) : (
              <>
                <div className="chat-header">
                  {activeContactData?.avatar_url ? <img src={activeContactData.avatar_url} alt="" className="member-avatar" /> : <span className="member-avatar">{initials(activeContactData?.full_name || '?')}</span>}
                  <div><strong>{activeContactData?.full_name}</strong><span>{activeContactData?.email}</span></div>
                </div>
                <div className="chat-body" ref={scrollRef}>
                  {messages.length === 0 && <div className="empty-inline">No messages yet. Say hello!</div>}
                  {messages.map((m) => (
                    <div key={m.id} className={`chat-bubble ${m.sender_id === profile?.id ? 'mine' : 'theirs'}`}>
                      <p>{m.content}</p>
                      <small>{new Date(m.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}</small>
                    </div>
                  ))}
                </div>
                <form className="chat-input" onSubmit={handleSend}>
                  <input placeholder="Type a message..." value={text} onChange={(e) => setText(e.target.value)} />
                  <button type="submit" disabled={sending || !text.trim()}>{sending ? <LoaderCircle size={18} className="spin" /> : <Send size={18} />}</button>
                </form>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
