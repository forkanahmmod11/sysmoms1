import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { AnimatePresence, motion, useScroll, useTransform } from 'framer-motion';
import { isAdminEmail, useAuth } from '@/lib/auth';
import { SuperAdminPanel } from '@/components/SuperAdminPanel';
import { Workspace } from '@/components/Workspace';
import { Reveal, RevealStagger, RevealItem, fadeUp } from '@/lib/motion';
import {
  ArrowUpRight, Check, FolderKanban, LoaderCircle, Sparkles,
  TrendingUp, UsersRound, X, Zap,
} from 'lucide-react';

function App() {
  const { loading, session, profile, offlineAccess, signInWithEmail, signUpWithEmail, signOut } = useAuth();
  const [screen, setScreen] = useState<'landing' | 'auth' | 'app'>('landing');
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authInfo, setAuthInfo] = useState<string | null>(null);
  const [appMode, setAppMode] = useState<'platform' | 'workspace'>('platform');

  useEffect(() => {
    if (loading) return;
    if (session || offlineAccess) {
      setScreen('app');
    } else {
      setScreen('landing');
    }
  }, [loading, session, offlineAccess]);

  const hasSuperAdminAccess = profile?.role === 'super_admin' || isAdminEmail(profile?.email || session?.user?.email || '');

  useEffect(() => {
    if (screen !== 'app') return;
    setAppMode(hasSuperAdminAccess ? 'platform' : 'workspace');
  }, [screen, hasSuperAdminAccess]);

  const enterWorkspace = () => setAppMode('workspace');
  const enterPlatform = () => setAppMode('platform');

  const enterAuth = (mode: 'signin' | 'signup') => {
    setAuthError(null);
    setAuthInfo(null);
    setAuthMode(mode);
    setScreen('auth');
  };

  const handleAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthError(null);
    setAuthInfo(null);
    setAuthLoading(true);
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') || '');
    const password = String(form.get('password') || '');
    try {
      const { error } = authMode === 'signin'
        ? await signInWithEmail(email, password)
        : await signUpWithEmail(email, password);
      if (error) { setAuthError(error); }
      else if (authMode === 'signup') {
        setAuthInfo('Account created successfully. Your workspace is ready.');
        setAppMode('workspace');
      }
    } catch {
      setAuthError('Something went wrong. Please try again.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => { await signOut(); setScreen('landing'); };

  if (loading) return <SplashLoader />;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={screen + (screen === 'app' ? `-${appMode}` : '')}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        style={{ minHeight: '100vh' }}
      >
        {screen === 'auth' && <AuthScreen mode={authMode} loading={authLoading} error={authError} info={authInfo} onSubmit={handleAuth} onBack={() => setScreen('landing')} onSwitchMode={(m) => { setAuthMode(m); setAuthError(null); setAuthInfo(null); }} />}
        {screen === 'app' && (session || offlineAccess) && (appMode === 'platform' && hasSuperAdminAccess
          ? <SuperAdminPanel onLogout={handleLogout} onEnterWorkspace={enterWorkspace} />
          : <Workspace onLogout={handleLogout} onEnterPlatform={hasSuperAdminAccess ? enterPlatform : undefined} />
        )}
        {screen !== 'auth' && !(screen === 'app' && (session || offlineAccess)) && <Landing onLogin={() => enterAuth('signin')} onSignup={() => enterAuth('signup')} />}
      </motion.div>
    </AnimatePresence>
  );
}

function SplashLoader() {
  return <main className="splash-screen"><div className="splash-brand"><Logo light /><div className="splash-dots"><span /><span /><span /></div></div></main>;
}

function Logo({ light = false }: { light?: boolean }) {
  return <div className={`brand ${light ? 'brand-light' : ''}`}><span className="brand-mark"><span /><span /><span /></span><span>sysmo<span className="brand-accent">byte</span></span></div>;
}

