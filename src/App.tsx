import React, { Suspense, lazy, useState, useEffect } from 'react';
import { Header } from './components/Header.tsx';

// Each tab is code-split, so the landing view no longer ships the whole app in one
// ~590 kB chunk, and a slow tab download shows TabLoading instead of a blank screen.
const CheckatradeSimulator = lazy(() =>
  import('./components/CheckatradeSimulator.tsx').then((m) => ({ default: m.CheckatradeSimulator })),
);
const ExtensionPopupView = lazy(() =>
  import('./components/ExtensionPopupView.tsx').then((m) => ({ default: m.ExtensionPopupView })),
);
const TemplateLibrary = lazy(() =>
  import('./components/TemplateLibrary.tsx').then((m) => ({ default: m.TemplateLibrary })),
);
const ToneSettingsView = lazy(() =>
  import('./components/ToneSettingsView.tsx').then((m) => ({ default: m.ToneSettingsView })),
);
const BusinessProfileView = lazy(() =>
  import('./components/BusinessProfileView.tsx').then((m) => ({ default: m.BusinessProfileView })),
);
const ExportExtensionModal = lazy(() =>
  import('./components/ExportExtensionModal.tsx').then((m) => ({ default: m.ExportExtensionModal })),
);

function TabLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-16 text-center text-xs text-slate-500">
      Loading view…
    </div>
  );
}
import {
  DEFAULT_TEMPLATES,
  INITIAL_BUSINESS_PROFILE,
  INITIAL_LEADS,
  INITIAL_TONE_SETTINGS,
} from './mockData.ts';
import { BusinessProfile, Lead, Template, ToneSettings } from './types.ts';

export default function App() {
  const [activeTab, setActiveTab] = useState<
    'simulator' | 'popup' | 'templates' | 'tones' | 'profile' | 'export'
  >('simulator');

  // Leads state
  const [leads, setLeads] = useState<Lead[]>(() => {
    const saved = localStorage.getItem('tradereply_leads');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return INITIAL_LEADS;
  });

  const [activeLeadId, setActiveLeadId] = useState<string>(leads[0]?.id || 'lead_chk_01');

  // Business profile state
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile>(() => {
    const saved = localStorage.getItem('tradereply_business_profile');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return INITIAL_BUSINESS_PROFILE;
  });

  // Tone settings state
  const [toneSettings, setToneSettings] = useState<ToneSettings>(() => {
    const saved = localStorage.getItem('tradereply_tone_settings');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return INITIAL_TONE_SETTINGS;
  });

  // Template library state
  const [templates, setTemplates] = useState<Template[]>(() => {
    const saved = localStorage.getItem('tradereply_templates');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return DEFAULT_TEMPLATES;
  });

  // Live engine status — probed against the real backend (never assumed).
  const [engineStatus, setEngineStatus] = useState<{
    live: boolean;
    engine?: string;
    detail?: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/health')
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        setEngineStatus({
          live: Boolean(res.ok && data.live),
          engine: data.engine,
          detail: data.message || data.detail,
        });
      })
      .catch((err: any) => {
        if (cancelled) return;
        setEngineStatus({ live: false, detail: err?.message || 'Backend unreachable' });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Sync to local storage
  useEffect(() => {
    localStorage.setItem('tradereply_leads', JSON.stringify(leads));
  }, [leads]);

  useEffect(() => {
    localStorage.setItem('tradereply_tone_settings', JSON.stringify(toneSettings));
  }, [toneSettings]);

  useEffect(() => {
    localStorage.setItem('tradereply_templates', JSON.stringify(templates));
  }, [templates]);

  // Lead handlers
  const handleAddCustomLead = (newLead: Lead) => {
    setLeads((prev) => [newLead, ...prev]);
    setActiveLeadId(newLead.id);
  };

  const handleUpdateLeadStatus = (leadId: string, status: Lead['status'], replyText?: string) => {
    setLeads((prev) =>
      prev.map((l) => {
        if (l.id === leadId) {
          const history = l.responseHistory ? [...l.responseHistory] : [];
          if (replyText) {
            history.push({
              sender: 'tradesperson',
              text: replyText,
              timestamp: 'Just now',
            });
          }
          return {
            ...l,
            status,
            responseHistory: history,
          };
        }
        return l;
      })
    );
  };

  const handleUseTemplateInSimulator = (_template: Template) => {
    setActiveTab('simulator');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-sky-500 selection:text-white">
      {/* Global Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        leadsCount={leads.filter((l) => l.status !== 'replied').length}
      />

      {/* Main Content Area */}
      <main className="flex-1 pb-12">
        <Suspense fallback={<TabLoading />}>
          {activeTab === 'simulator' && (
          <CheckatradeSimulator
            leads={leads}
            activeLeadId={activeLeadId}
            setActiveLeadId={setActiveLeadId}
            businessProfile={businessProfile}
            toneSettings={toneSettings}
            setToneSettings={setToneSettings}
            templates={templates}
            onAddCustomLead={handleAddCustomLead}
            onUpdateLeadStatus={handleUpdateLeadStatus}
          />
        )}

        {activeTab === 'popup' && (
          <ExtensionPopupView
            businessProfile={businessProfile}
            toneSettings={toneSettings}
            setToneSettings={setToneSettings}
            templates={templates}
            leads={leads}
            onOpenSimulator={() => setActiveTab('simulator')}
          />
        )}

        {activeTab === 'templates' && (
          <TemplateLibrary
            templates={templates}
            setTemplates={setTemplates}
            businessProfile={businessProfile}
            onUseTemplateInSimulator={handleUseTemplateInSimulator}
          />
        )}

        {activeTab === 'tones' && (
          <ToneSettingsView
            toneSettings={toneSettings}
            setToneSettings={setToneSettings}
            businessProfile={businessProfile}
          />
        )}

        {activeTab === 'profile' && (
          <BusinessProfileView
            businessProfile={businessProfile}
            setBusinessProfile={setBusinessProfile}
          />
        )}

        {activeTab === 'export' && <ExportExtensionModal />}
        </Suspense>
      </main>

      {/* Persistent Footer with quick stats */}
      <footer className="bg-slate-950 border-t border-slate-900 py-4 px-6 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-slate-400">TradeReply AI Engine</span>
          <span>&bull;</span>
          <span className="flex items-center gap-1.5">
            {engineStatus === null ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-pulse"></span>
                <span>Probing live Gemini engine...</span>
              </>
            ) : engineStatus.live ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span className="text-emerald-400 font-semibold">LIVE</span>
                <span>&middot; {engineStatus.engine} &middot; real-time, no simulated responses</span>
              </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                <span className="text-rose-400 font-semibold">OFFLINE</span>
                <span>
                  &middot; {engineStatus.detail || 'GEMINI_API_KEY is not configured'}
                </span>
              </>
            )}
          </span>
          <span>&bull;</span>
          <span>Manifest V3 Extension Ready</span>
        </div>
        <div className="flex items-center gap-4">
          <span>Active Trading Name: <strong className="text-slate-300">{businessProfile.companyName}</strong></span>
          <span>Checkatrade Rating: <strong className="text-amber-400">{businessProfile.checkatradeRating}/10</strong></span>
        </div>
      </footer>
    </div>
  );
}
