import React, { useState } from 'react';
import { BusinessProfile, CallToActionType, ReplyLengthType, ToneSettings, ToneType } from '../types.ts';
import { postEngine } from '../utils/engineClient.ts';
import {
  Sliders,
  Sparkles,
  ShieldCheck,
  Check,
  Phone,
  Calendar,
  Camera,
  Zap,
  RefreshCw,
  Info,
  HelpCircle,
} from 'lucide-react';

interface ToneSettingsViewProps {
  toneSettings: ToneSettings;
  setToneSettings: React.Dispatch<React.SetStateAction<ToneSettings>>;
  businessProfile: BusinessProfile;
}

export const ToneSettingsView: React.FC<ToneSettingsViewProps> = ({
  toneSettings,
  setToneSettings,
  businessProfile,
}) => {
  const [testLeadMessage, setTestLeadMessage] = useState<string>(
    'Hi, my Worcester combi boiler is leaking water from the pipe underneath and the pressure is at zero. How quickly can someone come look and what is your call-out fee?'
  );
  const [testOutput, setTestOutput] = useState<string>('');
  const [isTesting, setIsTesting] = useState<boolean>(false);
  // Live-engine failure state, surfaced in the sandbox panel.
  const [engineError, setEngineError] = useState<string>('');
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  const toneOptions: { id: ToneType; title: string; desc: string; icon: string }[] = [
    {
      id: 'professional_polished',
      title: '👔 Professional & Polished',
      desc: 'Articulate, courteous, and reassuring. Highlights trade accreditations and formal guarantees.',
      icon: '👔',
    },
    {
      id: 'friendly_approachable',
      title: '🤝 Friendly & Approachable',
      desc: 'Warm, neighbourly, and stress-free. Puts anxious homeowners at ease.',
      icon: '🤝',
    },
    {
      id: 'urgent_fasttrack',
      title: '🚨 Emergency & Rapid Dispatch',
      desc: 'Direct, safety-first, and emphasizes quick response times or mobile engineer availability.',
      icon: '🚨',
    },
    {
      id: 'direct_pricing',
      title: '💷 Direct Pricing & Terms',
      desc: 'Upfront rates, transparent call-out terms, and clear scope breakdown without sales fluff.',
      icon: '💷',
    },
    {
      id: 'consultative_expert',
      title: '🧠 Consultative Diagnostic',
      desc: 'Technical authority. Asks sharp diagnostic questions to pinpoint faults before arrival.',
      icon: '🧠',
    },
  ];

  const handleTestTone = async () => {
    setIsTesting(true);
    setEngineError('');
    try {
      const result = await postEngine<{ replyText?: string }>('/api/generate-reply', {
        leadMessage: testLeadMessage,
        businessProfile,
        tone: toneSettings.activeTone,
        replyLength: toneSettings.replyLength,
        includeCheckatradeBadge: toneSettings.includeCheckatradeBadge,
        includeCallToAction: toneSettings.includeCallToAction,
        formalityLevel: toneSettings.formalityLevel,
        autoSignOff: toneSettings.autoSignOff,
        customInstructions: toneSettings.customRulePrompt,
      });

      if (!result.ok) {
        setEngineError(result.error || 'The tone sandbox request failed.');
        return;
      }

      if (result.data?.replyText) {
        setTestOutput(result.data.replyText);
      } else {
        setEngineError('The engine returned no reply text.');
      }
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Title */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            <Sliders className="w-6 h-6 text-sky-400" />
            <span>Tone Settings & AI Persona</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Tune how TradeReply AI communicates with homeowners on Checkatrade to match your exact
            brand voice.
          </p>
        </div>

        <button
          onClick={handleSave}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2 rounded-lg shadow-sm transition"
        >
          {saveSuccess ? (
            <>
              <Check className="w-4 h-4" />
              <span>Saved to Browser!</span>
            </>
          ) : (
            <span>Save Tone Preferences</span>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Settings Left Column (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Tone Presets Selector */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <label className="block text-sm font-bold text-white">Active Tone Persona</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {toneOptions.map((opt) => (
                <div
                  key={opt.id}
                  onClick={() =>
                    setToneSettings((prev) => ({ ...prev, activeTone: opt.id }))
                  }
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    toneSettings.activeTone === opt.id
                      ? 'bg-sky-950/60 border-sky-400 shadow-md shadow-sky-950/30'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-950'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-white">{opt.title}</span>
                    {toneSettings.activeTone === opt.id && (
                      <span className="w-2 h-2 rounded-full bg-sky-400"></span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">{opt.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Formality & Length Sliders */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5">
            <h3 className="font-bold text-sm text-white">Message Style & Structure</h3>

            {/* Formality Level */}
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-2">
                <span>Formality Level:</span>
                <span className="text-sky-400 font-mono">
                  {toneSettings.formalityLevel === 1 && 'Casual / Conversational'}
                  {toneSettings.formalityLevel === 2 && 'Friendly & Relaxed'}
                  {toneSettings.formalityLevel === 3 && 'Standard Professional'}
                  {toneSettings.formalityLevel === 4 && 'Polished & Articulate'}
                  {toneSettings.formalityLevel === 5 && 'High-End / Corporate'}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={5}
                step={1}
                value={toneSettings.formalityLevel}
                onChange={(e) =>
                  setToneSettings((prev) => ({
                    ...prev,
                    formalityLevel: Number(e.target.value),
                  }))
                }
                className="w-full accent-sky-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                <span>Casual & Direct</span>
                <span>Balanced</span>
                <span>Formal & Accredited</span>
              </div>
            </div>

            {/* Reply Length */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                Preferred Reply Length:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'concise', label: 'Concise (50-80 words)', desc: 'Fast to read on mobile' },
                  { id: 'standard', label: 'Standard (100-140 words)', desc: 'Optimal detail & trust' },
                  { id: 'detailed', label: 'Detailed (150-200 words)', desc: 'Technical & complete' },
                ].map((len) => (
                  <button
                    key={len.id}
                    onClick={() =>
                      setToneSettings((prev) => ({
                        ...prev,
                        replyLength: len.id as ReplyLengthType,
                      }))
                    }
                    className={`p-2.5 rounded-lg border text-left transition ${
                      toneSettings.replyLength === len.id
                        ? 'bg-sky-950/60 border-sky-400 text-white'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <p className="font-bold text-xs">{len.label.split(' ')[0]}</p>
                    <p className="text-[10px] text-slate-500">{len.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Default Call-to-Action Strategy */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                Primary Call-to-Action (CTA):
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  {
                    id: 'site_visit',
                    title: '📅 Propose Free Site Visit',
                    desc: 'Offer 1-2 free survey slots to measure up',
                  },
                  {
                    id: 'call_me',
                    title: '📞 Request Phone Call',
                    desc: 'Give mobile number or ask for callback time',
                  },
                  {
                    id: 'send_photos',
                    title: '📸 Ask for Photos / WhatsApp',
                    desc: 'Request photos/video before quoting',
                  },
                  {
                    id: 'instant_booking',
                    title: '⚡ Instant Emergency Booking',
                    desc: 'Provide callout rate & dispatch immediately',
                  },
                ].map((cta) => (
                  <button
                    key={cta.id}
                    onClick={() =>
                      setToneSettings((prev) => ({
                        ...prev,
                        includeCallToAction: cta.id as CallToActionType,
                      }))
                    }
                    className={`p-2.5 rounded-lg border text-left transition ${
                      toneSettings.includeCallToAction === cta.id
                        ? 'bg-sky-950/60 border-sky-400 text-white'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <p className="font-bold text-xs">{cta.title}</p>
                    <p className="text-[10px] text-slate-500">{cta.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Checkatrade Badge Toggle */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <div>
                <p className="font-semibold text-xs text-white flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
                  <span>Highlight Checkatrade Social Proof</span>
                </p>
                <p className="text-[11px] text-slate-400">
                  Always mention your {businessProfile.checkatradeRating}/10 score and {businessProfile.reviewsCount}+ verified reviews.
                </p>
              </div>
              <button
                onClick={() =>
                  setToneSettings((prev) => ({
                    ...prev,
                    includeCheckatradeBadge: !prev.includeCheckatradeBadge,
                  }))
                }
                className={`w-12 h-6 rounded-full transition-colors relative p-0.5 ${
                  toneSettings.includeCheckatradeBadge ? 'bg-sky-600' : 'bg-slate-800'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    toneSettings.includeCheckatradeBadge ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Custom Rule Prompt */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Custom Trade Rules & Prompt Directives</span>
              </label>
              <span className="text-[10px] text-slate-500">Injected into every AI prompt</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Provide specific business policies that the AI must always follow when replying.
            </p>
            <textarea
              rows={3}
              value={toneSettings.customRulePrompt}
              onChange={(e) =>
                setToneSettings((prev) => ({ ...prev, customRulePrompt: e.target.value }))
              }
              placeholder="e.g. Always mention we are Gas Safe registered (#594821). Never quote fixed prices for roof leaks without on-site inspection. Offer 10% discount for OAPs."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>

        {/* Live Tone Sandbox Right Column (5 cols) */}
        <div className="lg:col-span-5">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 sticky top-20 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
                <span>Live Tone Sandbox</span>
              </h3>
              <span className="text-[10px] font-mono bg-sky-950 text-sky-400 px-2 py-0.5 rounded border border-sky-800">
                Gemini 3.8 Flash
              </span>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Test Lead Input:
              </label>
              <textarea
                value={testLeadMessage}
                onChange={(e) => setTestLeadMessage(e.target.value)}
                rows={3}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 placeholder-slate-500"
              />
            </div>

            <button
              onClick={handleTestTone}
              disabled={isTesting}
              className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs py-2.5 rounded-lg shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isTesting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Generating with Current Tone...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Test Current Tone Settings</span>
                </>
              )}
            </button>

            {engineError && (
              <div className="bg-rose-950/60 border border-rose-800 rounded-lg p-2.5 text-[11px] text-rose-200 leading-relaxed">
                <strong className="font-bold">Live engine unavailable:</strong> {engineError}
              </div>
            )}

            {testOutput && (
              <div className="mt-4 pt-4 border-t border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-sky-400">Generated Test Draft:</span>
                  <span className="text-[10px] text-slate-500">
                    Tone: {toneSettings.activeTone.replace('_', ' ')}
                  </span>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 leading-relaxed whitespace-pre-line max-h-64 overflow-y-auto">
                  {testOutput}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
