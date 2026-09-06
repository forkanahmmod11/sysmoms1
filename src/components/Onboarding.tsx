import { useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight, Building2, CheckCircle2, LoaderCircle, ShieldCheck } from 'lucide-react';
import { supabase, useAuth } from '@/lib/auth';

export function Onboarding({ onComplete, onLogout }: { onComplete: () => Promise<void> | void; onLogout: () => void }) {
  const { user, profile, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!supabase || !user?.id) { setError('Workspace connection is not configured.'); return; }
    setLoading(true); setError(null);
    const f = new FormData(e.currentTarget);
    const args = {
      p_company_name: String(f.get('company_name') || '').trim(),
      p_website: String(f.get('website') || '').trim() || null,
      p_industry: String(f.get('industry') || '').trim() || null,
      p_company_size: String(f.get('company_size') || '').trim() || null,
      p_country: String(f.get('country') || '').trim() || null,
      p_company_address: String(f.get('company_address') || '').trim() || null,
      p_business_description: String(f.get('business_description') || '').trim() || null,
      p_registration_number: String(f.get('registration_number') || '').trim() || null,
      p_representative_name: String(f.get('representative_name') || '').trim() || null,
      p_phone: String(f.get('phone') || '').trim() || null,
    };
    const { error: rpcError } = await supabase.rpc('create_isolated_workspace', args);
    if (rpcError) { setError(rpcError.message); setLoading(false); return; }
    await refreshProfile();
    await onComplete();
    setLoading(false);
  };

  return <main className="subscription-page">
    <nav className="subscription-nav"><div className="brand"><span className="brand-mark"><span/><span/><span/></span><span>sysmo<span className="brand-accent">byte</span></span></div><div className="nav-actions"><span className="nav-user">{profile?.fullName || user?.email}</span><button className="text-button" onClick={onLogout}>Sign out</button></div></nav>
    <div className="subscription-container"><motion.div initial={{opacity:0,y:18}} animate={{opacity:1,y:0}} className="subscription-form onboarding-form">
      <div className="subscription-header"><div className="eyebrow dark"><span className="eyebrow-dot"/> Company onboarding</div><h1>Create your isolated workspace</h1><p>Submit your company information and verification details. Your company will receive its own isolated workspace and you will become its Workspace Admin.</p></div>
      <form onSubmit={submit}>
        <div className="form-section"><h3><Building2 size={18}/> Company information</h3><div className="onboarding-grid">
          <label className="form-field"><span>Company name *</span><input name="company_name" required placeholder="Afferent Tech"/></label>
          <label className="form-field"><span>Website</span><input name="website" type="url" placeholder="https://example.com"/></label>
          <label className="form-field"><span>Industry</span><input name="industry" placeholder="Technology"/></label>
          <label className="form-field"><span>Company size</span><select name="company_size"><option>1–10</option><option>11–50</option><option>51–200</option><option>201–1000</option><option>1000+</option></select></label>
          <label className="form-field"><span>Country</span><input name="country" placeholder="Bangladesh"/></label>
          <label className="form-field"><span>Company address</span><input name="company_address" placeholder="City, Country"/></label>
        </div><label className="form-field"><span>Business description</span><textarea name="business_description" rows={3} placeholder="What does your company do?"/></label></div>
        <div className="form-section"><h3><ShieldCheck size={18}/> Verification / KYC</h3><p className="form-hint">Provide business verification information. Avoid unnecessary personal or sensitive data.</p><div className="onboarding-grid">
          <label className="form-field"><span>Company registration number</span><input name="registration_number"/></label>
          <label className="form-field"><span>Authorized representative</span><input name="representative_name"/></label>
          <label className="form-field"><span>Business contact number</span><input name="phone" type="tel"/></label>
        </div></div>
        {error && <div className="auth-error">{error}</div>}
        <button className="primary-button subscription-submit" disabled={loading}>{loading ? <><LoaderCircle size={18} className="spin"/> Creating isolated workspace...</> : <><CheckCircle2 size={18}/> Create workspace & continue <ArrowUpRight size={17}/></>}</button>
      </form>
    </motion.div></div>
  </main>;
}
