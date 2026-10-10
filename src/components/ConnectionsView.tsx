import React, { useEffect, useState } from 'react';
import { Globe, Plus, Trash2, Loader2, AlertTriangle, CheckCircle2, Puzzle, LogOut } from 'lucide-react';
import { authApi } from '../utils/authClient.ts';
export const ConnectionsView: React.FC<{ user: any; onLogout: () => void }> = ({ user, onLogout }) => {
  const [conns, setConns] = useState<any[]>([]);
  const [newUrl, setNewUrl] = useState(''); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(''); const [ok, setOk] = useState('');
  const refresh = async () => { const r = await authApi.connections(); if (r.ok) setConns(r.data.connections || []); };
  useEffect(() => { void refresh(); }, []);
  const add = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError(''); setOk('');
    const r = await authApi.addConnection(newUrl); setBusy(false);
    if (!r.ok) { setError(r.error || 'Could not add'); return; }
    setNewUrl(''); setOk(`Connected ${r.data.connection.label} (${r.data.connection.host}). The extension can now work there.`);
    void refresh();
  };
  const remove = async (id: string) => { await authApi.removeConnection(id); void refresh(); };
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-black text-white">Hi, {user.displayName} 👋</h2>
        <p className="text-xs text-slate-400 mt-1">{user.email} — paste the URL of any social page or inbox for auto-replies.</p></div>
        <button onClick={onLogout} className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-white bg-slate-800 px-3 py-1.5 rounded-lg"><LogOut className="w-3.5 h-3.5" /> Sign out</button>
      </div>
      <form onSubmit={add} className="mt-6 bg-slate-900 border border-slate-800 rounded-xl p-5">
        <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5"><Globe className="w-3.5 h-3.5 text-sky-400" /> Platform URL — Facebook, Instagram, X, TikTok, LinkedIn, Checkatrade, anything</label>
        <div className="flex gap-2 mt-2">
          <input value={newUrl} onChange={(e) => setNewUrl(e.target.value)} className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" placeholder="https://www.facebook.com/yourpage/messages" />
          <button disabled={busy || !newUrl.trim()} className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Connect</button>
        </div>
        {error && <p className="text-[11px] text-rose-300 mt-2 flex gap-1.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0" />{error}</p>}
        {ok && <p className="text-[11px] text-emerald-300 mt-2 flex gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 shrink-0" />{ok}</p>}
        <p className="text-[10px] text-slate-500 mt-2">We never ask for your social password. The extension works in your browser while you are logged in there.</p>
      </form>
      <div className="mt-4 space-y-2">
        {conns.length === 0 && <p className="text-xs text-slate-500 text-center py-6">No platforms connected yet — paste your first URL above.</p>}
        {conns.map((c) => (
          <div key={c.id} className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-lg px-4 py-3">
            <div><p className="text-sm font-bold text-white">{c.label}</p><p className="text-[11px] text-slate-400 break-all">{c.url}</p></div>
            <button onClick={() => void remove(c.id)} className="text-slate-500 hover:text-rose-400 p-1.5"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
      </div>
      {conns.length > 0 && (<div className="mt-4 bg-sky-500/10 border border-sky-500/30 rounded-xl p-4 text-xs text-sky-200 flex gap-2">
        <Puzzle className="w-4 h-4 shrink-0 mt-px" /><span>Next: open <strong>Export Ext</strong>, install the extension, sign in there — it activates on your connected sites automatically.</span></div>)}
    </div>
  );
};
