import React, { useState } from 'react';
import { UserPlus, LogIn, Loader2, AlertTriangle } from 'lucide-react';
import { authApi, setSession } from '../utils/authClient.ts';
export const AuthForm: React.FC<{ onDone: (user: any) => void }> = ({ onDone }) => {
  const [mode, setMode] = useState<'login' | 'signup'>('signup');
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [name, setName] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError('');
    const r = mode === 'signup' ? await authApi.signup(email, password, name) : await authApi.login(email, password);
    setBusy(false);
    if (!r.ok || !r.data) { setError(r.error || 'Auth failed'); return; }
    setSession(r.data.token, r.data.user); onDone(r.data.user);
  };
  return (
    <div className="max-w-md mx-auto px-4 py-10">
      <h2 className="text-2xl font-black text-white flex items-center gap-2"><UserPlus className="w-6 h-6 text-sky-400" /> {mode === 'signup' ? 'Create your account' : 'Welcome back'}</h2>
      <p className="text-xs text-slate-400 mt-1">Step 1 — create an account, then connect any social platform URL.</p>
      <form onSubmit={submit} className="mt-6 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
        {mode === 'signup' && (<div><label className="text-[11px] font-semibold text-slate-400">Display name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" placeholder="e.g. James Carter" /></div>)}
        <div><label className="text-[11px] font-semibold text-slate-400">Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" placeholder="you@business.co.uk" /></div>
        <div><label className="text-[11px] font-semibold text-slate-400">Password (min 8)</label>
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required minLength={8} className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" placeholder="••••••••" /></div>
        {error && <div className="bg-rose-500/10 border border-rose-500/30 rounded px-3 py-2 text-[11px] text-rose-300 flex gap-2"><AlertTriangle className="w-3.5 h-3.5 shrink-0" />{error}</div>}
        <button disabled={busy} className="w-full flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg text-sm font-semibold">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : mode === 'signup' ? <UserPlus className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
          {busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}</button>
        <button type="button" onClick={() => setMode(mode === 'signup' ? 'login' : 'signup')} className="w-full text-[11px] text-slate-400 hover:text-white">
          {mode === 'signup' ? 'Already have an account? Sign in' : 'New here? Create an account'}</button>
      </form>
    </div>
  );
};
