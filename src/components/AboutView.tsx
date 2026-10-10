import React from 'react';
import { PrLogo } from './PrLogo.tsx';
import { ArrowUpRight, BarChart3, Building2, Sparkles, CalendarClock } from 'lucide-react';

const card = 'bg-slate-900 border border-slate-800 rounded-xl p-5';

export const AboutView: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-center gap-4">
        <PrLogo size={56} />
        <div>
          <p className="text-[11px] font-bold tracking-[0.2em] text-sky-400 uppercase">About the app and the creators</p>
          <h2 className="text-3xl font-black text-white mt-1">PR DEV CORE TECH</h2>
          <p className="text-sm text-slate-400 mt-1">The product studio — makers of PR Reply AI</p>
        </div>
      </div>
      <p className="text-sm text-slate-300 mt-4 max-w-2xl leading-relaxed">
        Software for a more connected way to work. A growing collection of focused tools from
        PR DEV CORE TECH. We build products that make complex digital work feel considered and manageable.
      </p>

      <h3 className="text-lg font-extrabold text-white mt-10">What we make</h3>
      <p className="text-xs text-slate-400 mt-1">Tools with a clear job to do.</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
        <div className={card}>
          <div className="flex items-center gap-2">
            <span className="w-9 h-9 rounded-lg bg-sky-600 text-white flex items-center justify-center text-xs font-black">SH</span>
            <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">Flagship product</span>
          </div>
          <p className="text-base font-extrabold text-white mt-3 flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-sky-400" /> PR Social Hub
          </p>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
            A unified workspace for composing, scheduling, publishing, and measuring social media
            content across your channels.
          </p>
          <p className="text-xs font-semibold text-emerald-300 mt-3">Available now</p>
          <span className="inline-flex items-center gap-1 text-[11px] text-sky-300 mt-1">
            Open product <ArrowUpRight className="w-3.5 h-3.5" />
          </span>
        </div>

        <div className={card}>
          <div className="flex items-center gap-2">
            <span className="w-9 h-9 rounded-lg bg-violet-600 text-white flex items-center justify-center text-xs font-black">AN</span>
            <span className="text-[10px] font-semibold text-slate-400">Inside PR Social Hub</span>
          </div>
          <p className="text-base font-extrabold text-white mt-3 flex items-center gap-1.5">
            <BarChart3 className="w-4 h-4 text-violet-300" /> Social intelligence
          </p>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
            Analytics and reporting tools that turn day-to-day publishing signals into clearer
            decisions for teams and creators.
          </p>
          <span className="inline-flex items-center gap-1 text-[11px] text-sky-300 mt-3">
            Explore in dashboard <ArrowUpRight className="w-3.5 h-3.5" />
          </span>
        </div>

        <div className={card}>
          <div className="flex items-center gap-2">
            <span className="w-9 h-9 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center text-xs font-black">AI</span>
            <span className="text-[10px] font-semibold text-slate-400">Inside PR Social Hub</span>
          </div>
          <p className="text-base font-extrabold text-white mt-3 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-300" /> AI creative tools
          </p>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
            Practical AI assistance for captions, content ideas, and faster campaign workflows
            without losing your voice.
          </p>
          <span className="inline-flex items-center gap-1 text-[11px] text-sky-300 mt-3">
            Explore in content <ArrowUpRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>

      <div className={`${card} mt-4 flex flex-col sm:flex-row sm:items-center gap-4`}>
        <div className="flex items-center gap-3">
          <PrLogo size={40} />
          <div>
            <p className="text-sm font-extrabold text-white flex items-center gap-1.5">
              <CalendarClock className="w-4 h-4 text-sky-400" /> PR Reply AI
            </p>
            <p className="text-[11px] text-slate-400">Universal auto-reply assistant by PR DEV CORE TECH — this app.</p>
          </div>
        </div>
        <p className="text-xs text-slate-400 sm:ml-auto">Stay close to the work — follow what we are building next.</p>
      </div>

      <p className="text-[11px] text-slate-500 mt-6">PR / DEV / CORE — focused tools, considered and manageable.</p>
    </div>
  );
};

