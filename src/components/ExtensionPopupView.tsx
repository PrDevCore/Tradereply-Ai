import React, { useState } from 'react';
import { BusinessProfile, Lead, Template, ToneSettings, ToneType } from '../types.ts';
import { postEngine } from '../utils/engineClient.ts';
import {
  Zap,
  Sparkles,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  Sliders,
  FileText,
  ShieldCheck,
  Send,
  MessageSquare,
} from 'lucide-react';

interface ExtensionPopupViewProps {
  businessProfile: BusinessProfile;
  toneSettings: ToneSettings;
  setToneSettings: React.Dispatch<React.SetStateAction<ToneSettings>>;
  templates: Template[];
  leads: Lead[];
  onOpenSimulator: () => void;
}

export const ExtensionPopupView: React.FC<ExtensionPopupViewProps> = ({
  businessProfile,
  toneSettings,
  setToneSettings,
  templates,
  leads,
  onOpenSimulator,
}) => {
  const [selectedLeadId, setSelectedLeadId] = useState<string>(leads[0]?.id || '');
  const [inputText, setInputText] = useState<string>(leads[0]?.messageText || '');
  const [outputReply, setOutputReply] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  // Live-engine failure state, surfaced in the popup UI.
  const [engineError, setEngineError] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  const handleSelectSample = (leadId: string) => {
    setSelectedLeadId(leadId);
    const found = leads.find((l) => l.id === leadId);
    if (found) {
      setInputText(found.messageText);
      setOutputReply('');
    }
  };

  const handleGenerate = async () => {
    if (!inputText.trim()) return;
    setIsGenerating(true);
    setEngineError('');
    try {
      const result = await postEngine<{ replyText?: string }>('/api/generate-reply', {
        leadMessage: inputText,
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
        setEngineError(result.error || 'Reply generation failed.');
        return;
      }

      if (result.data?.replyText) {
        setOutputReply(result.data.replyText);
      } else {
        setEngineError('The engine returned no reply text.');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(outputReply);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-black text-white flex items-center justify-center gap-2">
          <Zap className="w-6 h-6 text-sky-400 fill-sky-400" />
          <span>Chrome Extension Popup Preview</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1 max-w-lg mx-auto">
          This simulates clicking the TradeReply AI icon in the Google Chrome browser toolbar.
          Tradespeople can draft fast responses on any webpage or scratchpad.
        </p>
      </div>

      <div className="flex flex-col md:flex-row items-center justify-center gap-8">
        {/* The 380px Chrome Extension Frame */}
        <div className="w-[380px] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl shadow-sky-950/40 overflow-hidden flex flex-col">
          {/* Extension Header */}
          <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-sky-500 flex items-center justify-center text-white font-black shadow-sm">
                <Zap className="w-4 h-4 fill-white" />
              </div>
              <div>
                <h3 className="font-bold text-xs text-white leading-tight">TradeReply AI</h3>
                <span className="text-[10px] text-sky-400">Checkatrade Companion</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-[10px] text-slate-400 font-mono">Active</span>
            </div>
          </div>

          {/* Active Tab Detector Banner */}
          <div className="bg-sky-950/40 border-b border-sky-900/60 px-4 py-2 flex items-center justify-between text-[11px]">
            <span className="text-sky-300 font-medium truncate max-w-[220px]">
              🌐 trades.checkatrade.com
            </span>
            <span className="text-[10px] bg-sky-900/80 text-sky-200 px-1.5 py-0.5 rounded font-mono">
              Lead detected
            </span>
          </div>

          {/* Quick Lead Preset Picker */}
          <div className="p-4 space-y-3 bg-slate-900 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Load Active Lead on Page:
              </label>
              <select
                value={selectedLeadId}
                onChange={(e) => handleSelectSample(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200"
              >
                {leads.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.customerName} - {l.jobTitle.slice(0, 30)}...
                  </option>
                ))}
              </select>
            </div>

            {/* Tone Selector */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Tone Setting:
              </label>
              <select
                value={toneSettings.activeTone}
                onChange={(e) =>
                  setToneSettings((prev) => ({
                    ...prev,
                    activeTone: e.target.value as ToneType,
                  }))
                }
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200"
              >
                <option value="professional_polished">👔 Professional & Polished</option>
                <option value="friendly_approachable">🤝 Friendly & Approachable</option>
                <option value="urgent_fasttrack">🚨 Urgent Dispatch / Emergency</option>
                <option value="direct_pricing">💷 Direct Pricing & Terms</option>
                <option value="consultative_expert">🧠 Consultative Diagnostic</option>
              </select>
            </div>

            {/* Customer Message Scratchpad */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Customer Message:
              </label>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                rows={3}
                placeholder="Paste customer message..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-[11px] text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>

            {/* Generate Action Button */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !inputText.trim()}
              className="w-full bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-xs py-2.5 rounded-lg shadow-md transition flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Drafting Reply...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Auto-Draft Response</span>
                </>
              )}
            </button>

            {/* Live engine failure — surfaced, never silently swallowed */}
            {engineError && (
              <div className="mt-3 bg-rose-950/60 border border-rose-800 rounded-lg p-2.5 text-[10px] text-rose-200 leading-relaxed">
                <strong className="font-bold">Live engine unavailable:</strong> {engineError}
              </div>
            )}

            {/* Generated Response Box */}
            {outputReply && (
              <div className="mt-3 bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-sky-400">✨ Tailored Reply</span>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 text-[10px] text-slate-300 hover:text-white bg-slate-800 px-2 py-0.5 rounded"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-slate-200 leading-relaxed whitespace-pre-line max-h-48 overflow-y-auto pr-1">
                  {outputReply}
                </p>
              </div>
            )}
          </div>

          {/* Extension Footer */}
          <div className="p-3 bg-slate-950 border-t border-slate-800 text-[11px] flex items-center justify-between text-slate-400">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
              <span>{businessProfile.companyName.slice(0, 18)}</span>
            </span>
            <button
              onClick={onOpenSimulator}
              className="text-sky-400 hover:text-sky-300 font-semibold flex items-center gap-1"
            >
              <span>Open Checkatrade</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Feature Explainer beside the popup */}
        <div className="max-w-md space-y-4 text-xs text-slate-300">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-2">
            <h4 className="font-bold text-sm text-white flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-sky-400" />
              <span>How the Extension Works in Real Life</span>
            </h4>
            <p className="leading-relaxed text-slate-400">
              When installed in Google Chrome, TradeReply AI runs quietly in the background. As soon
              as you navigate to Checkatrade or MyBuilder, it detects the customer enquiry and
              automatically generates a personalized draft tailored to your pricing and tone.
            </p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-2">
            <h4 className="font-bold text-sm text-white flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-amber-400" />
              <span>Personalized with Your Real Trade Credentials</span>
            </h4>
            <ul className="space-y-1.5 text-slate-400">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
                <span>Pulls your verified Checkatrade rating ({businessProfile.checkatradeRating}/10).</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
                <span>Includes your standard callout rate ({businessProfile.calloutFee}).</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
                <span>Mentions your {businessProfile.guaranteeDetails}.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
