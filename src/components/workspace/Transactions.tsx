import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { supabase, useAuth } from '@/lib/auth';
import { CreditCard, LoaderCircle, Plus, TrendingUp, TrendingDown } from 'lucide-react';

type Transaction = {
  id: string;
  title: string;
  amount: number;
  type: string;
  category: string | null;
  status: string;
  created_at: string;
};

export function TransactionsView() {
  const { profile } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) { setLoading(false); return; }
    const { data } = await supabase.from('transactions')
      .select('id, title, amount, type, category, status, created_at')
      .order('created_at', { ascending: false });
    setTransactions((data as Transaction[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    if (!supabase || !profile?.id) { setCreating(false); return; }
    const form = new FormData(e.currentTarget);
    const title = String(form.get('title') || '');
    const amount = parseFloat(String(form.get('amount') || '0'));
    const type = String(form.get('type') || 'expense');
    const category = String(form.get('category') || '');
    const { data: userData } = await supabase.auth.getUser();
    const { data: profileData } = await supabase.from('profiles').select('organization_id').eq('id', userData.user?.id || '').maybeSingle();
    const { error: insertError } = await supabase.from('transactions').insert({
      title, amount, type, category: category || null,
      user_id: profile.id,
      organization_id: (profileData as { organization_id: string | null })?.organization_id || null,
    });
    if (insertError) { setError(insertError.message); setCreating(false); return; }
    setShowForm(false);
    setCreating(false);
    load();
  };

  const income = transactions.filter((t) => t.type === 'income').reduce((sum, t) => sum + Number(t.amount), 0);
  const expenses = transactions.filter((t) => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount), 0);
  const balance = income - expenses;

  return (
    <div className="section-view">
      <div className="page-heading">
        <div>
          <div className="eyebrow dark"><span className="eyebrow-dot" /> Workspace</div>
          <h1>Transactions</h1>
          <p>A simple view of your workspace finances.</p>
        </div>
        <button className="primary-button small" onClick={() => setShowForm(!showForm)}><Plus size={17} /> New transaction</button>
      </div>

      {showForm && (
        <div className="panel form-panel">
          <form onSubmit={handleCreate}>
            <label className="form-field"><span>Title</span><input name="title" placeholder="Office supplies" required /></label>
            <div className="form-row-grid">
              <label className="form-field"><span>Amount</span><input type="number" step="0.01" name="amount" placeholder="0.00" required /></label>
              <label className="form-field"><span>Type</span>
                <select name="type" defaultValue="expense">
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
              </label>
              <label className="form-field"><span>Category</span><input name="category" placeholder="Equipment, travel..." /></label>
            </div>
            {error && <div className="auth-error">{error}</div>}
            <div className="form-actions">
              <button type="button" className="secondary-button" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="primary-button small" disabled={creating}>{creating ? <LoaderCircle size={16} className="spin" /> : 'Add'}</button>
            </div>
          </form>
        </div>
      )}

      <div className="finance-summary">
        <div className="finance-card balance">
          <div className="finance-icon"><CreditCard size={18} /></div>
          <div><span>Net balance</span><strong>${balance.toFixed(2)}</strong></div>
        </div>
        <div className="finance-card income">
          <div className="finance-icon"><TrendingUp size={18} /></div>
          <div><span>Total income</span><strong>${income.toFixed(2)}</strong></div>
        </div>
        <div className="finance-card expense">
          <div className="finance-icon"><TrendingDown size={18} /></div>
          <div><span>Total expenses</span><strong>${expenses.toFixed(2)}</strong></div>
        </div>
      </div>

      {loading ? (
        <div className="loading-grid">
          {[0, 1, 2, 3].map((i) => <div className="skeleton-card" key={i}><div className="skeleton-line w-60" /><div className="skeleton-line w-40" /><div className="skeleton-line w-80" /></div>)}
        </div>
      ) : (
        <div className="panel section-table">
          <div className="table-toolbar">
            <div className="table-tabs"><button className="selected">All ({transactions.length})</button></div>
          </div>
          {transactions.length === 0 && <div className="empty-inline">No transactions yet.</div>}
          {transactions.map((t) => (
            <div className="table-row" key={t.id}>
              <span className={`project-bullet ${t.type === 'income' ? 'lime' : 'orange'}`} />
              <div className="table-primary">
                <strong>{t.title}</strong>
                <span>{t.category || 'Uncategorized'} · {new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              </div>
              <span className={`tx-amount ${t.type}`}>{t.type === 'income' ? '+' : '-'}${Number(t.amount).toFixed(2)}</span>
              <span className={`tx-status ${t.status}`}>{t.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
