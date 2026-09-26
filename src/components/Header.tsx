import React from 'react';
import {
  Sparkles,
  MessageSquare,
  Library,
  Sliders,
  Building2,
  Download,
  ExternalLink,
  ShieldCheck,
  Zap,
} from 'lucide-react';

interface HeaderProps {
  activeTab: 'simulator' | 'popup' | 'templates' | 'tones' | 'profile' | 'export';
  setActiveTab: (tab: 'simulator' | 'popup' | 'templates' | 'tones' | 'profile' | 'export') => void;
  leadsCount: number;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, leadsCount }) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-sky-500 to-blue-600 flex items-center justify-center shadow-lg shadow-sky-500/20 text-white font-black text-xl">
              <Zap className="w-5 h-5 fill-white text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight text-white">
                  TradeReply <span className="text-sky-400">AI</span>
                </span>
                <span className="text-[11px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-sky-400" />
                  Checkatrade Ready
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Browser Extension & Auto-Reply Engine for UK Trades
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => setActiveTab('simulator')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'simulator'
                  ? 'bg-sky-600 text-white shadow-sm shadow-sky-600/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Checkatrade Simulator</span>
              <span className="md:hidden">Simulator</span>
              {leadsCount > 0 && (
                <span className="ml-1 bg-amber-500 text-slate-950 font-bold px-1.5 py-0.2 rounded-full text-[10px]">
                  {leadsCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('popup')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'popup'
                  ? 'bg-sky-600 text-white shadow-sm shadow-sky-600/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Extension Popup</span>
              <span className="md:hidden">Popup</span>
            </button>

            <button
              onClick={() => setActiveTab('templates')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'templates'
                  ? 'bg-sky-600 text-white shadow-sm shadow-sky-600/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Library className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Template Library</span>
              <span className="md:hidden">Templates</span>
            </button>

            <button
              onClick={() => setActiveTab('tones')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'tones'
                  ? 'bg-sky-600 text-white shadow-sm shadow-sky-600/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Tone Settings</span>
              <span className="md:hidden">Tones</span>
            </button>

            <button
              onClick={() => setActiveTab('profile')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'profile'
                  ? 'bg-sky-600 text-white shadow-sm shadow-sky-600/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Business Profile</span>
              <span className="lg:hidden">Profile</span>
            </button>

            <button
              onClick={() => setActiveTab('export')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'export'
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Ext</span>
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
};
