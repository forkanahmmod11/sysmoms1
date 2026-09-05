import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/auth';
import { getUserRequest, type SubscriptionRequest } from '@/lib/subscription';
import { Check, Clock3, LoaderCircle, X, Zap } from 'lucide-react';

export function PendingApproval({ onLogout, onApproved }: { onLogout: () => void; onApproved: () => void }) {
  const { profile, user, offlineAccess } = useAuth();
  const [request, setRequest] = useState<SubscriptionRequest | null>(null);
  const [loading, setLoading] = useState(true);

  const userId = user?.id || profile?.id || 'offline-user';

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    const check = async () => {
      const req = await getUserRequest(userId);
      setRequest(req);
      setLoading(false);
      if (req?.status === 'approved') {
        onApproved();
      }
    };
    check();
    interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, [userId, onApproved]);

  return (
    <main className="subscription-page">
      <nav className="subscription-nav">
        <div className="brand"><span className="brand-mark"><span /><span /><span /></span><span>sysmo<span className="brand-accent">byte</span></span></div>
        <div className="nav-actions">
          <span className="nav-user">{profile?.fullName || 'User'}</span>
          <button className="text-button" onClick={onLogout}>Sign out</button>
        </div>
      </nav>

      <div className="subscription-container">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="pending-screen">
          {loading ? (
            <div className="pending-loading"><LoaderCircle size={32} className="spin" /></div>
          ) : (
            <>
              <div className={`pending-icon ${request?.status || 'pending'}`}>
                {request?.status === 'rejected' ? <X size={48} /> : <Clock3 size={48} />}
              </div>
              <h1>{request?.status === 'rejected' ? 'Request rejected' : 'Awaiting admin approval'}</h1>
              <p>
                {request?.status === 'rejected'
                  ? `Your subscription request was not approved. ${request?.admin_notes || 'Please contact support for more information.'}`
                  : 'Your subscription request has been submitted and is waiting for admin review. Your workspace will be activated automatically once approved.'}
              </p>

              {request && (
                <div className="pending-details">
                  <div className="pending-detail-row">
                    <span>Plan</span>
                    <strong>{request.plan_name}</strong>
                  </div>
                  <div className="pending-detail-row">
                    <span>Organization</span>
                    <strong>{request.organization_name}</strong>
                  </div>
                  <div className="pending-detail-row">
                    <span>Submitted</span>
                    <strong>{new Date(request.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</strong>
                  </div>
                  <div className="pending-detail-row">
                    <span>Status</span>
                    <strong className={`status-badge ${request.status}`}>{request.status}</strong>
                  </div>
                </div>
              )}

              {request?.status === 'pending' && (
                <div className="pending-status-flow">
                  <div className="status-step done"><Check size={16} /> Request submitted</div>
                  <div className="status-step active"><LoaderCircle size={16} className="spin" /> Under review</div>
                  <div className="status-step pending">Workspace activation</div>
                </div>
              )}

              {request?.status === 'rejected' && (
                <button className="primary-button" onClick={() => window.location.reload()}>
                  <Zap size={16} /> Submit a new request
                </button>
              )}

              {request?.status === 'pending' && (
                <p className="pending-note">
                  This page checks automatically every few seconds. You can also
                  <button className="link-button" onClick={() => window.location.reload()}>refresh manually</button>.
                </p>
              )}
            </>
          )}
        </motion.div>
      </div>
    </main>
  );
}
