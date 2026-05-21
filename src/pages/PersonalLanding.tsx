import { Link } from 'react-router-dom';
import {
  CreditCard,
  Eye,
  Landmark,
  TrendingDown,
  User,
  Users,
  Briefcase,
  ArrowRight,
  ClipboardList,
  LayoutDashboard,
  Bell,
  Sparkles,
  ChevronRight,
  Menu,
  X,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

/* ──────────────────────────────────────
   Scroll-reveal hook (IntersectionObserver)
   ────────────────────────────────────── */
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, visible };
}

/* ──────────────────────────────────────
   Component
   ────────────────────────────────────── */
export default function PersonalLanding() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  /* refs for scroll-reveal per section */
  const hero = useReveal();
  const problem = useReveal();
  const profiles = useReveal();
  const signals = useReveal();
  const howItWorks = useReveal();
  const finalCta = useReveal();

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMobileMenuOpen(false);
  };

  return (
    <div className="personal-landing" style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      {/* ── inline styles scoped via wrapper class ── */}
      <style>{`
        /* ─── BASE ─── */
        .personal-landing {
          --pl-bg: #0a0a0f;
          --pl-bg-card: #12121a;
          --pl-border: #1e1e2e;
          --pl-text: #f0f0f5;
          --pl-text-secondary: #b4b4cc;
          --pl-accent-start: #6C5CE7;
          --pl-accent-end: #a78bfa;
          --pl-glow: rgba(108, 92, 231, 0.35);

          min-height: 100vh;
          background: var(--pl-bg);
          color: var(--pl-text);
          overflow-x: hidden;
        }

        /* ─── ANIMATED GRADIENT BG (hero) ─── */
        .pl-hero-bg {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse 80% 50% at 50% -20%, rgba(108,92,231,0.25) 0%, transparent 70%),
            radial-gradient(ellipse 60% 40% at 80% 110%, rgba(167,139,250,0.14) 0%, transparent 60%);
          animation: pl-drift 12s ease-in-out infinite alternate;
        }
        @keyframes pl-drift {
          0%   { opacity: .85; transform: scale(1); }
          100% { opacity: 1;   transform: scale(1.05); }
        }

        /* ─── REVEAL ANIMATION ─── */
        .pl-reveal {
          opacity: 0;
          transform: translateY(32px);
          transition: opacity 0.7s cubic-bezier(.22,1,.36,1), transform 0.7s cubic-bezier(.22,1,.36,1);
        }
        .pl-reveal.pl-visible {
          opacity: 1;
          transform: translateY(0);
        }

        /* stagger children */
        .pl-reveal.pl-visible .pl-stagger > * {
          opacity: 0;
          animation: pl-stagger-in 0.5s ease forwards;
        }
        .pl-reveal.pl-visible .pl-stagger > *:nth-child(1) { animation-delay: 0.08s; }
        .pl-reveal.pl-visible .pl-stagger > *:nth-child(2) { animation-delay: 0.16s; }
        .pl-reveal.pl-visible .pl-stagger > *:nth-child(3) { animation-delay: 0.24s; }
        .pl-reveal.pl-visible .pl-stagger > *:nth-child(4) { animation-delay: 0.32s; }
        @keyframes pl-stagger-in {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ─── CARD ─── */
        .pl-card {
          background: var(--pl-bg-card);
          border: 1px solid var(--pl-border);
          border-radius: 16px;
          padding: 28px 24px;
          transition: transform 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
        }
        .pl-card:hover {
          transform: translateY(-4px);
          border-color: var(--pl-accent-start);
          box-shadow: 0 0 24px var(--pl-glow);
        }

        /* ─── HIGHLIGHT CARD ─── */
        .pl-card-highlight {
          background: linear-gradient(135deg, rgba(108,92,231,0.12) 0%, rgba(167,139,250,0.06) 100%);
          border: 2px solid var(--pl-accent-start);
          box-shadow: 0 0 32px var(--pl-glow);
        }

        /* ─── BUTTONS ─── */
        .pl-btn-primary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 14px 32px;
          font-weight: 600;
          font-size: 16px;
          border-radius: 14px;
          border: none;
          cursor: pointer;
          background: linear-gradient(135deg, var(--pl-accent-start), var(--pl-accent-end));
          color: #fff;
          box-shadow: 0 4px 28px var(--pl-glow), 0 0 0 1px rgba(167,139,250,0.2);
          transition: transform 0.2s ease, box-shadow 0.3s ease, filter 0.3s ease;
          text-decoration: none;
        }
        .pl-btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 32px rgba(108,92,231,0.5);
          filter: brightness(1.1);
        }
        .pl-btn-primary:active { transform: translateY(0); }

        .pl-btn-outline {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 14px 32px;
          font-weight: 600;
          font-size: 16px;
          border-radius: 14px;
          cursor: pointer;
          background: transparent;
          color: var(--pl-text);
          border: 2px solid #2e2e44;
          transition: border-color 0.3s ease, background 0.3s ease, transform 0.2s ease;
          text-decoration: none;
        }
        .pl-btn-outline:hover {
          border-color: var(--pl-accent-start);
          background: rgba(108,92,231,0.12);
          transform: translateY(-2px);
          box-shadow: 0 0 16px rgba(108,92,231,0.15);
        }

        /* ─── BADGE ─── */
        .pl-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 16px;
          font-size: 13px;
          font-weight: 600;
          border-radius: 100px;
          background: rgba(108,92,231,0.15);
          color: var(--pl-accent-end);
          border: 1px solid rgba(108,92,231,0.25);
        }

        /* ─── SIGNAL CARD ─── */
        .pl-signal {
          background: var(--pl-bg-card);
          border: 1px solid var(--pl-border);
          border-radius: 12px;
          padding: 20px 24px;
          font-size: 15px;
          line-height: 1.6;
          color: var(--pl-text);
          position: relative;
          transition: border-color 0.3s ease, box-shadow 0.3s ease;
        }
        .pl-signal:hover {
          border-color: var(--pl-accent-start);
          box-shadow: 0 0 16px var(--pl-glow);
        }
        .pl-signal::before {
          content: '';
          position: absolute;
          left: 0;
          top: 12px;
          bottom: 12px;
          width: 4px;
          border-radius: 4px;
          background: linear-gradient(to bottom, var(--pl-accent-start), var(--pl-accent-end));
        }

        /* ─── STEP ─── */
        .pl-step-number {
          width: 48px;
          height: 48px;
          min-width: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 20px;
          border-radius: 14px;
          background: linear-gradient(135deg, var(--pl-accent-start), var(--pl-accent-end));
          color: #fff;
          box-shadow: 0 0 20px var(--pl-glow);
        }

        /* ─── SECTION DIVIDER GLOW ─── */
        .pl-divider {
          height: 1px;
          background: linear-gradient(to right, transparent, var(--pl-accent-start), transparent);
          opacity: 0.3;
          margin: 0;
        }

        /* ─── CONTAINER ─── */
        .pl-container {
          max-width: 1200px;
          margin: 0 auto;
          padding-left: 24px;
          padding-right: 24px;
        }

        /* ─── HEADER ─── */
        .pl-header {
          position: sticky;
          top: 0;
          z-index: 50;
          background: rgba(10,10,15,0.88);
          backdrop-filter: blur(16px);
          border-bottom: 1px solid var(--pl-border);
        }

        /* ─── SCROLL OFFSET for sticky header ─── */
        .pl-scroll-target {
          scroll-margin-top: 88px;
        }

        /* ─── MOBILE MENU ─── */
        .pl-mobile-menu {
          position: fixed;
          inset: 0;
          z-index: 100;
          background: rgba(10,10,15,0.97);
          backdrop-filter: blur(20px);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 32px;
          animation: pl-fade-in 0.2s ease;
        }
        @keyframes pl-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        /* ─── COMING SOON BADGE ─── */
        .pl-coming-soon {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 10px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-radius: 6px;
          background: rgba(167,139,250,0.12);
          color: var(--pl-accent-end);
          border: 1px solid rgba(167,139,250,0.2);
        }

        /* ─── RESPONSIVE ─── */
        .pl-hero-ctas {
          display: flex;
          flex-direction: column;
          gap: 16px;
          align-items: center;
        }
        @media (min-width: 640px) {
          .pl-hero-ctas {
            flex-direction: row;
            justify-content: center;
          }
        }

        .pl-nav-desktop {
          display: none;
          align-items: center;
          gap: 32px;
        }
        .pl-mobile-toggle {
          display: block;
        }
        @media (min-width: 768px) {
          .pl-nav-desktop {
            display: flex;
          }
          .pl-mobile-toggle {
            display: none;
          }
        }

        .pl-footer-inner {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }
        @media (min-width: 640px) {
          .pl-footer-inner {
            flex-direction: row;
            justify-content: space-between;
          }
        }

        @media (max-width: 768px) {
          .pl-btn-primary, .pl-btn-outline {
            width: 100%;
            text-align: center;
          }
        }
      `}</style>

      {/* ═══════════════════════════════════════
          1. HEADER
          ═══════════════════════════════════════ */}
      <header className="pl-header">
        <div className="pl-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 72 }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/aurys-logo.png" alt="Aurys" style={{ height: 36 }} />
            <span style={{
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--pl-accent-end)',
              letterSpacing: '0.5px',
              background: 'rgba(108,92,231,0.12)',
              padding: '3px 10px',
              borderRadius: 6,
            }}>
              Personal
            </span>
          </div>

          {/* Desktop nav */}
          <nav className="pl-nav-desktop">
            <button
              onClick={() => scrollTo('como-funciona')}
              style={{ background: 'none', border: 'none', color: 'var(--pl-text-secondary)', cursor: 'pointer', fontSize: 14, fontWeight: 500, transition: 'color 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--pl-text)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--pl-text-secondary)')}
            >
              Como funciona
            </button>
            <button
              onClick={() => scrollTo('perfis')}
              style={{ background: 'none', border: 'none', color: 'var(--pl-text-secondary)', cursor: 'pointer', fontSize: 14, fontWeight: 500, transition: 'color 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--pl-text)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--pl-text-secondary)')}
            >
              Para quem é
            </button>
            <Link
              to="/login"
              style={{ color: 'var(--pl-text-secondary)', fontSize: 14, fontWeight: 500, textDecoration: 'none', transition: 'color 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--pl-text)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--pl-text-secondary)')}
            >
              Entrar
            </Link>
            <Link to="/login?product=personal" className="pl-btn-primary" style={{ padding: '10px 24px', fontSize: 14 }}>
              Começar grátis
            </Link>
          </nav>

          {/* Mobile hamburger */}
          <button
            className="pl-mobile-toggle"
            onClick={() => setMobileMenuOpen(true)}
            style={{ background: 'none', border: 'none', color: 'var(--pl-text)', cursor: 'pointer' }}
            aria-label="Abrir menu"
          >
            <Menu size={24} />
          </button>
        </div>
      </header>

      {/* Mobile overlay menu */}
      {mobileMenuOpen && (
        <div className="pl-mobile-menu">
          <button
            onClick={() => setMobileMenuOpen(false)}
            style={{ position: 'absolute', top: 20, right: 24, background: 'none', border: 'none', color: 'var(--pl-text)', cursor: 'pointer' }}
            aria-label="Fechar menu"
          >
            <X size={28} />
          </button>
          <button onClick={() => scrollTo('como-funciona')} style={{ background: 'none', border: 'none', color: 'var(--pl-text)', fontSize: 20, fontWeight: 600, cursor: 'pointer' }}>Como funciona</button>
          <button onClick={() => scrollTo('perfis')} style={{ background: 'none', border: 'none', color: 'var(--pl-text)', fontSize: 20, fontWeight: 600, cursor: 'pointer' }}>Para quem é</button>
          <Link to="/login" onClick={() => setMobileMenuOpen(false)} style={{ color: 'var(--pl-text)', fontSize: 20, fontWeight: 600, textDecoration: 'none' }}>Entrar</Link>
          <Link to="/login?product=personal" className="pl-btn-primary" style={{ marginTop: 16 }} onClick={() => setMobileMenuOpen(false)}>
            Começar grátis
          </Link>
        </div>
      )}

      {/* ═══════════════════════════════════════
          2. HERO
          ═══════════════════════════════════════ */}
      <section style={{ position: 'relative', overflow: 'hidden', paddingTop: 80, paddingBottom: 96 }}>
        <div className="pl-hero-bg" />
        <div
          ref={hero.ref}
          className={`pl-container pl-reveal${hero.visible ? ' pl-visible' : ''}`}
          style={{ position: 'relative', zIndex: 1, maxWidth: 720, textAlign: 'center', margin: '0 auto' }}
        >
          <div className="pl-badge" style={{ marginBottom: 28 }}>
            <Sparkles size={14} />
            Finanças pessoais com clareza
          </div>

          <h1 style={{ fontSize: 'clamp(32px, 5vw, 56px)', fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.02em', marginBottom: 24 }}>
            Entenda para onde seu dinheiro está indo
          </h1>

          <p style={{ fontSize: 'clamp(16px, 2vw, 20px)', color: 'var(--pl-text-secondary)', lineHeight: 1.65, marginBottom: 40, maxWidth: 600, marginLeft: 'auto', marginRight: 'auto' }}>
            O Aurys Personal organiza bancos, cartões, contas e gastos em uma visão simples — sem linguagem de empresa, sem planilhas complicadas.
          </p>

          <div className="pl-hero-ctas">
            <Link to="/login?product=personal" className="pl-btn-primary">
              Começar grátis
              <ArrowRight size={18} />
            </Link>
            <button onClick={() => scrollTo('como-funciona')} className="pl-btn-outline">
              Ver como funciona
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </section>

      <div className="pl-divider" />

      {/* ═══════════════════════════════════════
          3. O PROBLEMA
          ═══════════════════════════════════════ */}
      <section style={{ padding: '96px 0' }}>
        <div
          ref={problem.ref}
          className={`pl-container pl-reveal${problem.visible ? ' pl-visible' : ''}`}
          style={{ textAlign: 'center' }}
        >
          <h2 style={{ fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 700, marginBottom: 16, letterSpacing: '-0.01em' }}>
            Seu dinheiro está espalhado demais?
          </h2>
          <p style={{ fontSize: 18, color: 'var(--pl-text-secondary)', maxWidth: 560, margin: '0 auto 56px', lineHeight: 1.65 }}>
            Banco, cartão, compras parceladas, contas fixas, Pix e assinaturas. No fim do mês, fica difícil saber para onde o dinheiro foi.
          </p>

          <div className="pl-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
            {[
              { icon: <CreditCard size={24} />, title: 'Cartão fora de controle', text: 'Fatura atual, futura e parcelas comprometidas.' },
              { icon: <Eye size={24} />, title: 'Gastos invisíveis', text: 'Entenda onde o dinheiro está escapando.' },
              { icon: <Landmark size={24} />, title: 'Contas espalhadas', text: 'Bancos, cartões e contas em uma só visão.' },
              { icon: <TrendingDown size={24} />, title: 'Sem previsão', text: 'Saiba antes se o mês vai fechar apertado.' },
            ].map(card => (
              <div key={card.title} className="pl-card" style={{ textAlign: 'left' }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 12,
                  background: 'linear-gradient(135deg, rgba(108,92,231,0.15), rgba(167,139,250,0.08))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--pl-accent-end)', marginBottom: 16,
                }}>
                  {card.icon}
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>{card.title}</h3>
                <p style={{ fontSize: 15, color: 'var(--pl-text-secondary)', lineHeight: 1.55 }}>{card.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="pl-divider" />

      {/* ═══════════════════════════════════════
          4. PERFIS
          ═══════════════════════════════════════ */}
      <section id="perfis" className="pl-scroll-target" style={{ padding: '96px 0' }}>
        <div
          ref={profiles.ref}
          className={`pl-container pl-reveal${profiles.visible ? ' pl-visible' : ''}`}
          style={{ textAlign: 'center' }}
        >
          <h2 style={{ fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 700, marginBottom: 56, letterSpacing: '-0.01em' }}>
            Como você quer usar o Aurys Personal?
          </h2>

          <div className="pl-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24, maxWidth: 900, margin: '0 auto' }}>
            {/* Pessoa Física — destaque */}
            <div className="pl-card pl-card-highlight" style={{ textAlign: 'left' }}>
              <div style={{
                width: 52, height: 52, borderRadius: 14,
                background: 'linear-gradient(135deg, var(--pl-accent-start), var(--pl-accent-end))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', marginBottom: 20,
                boxShadow: '0 0 24px var(--pl-glow)',
              }}>
                <User size={26} />
              </div>
              <h3 style={{ fontSize: 19, fontWeight: 700, marginBottom: 8, color: '#fff' }}>Pessoa física</h3>
              <p style={{ fontSize: 15, color: 'var(--pl-text)', lineHeight: 1.55 }}>
                Bancos, cartões, gastos, contas e visão do mês.
              </p>
            </div>

            {/* Família / Casal */}
            <div className="pl-card" style={{ textAlign: 'left' }}>
              <div style={{
                width: 52, height: 52, borderRadius: 14,
                background: 'rgba(108,92,231,0.10)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--pl-accent-end)', marginBottom: 20,
              }}>
                <Users size={26} />
              </div>
              <h3 style={{ fontSize: 19, fontWeight: 700, marginBottom: 8 }}>Família / casal</h3>
              <p style={{ fontSize: 15, color: 'var(--pl-text-secondary)', lineHeight: 1.55 }}>
                Organize despesas da casa e acompanhe compromissos juntos.
              </p>
            </div>

            {/* Modo Dono — em breve */}
            <div className="pl-card" style={{ textAlign: 'left', opacity: 0.7 }}>
              <div style={{
                width: 52, height: 52, borderRadius: 14,
                background: 'rgba(108,92,231,0.06)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--pl-text-secondary)', marginBottom: 20,
              }}>
                <Briefcase size={26} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <h3 style={{ fontSize: 19, fontWeight: 700 }}>Modo dono</h3>
                <span className="pl-coming-soon">em breve</span>
              </div>
              <p style={{ fontSize: 15, color: 'var(--pl-text-secondary)', lineHeight: 1.55 }}>
                Para separar vida pessoal e negócio.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="pl-divider" />

      {/* ═══════════════════════════════════════
          5. SINAIS FINANCEIROS
          ═══════════════════════════════════════ */}
      <section style={{ padding: '96px 0' }}>
        <div
          ref={signals.ref}
          className={`pl-container pl-reveal${signals.visible ? ' pl-visible' : ''}`}
        >
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <h2 style={{ fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 700, marginBottom: 16, letterSpacing: '-0.01em' }}>
              Mais do que registrar gastos. Entender suas escolhas.
            </h2>
            <p style={{ fontSize: 18, color: 'var(--pl-text-secondary)', maxWidth: 560, margin: '0 auto', lineHeight: 1.65 }}>
              O Aurys Personal interpreta seus dados e mostra sinais simples para você agir antes do mês apertar.
            </p>
          </div>

          <div className="pl-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, maxWidth: 800, margin: '0 auto' }}>
            {[
              'Sua fatura já compromete 42% da renda prevista deste mês.',
              'Você gastou 28% a mais em alimentação fora de casa comparado ao mês anterior.',
              'Você tem R$ 1.850 em parcelas comprometidas nos próximos 3 meses.',
              'Se mantiver esse ritmo, o mês pode fechar R$ 730 negativo.',
            ].map((text) => (
              <div key={text} className="pl-signal" style={{ paddingLeft: 28 }}>
                {text}
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="pl-divider" />

      {/* ═══════════════════════════════════════
          6. COMO FUNCIONA
          ═══════════════════════════════════════ */}
      <section id="como-funciona" className="pl-scroll-target" style={{ padding: '96px 0' }}>
        <div
          ref={howItWorks.ref}
          className={`pl-container pl-reveal${howItWorks.visible ? ' pl-visible' : ''}`}
          style={{ textAlign: 'center' }}
        >
          <h2 style={{ fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 700, marginBottom: 56, letterSpacing: '-0.01em' }}>
            Comece pelo básico
          </h2>

          <div className="pl-stagger" style={{ display: 'flex', flexDirection: 'column', gap: 0, maxWidth: 560, margin: '0 auto' }}>
            {[
              { icon: <ClipboardList size={22} />, text: 'Cadastre suas contas e cartões' },
              { icon: <CreditCard size={22} />, text: 'Registre gastos, contas e parcelas' },
              { icon: <LayoutDashboard size={22} />, text: 'Veja o mês em uma única visão' },
              { icon: <Bell size={22} />, text: 'Receba alertas simples antes de apertar' },
            ].map((step, i) => (
              <div key={step.text} style={{ display: 'flex', alignItems: 'flex-start', gap: 20, textAlign: 'left' }}>
                {/* Vertical line connector */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div className="pl-step-number">{i + 1}</div>
                  {i < 3 && (
                    <div style={{
                      width: 2, height: 48,
                      background: 'linear-gradient(to bottom, var(--pl-accent-start), transparent)',
                      opacity: 0.3,
                    }} />
                  )}
                </div>
                <div style={{ paddingTop: 12, paddingBottom: i < 3 ? 24 : 0 }}>
                  <p style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.5 }}>{step.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="pl-divider" />

      {/* ═══════════════════════════════════════
          7. CTA FINAL + FOOTER
          ═══════════════════════════════════════ */}
      <section style={{
        padding: '96px 0 64px',
        background: 'linear-gradient(to bottom, transparent, rgba(108,92,231,0.06) 40%, rgba(108,92,231,0.03) 100%)',
      }}>
        <div
          ref={finalCta.ref}
          className={`pl-container pl-reveal${finalCta.visible ? ' pl-visible' : ''}`}
          style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto' }}
        >
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, marginBottom: 16, letterSpacing: '-0.02em' }}>
            Comece organizando o que mais pesa
          </h2>
          <p style={{ fontSize: 18, color: 'var(--pl-text-secondary)', lineHeight: 1.65, marginBottom: 40 }}>
            Bancos, cartões e gastos. Simples para começar. Inteligente para evoluir.
          </p>
          <Link to="/login?product=personal" className="pl-btn-primary" style={{ padding: '18px 40px', fontSize: 18 }}>
            Criar meu Aurys Personal
            <ArrowRight size={20} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--pl-border)',
        padding: '32px 0',
      }}>
        <div className="pl-container pl-footer-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: 0.7 }}>
            <img src="/aurys-logo.png" alt="Aurys" style={{ height: 28 }} />
          </div>
          <p style={{ fontSize: 13, color: 'var(--pl-text-secondary)', opacity: 0.8 }}>
            aurys.com.br/personal
          </p>
        </div>
      </footer>
    </div>
  );
}
