'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Toast, { showToast } from '@/components/Toast';
import Globe from '@/components/Globe';

interface Testimonial {
  id: number;
  user_id: string | null;
  name: string;
  rating: number;
  feedback: string | null;
  role: string | null;
  approved: boolean;
  created_at: string;
}

export default function AdminPage() {
  const router = useRouter();
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  useEffect(() => {
    document.title = 'Admin | GeoLeads';
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      router.push('/login');
      return;
    }
    setUser(session.user);

    const adminEmail = 'pixel010dv@gmail.com';
    if (session.user.email !== adminEmail) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }
    setIsAdmin(true);
    fetchTestimonials();
  };

  const fetchTestimonials = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;

      const res = await fetch('/api/admin/testimonials', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (res.ok) {
        setTestimonials(json.testimonials || []);
      } else {
        showToast(json.error || 'Erro ao carregar', 'error');
      }
    } catch (err) {
      showToast('Erro de conexão', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: number, approved: boolean) => {
    setActionLoading(id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;

      const res = await fetch(`/api/admin/testimonials/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ approved }),
      });
      const json = await res.json();
      if (res.ok) {
        setTestimonials(prev =>
          prev.map(t => (t.id === id ? { ...t, approved } : t))
        );
        showToast(approved ? 'Aprovado!' : 'Rejeitado!', 'success');
      } else {
        showToast(json.error || 'Erro', 'error');
      }
    } catch {
      showToast('Erro de conexão', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const renderStars = (rating: number) => {
    return '★'.repeat(rating) + '☆'.repeat(5 - rating);
  };

  const pending = testimonials.filter(t => !t.approved);
  const approved = testimonials.filter(t => t.approved);

  return (
    <div className="min-h-screen text-white font-sans bg-black selection:bg-blue-500/30 relative pb-12">
      <Toast />
      <div className="absolute inset-0 bg-grid-pattern pointer-events-none opacity-40" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[min(720px,92vw)] h-[260px] bg-blue-700/10 blur-[90px] rounded-full pointer-events-none" />

      <nav className="border-b border-white/5 bg-black/40 backdrop-blur-2xl sticky top-0 z-50">
        <div className="app-container min-h-16 py-3 flex items-center justify-between gap-3 max-w-6xl mx-auto px-4">
          <div className="flex items-center gap-3 cursor-default">
            <Globe size={32} />
            <span className="font-extrabold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
              Geo<span className="text-blue-400">Leads</span>
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 font-bold">
              Admin
            </span>
          </div>
          <button
            onClick={() => router.push('/app/dashboard')}
            className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-300 hover:text-white transition-colors cursor-pointer"
          >
            ← Dashboard
          </button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-8 relative z-10">
        {!isAdmin && !loading ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🔒</div>
            <h1 className="text-2xl font-bold mb-2">Acesso Restrito</h1>
            <p className="text-gray-400 text-sm">Você não tem permissão para acessar esta página.</p>
            <button
              onClick={() => router.push('/app/dashboard')}
              className="mt-6 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-colors cursor-pointer"
            >
              Voltar ao Dashboard
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold">Painel Admin</h1>
                <p className="text-gray-400 text-sm mt-1">Aprovação de depoimentos</p>
              </div>
              <div className="text-right text-xs text-gray-500">
                <div>Pendentes: <span className="text-amber-400 font-bold">{pending.length}</span></div>
                <div>Aprovados: <span className="text-green-400 font-bold">{approved.length}</span></div>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-20 text-gray-500">Carregando...</div>
            ) : testimonials.length === 0 ? (
              <div className="text-center py-20">
                <div className="text-5xl mb-3">📭</div>
                <p className="text-gray-400">Nenhum depoimento cadastrado ainda.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {testimonials.map(t => (
                  <div
                    key={t.id}
                    className={`rounded-2xl border p-5 transition-all duration-300 ${
                      t.approved
                        ? 'bg-emerald-500/5 border-emerald-500/20'
                        : 'bg-amber-500/5 border-amber-500/20'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <h3 className="font-bold text-white">{t.name}</h3>
                          <span className="text-amber-400 text-sm">{renderStars(t.rating)}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            t.approved
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}>
                            {t.approved ? 'Aprovado' : 'Pendente'}
                          </span>
                        </div>
                        {t.feedback && (
                          <p className="text-gray-300 text-sm mt-2 leading-relaxed">{t.feedback}</p>
                        )}
                        {t.role && (
                          <p className="text-gray-500 text-xs mt-1">{t.role}</p>
                        )}
                        <p className="text-gray-600 text-[10px] mt-2">
                          ID: {t.id} | {new Date(t.created_at).toLocaleString('pt-BR')}
                          {t.user_id ? ` | User: ${t.user_id.slice(0, 8)}...` : ''}
                        </p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        {!t.approved && (
                          <button
                            onClick={() => handleApprove(t.id, true)}
                            disabled={actionLoading === t.id}
                            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition-all cursor-pointer"
                          >
                            {actionLoading === t.id ? '...' : '✓ Aprovar'}
                          </button>
                        )}
                        {t.approved && (
                          <button
                            onClick={() => handleApprove(t.id, false)}
                            disabled={actionLoading === t.id}
                            className="px-4 py-2 rounded-xl bg-red-600/50 hover:bg-red-500/70 disabled:opacity-50 text-white text-xs font-bold transition-all cursor-pointer"
                          >
                            {actionLoading === t.id ? '...' : '✗ Rejeitar'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
