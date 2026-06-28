"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Globe from '@/components/Globe';
import Toast, { showToast } from '@/components/Toast';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useTranslations } from '@/lib/i18n';

export default function Login() {
  const router = useRouter();
  const { t } = useTranslations();
  useEffect(() => { document.title = t('login.title'); }, [t]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [resetSent, setResetSent] = useState('');

  const getRedirectPath = () => {
    const params = new URLSearchParams(window.location.search);
    const next = params.get('next') || '/app/dashboard';
    const plan = params.get('plan');
    const ref = params.get('ref');
    if (ref) { try { localStorage.setItem('pending_ref', ref); } catch { /* ignore */ } }
    return plan ? `${next}?plan=${encodeURIComponent(plan)}` : next;
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            setMessage(t('login.errors.invalidCredentials'));
            return;
          }
          if (error.message.includes('Email not confirmed')) {
            setMessage(t('login.errors.emailNotConfirmed'));
            return;
          }
          throw error;
        }
        router.push(getRedirectPath());
      } else {
        const { error, data } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage(t('login.errors.signupSuccess'));
        setEmail('');
        setPassword('');
        // Envia email de boas-vindas (non-blocking)
        fetch('/api/email/welcome', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, name: email.split('@')[0] }),
        }).catch(() => {});
        // Agenda drip de nurture (non-blocking)
        if (data?.user?.id) {
          fetch('/api/drip/schedule', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: data.user.id, email, name: email.split('@')[0] }),
          }).catch(() => {});
        }
      }
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : t('login.errors.unexpected'));
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/auth/callback?next=' + encodeURIComponent(getRedirectPath()),
        flowType: 'pkce',
      },
    });
    if (error) {
      showToast(t('login.googleError') + ' ' + error.message, 'error');
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setResetSent(t('login.enterEmailFirst'));
      return;
    }
    setLoading(true);
    setResetSent('');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/login',
      });
      if (error) throw error;
      setResetSent(t('login.forgotSent'));
      setMessage('');
    } catch (error: unknown) {
      setResetSent(t('login.forgotError') + ' ' + (error instanceof Error ? error.message : ''));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell min-h-screen text-white flex items-center justify-center relative overflow-hidden py-10 sm:py-12 px-4">
      <Toast />
      <div className="absolute inset-0 bg-grid-pattern pointer-events-none opacity-40" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(600px,95vw)] h-[520px] bg-blue-600/20 blur-[120px] rounded-full pointer-events-none" />

      <div className="app-card w-full max-w-md p-6 sm:p-8 rounded-[1.5rem] sm:rounded-3xl bg-white/[0.02] border border-white/10 shadow-2xl relative z-10 group hover:border-blue-500/30 transition-all duration-300">
        <div className="flex flex-col items-center mb-8 relative">
          <Globe size={52} className="mb-4" />
          <span className="font-extrabold text-2xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">Geo<span className="text-blue-400">Leads</span></span>
          <div className="absolute top-0 right-0">
            <LanguageSwitcher />
          </div>
        </div>
        
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-2">
          {isLogin ? t('login.welcome') : t('login.welcomeSignup')}
        </h2>
        <p className="text-gray-400 text-center mb-8">
          {t('login.subtitle')}
        </p>

        {message && (
          <div className="p-3 mb-6 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-sm text-center">
            {message}
          </div>
        )}

        <button 
          onClick={loginWithGoogle}
          className="w-full py-3 mb-6 rounded-xl font-semibold text-white bg-white/5 border border-white/10 hover:bg-white/10 hover:-translate-y-1 active:scale-95 transition-all flex items-center justify-center gap-3"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          {t('login.google')}
        </button>

        <div className="flex items-center gap-4 mb-6">
          <div className="h-px bg-white/10 flex-1"></div>
          <span className="text-sm text-gray-500">{t('login.or')}</span>
          <div className="h-px bg-white/10 flex-1"></div>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">{t('login.emailLabel')}</label>
            <input 
              type="email" 
              className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">{t('login.passwordLabel')}</label>
            <input 
              type="password" 
              className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          
          {resetSent && (
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-sm text-center">
              {resetSent}
            </div>
          )}

          {isLogin && (
            <button type="button" onClick={handleForgotPassword} disabled={loading}
              className="text-xs text-gray-500 hover:text-blue-400 transition-colors mt-1 cursor-pointer disabled:opacity-50"
            >
              {t('login.forgotPassword')}
            </button>
          )}
          
          {!isLogin && (
            <label className="flex items-start gap-2 text-sm text-gray-400 mt-4 cursor-pointer">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-1 accent-blue-500"
                required
              />
              <span>
                <Link href="/terms" className="text-blue-400 hover:underline" target="_blank">{t('login.termsLink')}</Link>
                {' '}{t('login.termsAnd')}{' '}
                <Link href="/privacy" className="text-blue-400 hover:underline" target="_blank">{t('login.privacyLink')}</Link>
              </span>
            </label>
          )}
          <button 
            type="submit"
            disabled={loading || (!isLogin && !termsAccepted)}
            className="w-full py-3.5 mt-4 rounded-xl font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-95 hover:-translate-y-1 transition-all duration-200 flex justify-center shadow-[0_0_15px_rgba(59,130,246,0.3)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            {loading ? t('login.processing') : isLogin ? t('login.loginButton') : t('login.signupButton')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm text-gray-400 hover:text-blue-400 transition-colors"
          >
            {isLogin ? t('login.noAccount') : t('login.hasAccount')}
          </button>
        </div>
      </div>
    </div>
  );
}
