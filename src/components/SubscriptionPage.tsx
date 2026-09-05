import { useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/auth';
import { PLANS, submitRequest, uploadFile, type Plan } from '@/lib/subscription';
import {
  ArrowUpRight, Check, CloudUpload, FileText, Image as ImageIcon,
  LoaderCircle, Shield, Sparkles, X, Zap,
} from 'lucide-react';

type Step = 'plans' | 'details' | 'submitted';

export function SubscriptionPage({ onLogout }: { onLogout: () => void }) {
  const { profile, user, offlineAccess } = useAuth();
  const [step, setStep] = useState<Step>('plans');
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [orgName, setOrgName] = useState('');
  const [documents, setDocuments] = useState<File[]>([]);
  const [screenshots, setScreenshots] = useState<File[]>([]);
  const [docUrls, setDocUrls] = useState<string[]>([]);
  const [screenshotUrls, setScreenshotUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userId = user?.id || profile?.id || 'offline-user';
  const userEmail = user?.email || profile?.email || '';
  const userName = profile?.fullName || userEmail.split('@')[0];

  const handleSelectPlan = (plan: Plan) => {
    setSelectedPlan(plan);
    setStep('details');
  };

  const handleDocAdd = (files: FileList | null) => {
    if (files) setDocuments((prev) => [...prev, ...Array.from(files)]);
  };
  const handleScreenshotAdd = (files: FileList | null) => {
    if (files) setScreenshots((prev) => [...prev, ...Array.from(files)]);
  };

  const removeDoc = (idx: number) => setDocuments((prev) => prev.filter((_, i) => i !== idx));
  const removeScreenshot = (idx: number) => setScreenshots((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedPlan) return;
    if (!orgName.trim()) { setError('Please enter your organization name.'); return; }
    if (documents.length === 0 && screenshots.length === 0) {
      setError('Please upload at least one document or screenshot.');
      return;
    }

    setError(null);
    setSubmitting(true);
    setUploading(true);

    try {
      const uploadedDocs: string[] = [];
      for (const file of documents) {
        const url = await uploadFile(userId, file);
        uploadedDocs.push(url);
      }
      setDocUrls(uploadedDocs);

      const uploadedShots: string[] = [];
      for (const file of screenshots) {
        const url = await uploadFile(userId, file);
        uploadedShots.push(url);
      }
      setScreenshotUrls(uploadedShots);

      setUploading(false);

      await submitRequest({
        userId,
        userEmail,
        userName,
        planId: selectedPlan.id,
        planName: selectedPlan.name,
        organizationName: orgName.trim(),
        documentUrls: uploadedDocs,
        screenshotUrls: uploadedShots,
      });

      setStep('submitted');
    } catch {
      setError('Something went wrong during submission. Please try again.');
    } finally {
      setUploading(false);
      setSubmitting(false);
    }
  };

  return (
    <main className="subscription-page">
      <nav className="subscription-nav">
        <div className="brand"><span className="brand-mark"><span /><span /><span /></span><span>sysmo<span className="brand-accent">byte</span></span></div>
        <div className="nav-actions">
          <span className="nav-user">{userName}</span>
          <button className="text-button" onClick={onLogout}>Sign out</button>
        </div>
      </nav>

      <div className="subscription-container">
        {step === 'plans' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <div className="subscription-header">
              <div className="eyebrow dark"><span className="eyebrow-dot" /> Choose your plan</div>
              <h1>Start your workspace journey</h1>
              <p>Select a subscription plan to activate your Office Management System. After submission, our admin will review your request and grant you access.</p>
            </div>
            <div className="plans-grid">
              {PLANS.map((plan, idx) => (
                <motion.div
                  key={plan.id}
                  className={`plan-card ${plan.name === 'Professional' ? 'featured' : ''}`}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 + 0.2, duration: 0.5 }}
                >
                  {plan.name === 'Professional' && <div className="plan-badge"><Sparkles size={13} /> Most popular</div>}
                  <div className="plan-header">
                    <h2>{plan.name}</h2>
                    <div className="plan-price">
                      <span className="plan-amount">${plan.price}</span>
                      <span className="plan-period">/{plan.billing_period}</span>
                    </div>
                    <p>{plan.description}</p>
                  </div>
                  <ul className="plan-features">
                    {plan.features.map((f) => (
                      <li key={f}><Check size={15} /> {f}</li>
                    ))}
                  </ul>
                  <button className={`primary-button ${plan.name === 'Professional' ? '' : 'secondary-button'}`} onClick={() => handleSelectPlan(plan)}>
                    Select {plan.name} <ArrowUpRight size={16} />
                  </button>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {step === 'details' && selectedPlan && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35 }}>
            <div className="subscription-header">
              <button className="back-button" onClick={() => setStep('plans')}><X size={16} /> Back to plans</button>
              <div className="eyebrow dark"><span className="eyebrow-dot" /> {selectedPlan.name} plan</div>
              <h1>Submit your access request</h1>
              <p>Upload the required documents and screenshots. Our admin will review and approve your request to activate your isolated workspace.</p>
            </div>

            <form className="subscription-form" onSubmit={handleSubmit}>
              <div className="form-section">
                <label className="form-field">
                  <span>Organization / Workspace name</span>
                  <input
                    type="text"
                    name="org_name"
                    placeholder="e.g. Acme Corporation"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    required
                  />
                </label>
                <div className="selected-plan-card">
                  <div className="selected-plan-info">
                    <Shield size={18} />
                    <div>
                      <strong>{selectedPlan.name}</strong>
                      <span>${selectedPlan.price}/{selectedPlan.billing_period}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3>Required documents</h3>
                <p className="form-hint">Upload business registration, ID, or any relevant documents (PDF, DOC, images).</p>
                <div className="upload-zone">
                  <CloudUpload size={28} />
                  <span>Click to browse or drag files here</span>
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.webp"
                    onChange={(e) => handleDocAdd(e.target.files)}
                    className="file-input"
                  />
                </div>
                {documents.length > 0 && (
                  <div className="uploaded-files">
                    {documents.map((file, idx) => (
                      <div className="uploaded-file-chip" key={idx}>
                        <FileText size={15} />
                        <span>{file.name}</span>
                        <button type="button" onClick={() => removeDoc(idx)}><X size={14} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="form-section">
                <h3>Screenshots</h3>
                <p className="form-hint">Upload screenshots of your business or any supporting images.</p>
                <div className="upload-zone">
                  <ImageIcon size={28} />
                  <span>Click to browse or drag images here</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) => handleScreenshotAdd(e.target.files)}
                    className="file-input"
                  />
                </div>
                {screenshots.length > 0 && (
                  <div className="uploaded-files">
                    {screenshots.map((file, idx) => (
                      <div className="uploaded-file-chip" key={idx}>
                        <ImageIcon size={15} />
                        <span>{file.name}</span>
                        <button type="button" onClick={() => removeScreenshot(idx)}><X size={14} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {error && <div className="auth-error">{error}</div>}

              <button className="primary-button subscription-submit" disabled={submitting}>
                {submitting ? (
                  <><LoaderCircle size={18} className="spin" /> {uploading ? 'Uploading files...' : 'Submitting request...'}</>
                ) : (
                  <><Zap size={17} /> Submit for approval <ArrowUpRight size={16} /></>
                )}
              </button>
            </form>
          </motion.div>
        )}

        {step === 'submitted' && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }} className="submitted-screen">
            <div className="submitted-icon"><Check size={48} /></div>
            <h1>Request submitted successfully</h1>
            <p>Your subscription request for <strong>{selectedPlan?.name}</strong> has been submitted. Our admin team will review your documents and approve your workspace access shortly.</p>
            <div className="submitted-status">
              <div className="status-step done"><Check size={16} /> Account created</div>
              <div className="status-step done"><Check size={16} /> Plan selected: {selectedPlan?.name}</div>
              <div className="status-step done"><Check size={16} /> Documents uploaded</div>
              <div className="status-step active"><LoaderCircle size={16} className="spin" /> Pending admin approval</div>
              <div className="status-step pending">Workspace activation</div>
            </div>
            <p className="submitted-note">
              You'll be notified once your request is reviewed. Please check back by refreshing this page.
              <button className="link-button" onClick={() => window.location.reload()}>Refresh now</button>
            </p>
          </motion.div>
        )}
      </div>
    </main>
  );
}
