import { useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/auth';
import { PLANS, submitRequest, uploadFile, type Plan, type PaymentMethod } from '@/lib/subscription';
import { ArrowUpRight, Check, Image as ImageIcon, LoaderCircle, Shield, Sparkles, X, CreditCard, Smartphone, Landmark } from 'lucide-react';

type Step = 'plans' | 'payment' | 'submitted';

const PAYMENT_METHODS: { id: PaymentMethod; name: string; description: string; icon: typeof CreditCard }[] = [
  { id: 'bkash', name: 'bKash', description: 'Mobile financial service payment', icon: Smartphone },
  { id: 'upay', name: 'Upay', description: 'Upay digital payment', icon: Smartphone },
  { id: 'citytouch', name: 'Citytouch', description: 'City Bank digital banking', icon: Landmark },
];

export function SubscriptionPage({ onLogout }: { onLogout: () => void }) {
  const { profile, user } = useAuth();
  const [step, setStep] = useState<Step>('plans');
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [paymentReference, setPaymentReference] = useState('');
  const [screenshots, setScreenshots] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userId = user?.id || profile?.id || 'offline-user';
  const userEmail = user?.email || profile?.email || '';
  const userName = profile?.fullName || userEmail.split('@')[0];

  const handleSelectPlan = (plan: Plan) => {
    setSelectedPlan(plan);
    setError(null);
    setStep('payment');
  };

  const handleScreenshotAdd = (files: FileList | null) => {
    if (files) setScreenshots((prev) => [...prev, ...Array.from(files)]);
  };

  const removeScreenshot = (idx: number) => setScreenshots((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedPlan || !paymentMethod) {
      setError('Please select a subscription plan and payment method.');
      return;
    }
    if (!paymentReference.trim()) {
      setError('Please enter your transaction ID / payment reference.');
      return;
    }
    if (screenshots.length === 0) {
      setError('Please upload at least one payment proof screenshot.');
      return;
    }
    if (!profile?.organization?.id) {
      setError('Your isolated workspace is not ready yet. Complete company onboarding first.');
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const uploadedShots: string[] = [];
      for (const file of screenshots) uploadedShots.push(await uploadFile(userId, file));

      await submitRequest({
        userId,
        userEmail,
        userName,
        planId: selectedPlan.id,
        planName: selectedPlan.name,
        organizationName: profile.organization.name || 'Workspace',
        organizationId: profile.organization.id,
        paymentMethod,
        paymentReference: paymentReference.trim(),
        documentUrls: [],
        screenshotUrls: uploadedShots,
      });
      setStep('submitted');
    } catch {
      setError('Something went wrong during submission. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return <main className="subscription-page">
    <nav className="subscription-nav">
      <div className="brand"><span className="brand-mark"><span /><span /><span /></span><span>sysmo<span className="brand-accent">byte</span></span></div>
      <div className="nav-actions"><span className="nav-user">{userName}</span><button className="text-button" onClick={onLogout}>Sign out</button></div>
    </nav>

    <div className="subscription-container">
      {step !== 'submitted' && <div className="pending-status-flow" style={{ marginBottom: 24 }}>
        <div className="status-step done">1. Subscription</div>
        <div className={`status-step ${step === 'payment' ? 'active' : 'pending'}`}>2. Payment & proof</div>
        <div className="status-step pending">3. Admin review</div>
      </div>}

      {step === 'plans' && <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="subscription-header">
          <div className="eyebrow dark"><span className="eyebrow-dot" /> Step 1 — Subscription</div>
          <h1>Select your package and plan</h1>
          <p>Choose the subscription package that fits your company. You will then select a payment method and submit payment proof for approval.</p>
        </div>
        <div className="plans-grid">
          {PLANS.map((plan, idx) => <motion.div key={plan.id} className={`plan-card ${plan.name === 'Professional' ? 'featured' : ''}`} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }}>
            {plan.name === 'Professional' && <div className="plan-badge"><Sparkles size={13} /> Most popular</div>}
            <div className="plan-header"><h2>{plan.name}</h2><div className="plan-price"><span className="plan-amount">${plan.price}</span><span className="plan-period">/{plan.billing_period}</span></div><p>{plan.description}</p></div>
            <ul className="plan-features">{plan.features.map((f) => <li key={f}><Check size={15} /> {f}</li>)}</ul>
            <button className={`primary-button ${plan.name === 'Professional' ? '' : 'secondary-button'}`} onClick={() => handleSelectPlan(plan)}>Select {plan.name} <ArrowUpRight size={16} /></button>
          </motion.div>)}
        </div>
      </motion.div>}

      {step === 'payment' && selectedPlan && <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
        <div className="subscription-header">
          <button className="back-button" onClick={() => setStep('plans')}><X size={16} /> Back to plans</button>
          <div className="eyebrow dark"><span className="eyebrow-dot" /> Step 2–5 — Payment submission</div>
          <h1>Pay, upload proof and submit for approval</h1>
          <p>Selected plan: <strong>{selectedPlan.name}</strong>. Choose bKash, Upay or Citytouch, then provide your transaction data and payment screenshot.</p>
        </div>

        <form className="subscription-form" onSubmit={handleSubmit}>
          <div className="form-section">
            <div className="selected-plan-card"><div className="selected-plan-info"><Shield size={18} /><div><strong>{selectedPlan.name}</strong><span>${selectedPlan.price}/{selectedPlan.billing_period} · {profile?.organization?.name || 'Your isolated workspace'}</span></div></div></div>
            <h3>Step 3 — Select payment method</h3>
            <div className="plans-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
              {PAYMENT_METHODS.map((method) => { const Icon = method.icon; return <button key={method.id} type="button" className={`plan-card ${paymentMethod === method.id ? 'featured' : ''}`} style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => setPaymentMethod(method.id)}><Icon size={24} /><h3 style={{ marginTop: 12 }}>{method.name}</h3><p>{method.description}</p></button>; })}
            </div>
          </div>

          <div className="form-section">
            <h3>Step 4 — Payment proof and transaction data</h3>
            <p className="form-hint">Upload the payment confirmation screenshot and enter the transaction ID/reference exactly as shown by your payment provider.</p>
            <label className="form-field"><span>Transaction ID / payment reference</span><input required value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} placeholder="Example: TRX123456789" /></label>
            <div className="upload-zone"><ImageIcon size={28} /><span>Upload payment proof screenshot</span><input type="file" multiple accept="image/png,image/jpeg,image/webp" onChange={(e) => handleScreenshotAdd(e.target.files)} className="file-input" /></div>
            {screenshots.length > 0 && <div className="uploaded-files">{screenshots.map((file, idx) => <div className="uploaded-file-chip" key={`${file.name}-${idx}`}><ImageIcon size={15} /><span>{file.name}</span><button type="button" onClick={() => removeScreenshot(idx)}><X size={14} /></button></div>)}</div>}
          </div>

          {error && <div className="form-error">{error}</div>}
          <button className="primary-button subscription-submit" disabled={submitting}>{submitting ? <><LoaderCircle size={18} className="spin" /> Submitting request...</> : <>Step 5 — Submit for approval <ArrowUpRight size={17} /></>}</button>
        </form>
      </motion.div>}

      {step === 'submitted' && <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="submitted-screen">
        <div className="submitted-icon"><Check size={48} /></div>
        <h1>Subscription request submitted</h1>
        <p><strong>You will be notified soon.</strong> Your request is now under review by the Sysmobyte admin team.</p>
        <div className="submitted-status">
          <div className="status-step done"><Check size={16} /> Package and plan selected</div>
          <div className="status-step done"><Check size={16} /> Payment method selected</div>
          <div className="status-step done"><Check size={16} /> Transaction data and payment proof submitted</div>
          <div className="status-step active"><LoaderCircle size={16} className="spin" /> Your Request Under Review</div>
          <div className="status-step pending">Workspace activation after admin approval</div>
        </div>
        <p className="submitted-note">Step 6 complete. Your workspace will remain limited until your subscription payment is approved.</p>
      </motion.div>}
    </div>
  </main>;
}