function Landing({ onLogin, onSignup }: { onLogin: () => void; onSignup: () => void }) {
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 140]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 0.93]);
  const imageX = useTransform(scrollYProgress, [0, 1], ['-12%', '12%']);

  return (
    <main className="landing-page">
      <nav className="landing-nav">
        <Logo light />
        <div className="landing-links"><a href="#platform">Platform</a><a href="#features">Features</a><a href="#trust">Customers</a></div>
        <div className="nav-actions"><button className="text-button" onClick={onLogin}>Log in</button><button className="primary-button small" onClick={onSignup}>Start free <ArrowUpRight size={15} /></button></div>
      </nav>
      <motion.section className="hero" ref={heroRef} style={{ opacity: heroOpacity }}>
        <motion.div className="hero-copy" style={{ y: heroY }}>
          <motion.img className="hero-copy-background" src="/Shadow.png" alt="" aria-hidden="true" style={{ x: imageX }} />
          <motion.div className="eyebrow" variants={fadeUp} initial="hidden" animate="visible" transition={{ delay: 0.1 }}><span className="eyebrow-bracket" aria-hidden="true" /><span className="eyebrow-dot" /> All-in-one office management platform</motion.div>
          <motion.h1 variants={fadeUp} initial="hidden" animate="visible" transition={{ delay: 0.2, duration: 0.7 }}>The workspace where<br />teams manage <em>projects,</em><br />tasks &amp; workflow.</motion.h1>
          <motion.p variants={fadeUp} initial="hidden" animate="visible" transition={{ delay: 0.4 }}>Sysmobyte unifies project tracking, team collaboration, scheduling, and operations into one focused workspace — so your team ships faster, together.</motion.p>
          <motion.div className="hero-actions" variants={fadeUp} initial="hidden" animate="visible" transition={{ delay: 0.55 }}>
            <button className="primary-button" onClick={onSignup}>Start Free — No Credit Card <ArrowUpRight size={17} /></button>
            <button className="play-button" onClick={onLogin}><span className="play-triangle" /> Watch demo</button>
          </motion.div>
          <motion.div className="hero-trust" variants={fadeUp} initial="hidden" animate="visible" transition={{ delay: 0.7 }}>
            <div className="avatar-stack"><span>AM</span><span>RK</span><span>JD</span><span>SA</span><span>+4k</span></div>
            <span>Loved by <strong>4,000+ teams</strong> worldwide</span>
          </motion.div>
        </motion.div>
        <motion.div className="hero-art" style={{ y: heroY, scale: heroScale }}>
          <div className="hero-glow" />
          <motion.div className="hero-product-mockup" initial={{ opacity: 0, y: 40, rotateY: -12 }} animate={{ opacity: 1, y: 0, rotateY: -6 }} transition={{ delay: 0.5, duration: 1, ease: [0.22, 1, 0.36, 1] }}>
            <div className="mockup-browser-bar">
              <span className="mockup-dot r" /><span className="mockup-dot y" /><span className="mockup-dot g" />
              <div className="mockup-url"><span className="mockup-lock" /> app.sysmobyte.com/dashboard</div>
            </div>
            <div className="mockup-body">
              <div className="mockup-sidebar">
                <div className="mockup-logo-dot" />
                <div className="mockup-nav-item active" /><div className="mockup-nav-item" /><div className="mockup-nav-item" /><div className="mockup-nav-item" /><div className="mockup-nav-item" />
              </div>
              <div className="mockup-content">
                <div className="mockup-header"><div className="mockup-title" /><div className="mockup-avatar" /></div>
                <div className="mockup-stats">
                  <div className="mockup-stat-card"><div className="mockup-stat-icon lime" /><div className="mockup-stat-lines"><span /><span /></div></div>
                  <div className="mockup-stat-card"><div className="mockup-stat-icon cyan" /><div className="mockup-stat-lines"><span /><span /></div></div>
                  <div className="mockup-stat-card"><div className="mockup-stat-icon orange" /><div className="mockup-stat-lines"><span /><span /></div></div>
                </div>
                <div className="mockup-chart-row">
                  <div className="mockup-chart-card">
                    <div className="mockup-chart-title" />
                    <div className="mockup-donut"><span>72%</span></div>
                    <div className="mockup-legend"><span /><span /><span /></div>
                  </div>
                  <div className="mockup-feed-card">
                    <div className="mockup-chart-title" />
                    <div className="mockup-feed-item" /><div className="mockup-feed-item" /><div className="mockup-feed-item" />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
          <motion.div className="floating-card floating-card-top" animate={{ y: [0, -10, 0] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}>
            <div className="mini-icon"><Zap size={15} /></div>
            <div><strong>Team velocity</strong><small>+18.4% this month</small></div>
            <TrendingUp size={20} className="green-icon" />
          </motion.div>
          <motion.div className="floating-card floating-card-bottom" animate={{ y: [0, -10, 0] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 2.2 }}>
            <div className="ring-chart"><span>86%</span></div>
            <div><strong>Project health</strong><small>All systems on track</small></div>
            <Check size={18} className="green-icon" />
          </motion.div>
        </motion.div>
      </motion.section>
      <Reveal className="logo-strip-wrap" delay={0.1}>
        <div className="logo-strip" id="trust">
          <span>Trusted by 4,000+ teams worldwide</span>
          <strong>northstar</strong><strong>arc<span>°</span></strong><strong>MONOCO</strong><strong>vertex<span className="text-blue">/</span></strong><strong>FWD.</strong>
        </div>
      </Reveal>
      <section className="platform-section" id="features">
        <Reveal><div className="section-kicker">A clearer way to work</div></Reveal>
        <Reveal delay={0.1}><h2>Everything your team needs.<br /><span>Nothing it doesn't.</span></h2></Reveal>
        <RevealStagger className="feature-grid">
          <RevealItem><FeatureCard icon={<FolderKanban />} title="Projects that think ahead" text="See every milestone, dependency, and decision in one calm, connected view." /></RevealItem>
          <RevealItem><FeatureCard icon={<UsersRound />} title="People in their flow" text="Give every teammate the context, focus, and autonomy to do their best work." /></RevealItem>
          <RevealItem><FeatureCard icon={<Sparkles />} title="Momentum, made visible" text="Turn daily progress into clear signals your whole organization can act on." /></RevealItem>
        </RevealStagger>
      </section>
      <section className="trust-section" id="platform">
        <Reveal>
          <div className="trust-card">
            <div className="trust-quote">"Sysmobyte replaced four separate tools for our team. Onboarding took minutes, not weeks. Everyone finally sees the same picture."</div>
            <div className="trust-author"><span className="trust-avatar">SA</span><span><strong>Sarah Ahmed</strong><small>Head of Product · Northstar</small></span></div>
          </div>
        </Reveal>
        <RevealStagger className="trust-stats">
          <RevealItem><div className="trust-stat"><strong>4,000+</strong><span>Teams onboarded</span></div></RevealItem>
          <RevealItem><div className="trust-stat"><strong>98.6%</strong><span>Uptime SLA</span></div></RevealItem>
          <RevealItem><div className="trust-stat"><strong>12M+</strong><span>Tasks completed</span></div></RevealItem>
        </RevealStagger>
      </section>
      <footer className="landing-footer"><Logo light /><span>© 2025 Sysmobyte. Built for the way work moves.</span><span>Dhaka · Remote-first</span></footer>
    </main>
  );
}

function FeatureCard({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return <article className="feature-card"><div className="feature-icon">{icon}</div><h3>{title}</h3><p>{text}</p><ArrowUpRight size={18} className="feature-arrow" /></article>;
}

function AuthScreen({ mode, loading, error, info, onSubmit, onBack, onSwitchMode }: {
  mode: 'signin' | 'signup';
  loading: boolean;
  error: string | null;
  info: string | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onBack: () => void;
  onSwitchMode: (mode: 'signin' | 'signup') => void;
}) {
  const isSignup = mode === 'signup';
  return (
    <main className="auth-page">
      <div className="auth-visual">
        <div className="auth-visual-overlay" />
        <nav>
          <button className="back-button" onClick={onBack}><X size={17} /> Close</button>
          <Logo light />
        </nav>
        <div className="auth-quote">
          <span className="quote-mark">&ldquo;</span>
          <h2>Clarity is a competitive advantage.</h2>
          <p>Bring your team's best thinking into focus.</p>
          <div className="quote-author">
            <span className="author-avatar">SA</span>
            <span><strong>Sarah Ahmed</strong><small>Head of Product, Northstar</small></span>
          </div>
        </div>
        <div className="auth-caption"><span>SYS/01</span><span>Human-centered operations</span></div>
      </div>
      <section className="auth-panel">
        <div className="auth-panel-inner">
          <div className="mobile-auth-logo"><Logo /></div>
          <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}>
            <div className="auth-heading">
              <div className="status-pill"><span /> {isSignup ? 'Create your account' : 'Secure workspace access'}</div>
              <h1>{isSignup ? 'Sign up for Sysmobyte' : 'Welcome to your workspace'}</h1>
              <p>{isSignup ? 'Enter your email and a password to create your account.' : 'Enter your email and password to sign in to your workspace.'}</p>
            </div>
            <div className="auth-mode-tabs">
              <button type="button" className={mode === 'signin' ? 'selected' : ''} onClick={() => onSwitchMode('signin')}>Sign in</button>
              <button type="button" className={mode === 'signup' ? 'selected' : ''} onClick={() => onSwitchMode('signup')}>Sign up</button>
            </div>
            <form onSubmit={onSubmit}>
              <label>Work email<input type="email" name="email" placeholder="you@company.com" required /></label>
              <label>Password<input type="password" name="password" placeholder={isSignup ? 'Choose a password (min 8 chars)' : 'Your password'} minLength={8} required /></label>
              {error && <div className="auth-error">{error}</div>}
              {info && <div className="auth-info">{info}</div>}
              <button className="primary-button auth-submit" disabled={loading}>
                {loading
                  ? <><LoaderCircle size={18} className="spin" /> {isSignup ? 'Creating account...' : 'Signing in...'}</>
                  : <>{isSignup ? 'Create account' : 'Sign in'} <ArrowUpRight size={17} /></>}
              </button>
            </form>
            <p className="legal">By continuing, you agree to Sysmobyte's <u>Terms</u> and <u>Privacy Policy</u>.</p>
          </motion.div>
        </div>
      </section>
    </main>
  );
}

export default App;
