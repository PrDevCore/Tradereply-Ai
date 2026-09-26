import React, { useState } from 'react';
import {
  BusinessProfile,
  Lead,
  LeadAnalysis,
  Template,
  ToneSettings,
  ToneType,
} from '../types.ts';
import { fillTemplate } from '../utils/templateFill.ts';
import { postEngine } from '../utils/engineClient.ts';
import {
  Zap,
  Sparkles,
  ShieldCheck,
  Send,
  AlertTriangle,
  Clock,
  MapPin,
  Phone,
  Mail,
  User,
  CheckCircle2,
  Copy,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Plus,
  Sliders,
  FileText,
  ThumbsUp,
  Wrench,
  Pencil,
  ArrowRight,
} from 'lucide-react';

interface CheckatradeSimulatorProps {
  leads: Lead[];
  activeLeadId: string;
  setActiveLeadId: (id: string) => void;
  businessProfile: BusinessProfile;
  toneSettings: ToneSettings;
  setToneSettings: React.Dispatch<React.SetStateAction<ToneSettings>>;
  templates: Template[];
  onAddCustomLead: (lead: Lead) => void;
  onUpdateLeadStatus: (leadId: string, status: Lead['status'], replyText?: string) => void;
}

export const CheckatradeSimulator: React.FC<CheckatradeSimulatorProps> = ({
  leads,
  activeLeadId,
  setActiveLeadId,
  businessProfile,
  toneSettings,
  setToneSettings,
  templates,
  onAddCustomLead,
  onUpdateLeadStatus,
}) => {
  const activeLead = leads.find((l) => l.id === activeLeadId) || leads[0];

  // AI draft state
  const [draftText, setDraftText] = useState<string>('');
  const [isDrafting, setIsDrafting] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  // Live-engine failure state. Never silently swallowed: a failure must be visible.
  const [engineError, setEngineError] = useState<string>('');
  const [analysis, setAnalysis] = useState<LeadAnalysis | null>(null);
  const [showAnalysis, setShowAnalysis] = useState<boolean>(true);
  const [chatInputValue, setChatInputValue] = useState<string>('');
  const [copiedNotification, setCopiedNotification] = useState<boolean>(false);
  const [filter, setFilter] = useState<'all' | 'emergency' | 'unreplied'>('all');
  const [showAddLeadModal, setShowAddLeadModal] = useState<boolean>(false);
  const [showTemplateSelector, setShowTemplateSelector] = useState<boolean>(false);
  const [simulatedCustomerReplied, setSimulatedCustomerReplied] = useState<boolean>(false);

  // Custom Lead Form State
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newTrade, setNewTrade] = useState('Plumbing & Heating');
  const [newMessage, setNewMessage] = useState('');

  // Handle lead switch
  const handleSelectLead = (id: string) => {
    setActiveLeadId(id);
    setDraftText('');
    setAnalysis(null);
    setChatInputValue('');
    setSimulatedCustomerReplied(false);
  };

  // Helper to replace template placeholders. The substitution itself is shared with
  // the template library so the two views can never disagree about a placeholder.
  const fillLeadTemplate = (templateBody: string, lead: Lead) =>
    fillTemplate(templateBody, businessProfile, {
      customerName: lead.customerName,
      service: lead.tradeCategory,
      location: lead.location,
    });

  // 1. Trigger Lead Analysis via the live Gemini engine
  const handleAnalyzeLead = async () => {
    if (!activeLead) return;
    setIsAnalyzing(true);
    setEngineError('');
    try {
      const result = await postEngine<LeadAnalysis>('/api/analyze-lead', {
        leadMessage: activeLead.messageText,
        platform: activeLead.platform,
        senderName: activeLead.customerName,
        postcodeOrArea: `${activeLead.location} (${activeLead.postcode})`,
      });

      if (!result.ok || !result.data) {
        setEngineError(result.error || 'The engine returned no analysis for this lead.');
        return;
      }

      setAnalysis(result.data);
      setShowAnalysis(true);
      return result.data;
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 2. Trigger Auto-Reply Generation via Gemini API
  const handleGenerateReply = async (customInstruction?: string) => {
    if (!activeLead) return;
    setIsDrafting(true);

    try {
      // Analyze first if not yet analyzed
      let currentAnalysis = analysis;
      if (!currentAnalysis) {
        currentAnalysis = await handleAnalyzeLead() || null;
      }

      const result = await postEngine<{ replyText?: string }>('/api/generate-reply', {
        leadMessage: activeLead.messageText,
        leadAnalysis: currentAnalysis,
        businessProfile,
        tone: toneSettings.activeTone,
        replyLength: toneSettings.replyLength,
        includeCheckatradeBadge: toneSettings.includeCheckatradeBadge,
        includeCallToAction: toneSettings.includeCallToAction,
        formalityLevel: toneSettings.formalityLevel,
        autoSignOff: toneSettings.autoSignOff,
        customInstructions: customInstruction || toneSettings.customRulePrompt,
      });

      if (!result.ok) {
        setEngineError(result.error || 'Reply generation failed.');
        return;
      }

      if (result.data?.replyText) {
        setDraftText(result.data.replyText);
        onUpdateLeadStatus(activeLead.id, 'drafted');
      } else {
        setEngineError('The engine returned no reply text — nothing was drafted.');
      }
    } finally {
      setIsDrafting(false);
    }
  };

  // 3. Quick Polish options (shorten, more friendly, add photos request)
  const handleQuickPolish = async (instruction: string) => {
    if (!draftText) return;
    setIsDrafting(true);
    try {
      const result = await postEngine<{ revisedText?: string }>('/api/rewrite-draft', {
        currentText: draftText,
        instruction,
      });

      if (!result.ok) {
        setEngineError(result.error || 'Rewrite failed.');
        return;
      }

      if (result.data?.revisedText) {
        setDraftText(result.data.revisedText);
      } else {
        setEngineError('The engine returned no revised text — your draft is unchanged.');
      }
    } finally {
      setIsDrafting(false);
    }
  };

  // 4. Insert Draft into the simulated Checkatrade input
  const handleInsertToChat = () => {
    if (!draftText) return;
    setChatInputValue(draftText);
  };

  // 5. Simulate Sending reply to Homeowner
  const handleSendReply = () => {
    const textToSend = chatInputValue || draftText;
    if (!textToSend.trim() || !activeLead) return;

    onUpdateLeadStatus(activeLead.id, 'replied', textToSend);
    setChatInputValue('');

    // Simulate customer follow-up acknowledgment after 3.5 seconds
    setTimeout(() => {
      setSimulatedCustomerReplied(true);
    }, 3500);
  };

  const handleCopyDraft = () => {
    navigator.clipboard.writeText(draftText);
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 2000);
  };

  // Filter leads
  const filteredLeads = leads.filter((l) => {
    if (filter === 'emergency') return l.urgency.includes('Emergency');
    if (filter === 'unreplied') return l.status !== 'replied';
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Simulated Browser Chrome Bar */}
      <div className="bg-slate-900 border border-slate-700/80 rounded-t-xl overflow-hidden shadow-2xl">
        {/* Browser Tabs & Window Controls */}
        <div className="bg-slate-950 px-4 py-2.5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-rose-500 inline-block"></span>
            <span className="w-3 h-3 rounded-full bg-amber-500 inline-block"></span>
            <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span>
            <div className="ml-4 flex items-center gap-2 px-3 py-1 bg-slate-900 rounded-t-lg border-t border-x border-slate-700 text-xs font-medium text-slate-200">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Checkatrade Trades Portal &bull; Lead Messenger</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-sky-950/80 border border-sky-500/30 px-2.5 py-1 rounded-md text-[11px] font-semibold text-sky-300">
              <Zap className="w-3.5 h-3.5 text-sky-400 fill-sky-400" />
              <span>TradeReply AI Extension: Active</span>
            </div>
          </div>
        </div>

        {/* Address Bar */}
        <div className="bg-slate-900/90 px-4 py-2 flex items-center gap-3 border-b border-slate-800 text-xs text-slate-400">
          <div className="flex-1 bg-slate-950/90 border border-slate-700/60 rounded-lg px-3 py-1.5 flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-hidden text-ellipsis whitespace-nowrap">
              <span className="text-emerald-400 font-mono text-[10px] bg-emerald-950/50 px-1 rounded">HTTPS</span>
              <span className="text-slate-300 font-mono">trades.checkatrade.com</span>
              <span className="text-slate-500">/portal/messages/lead_{activeLead?.id}</span>
            </div>
            <span className="text-[10px] text-slate-500">UK Trades Hub</span>
          </div>
          <button
            onClick={() => setShowAddLeadModal(true)}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium transition"
          >
            <Plus className="w-3.5 h-3.5 text-sky-400" />
            <span>Test Custom Lead</span>
          </button>
        </div>

        {/* Main Checkatrade Portal Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[700px] bg-slate-950">
          {/* Left Column: Checkatrade Inbox Leads List (4 cols) */}
          <div className="lg:col-span-4 border-r border-slate-800 bg-slate-950/95 flex flex-col">
            {/* Inbox header */}
            <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
              <div>
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  <span>Enquiries & Leads</span>
                  <span className="bg-sky-500/20 text-sky-300 text-[10px] px-1.5 py-0.5 rounded-full font-mono">
                    {leads.length} Active
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400">Checkatrade Homeowner Messages</p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setFilter('all')}
                  className={`px-2 py-1 rounded text-[11px] font-medium ${
                    filter === 'all' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilter('emergency')}
                  className={`px-2 py-1 rounded text-[11px] font-medium ${
                    filter === 'emergency'
                      ? 'bg-rose-600 text-white'
                      : 'text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  Urgent
                </button>
                <button
                  onClick={() => setFilter('unreplied')}
                  className={`px-2 py-1 rounded text-[11px] font-medium ${
                    filter === 'unreplied'
                      ? 'bg-amber-600 text-white'
                      : 'text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  Unreplied
                </button>
              </div>
            </div>

            {/* Leads Scroll List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
              {filteredLeads.map((lead) => {
                const isSelected = lead.id === activeLead?.id;
                const isEmergency = lead.urgency.includes('Emergency');
                return (
                  <div
                    key={lead.id}
                    onClick={() => handleSelectLead(lead.id)}
                    className={`p-3 cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-sky-950/40 border-l-4 border-sky-400'
                        : 'hover:bg-slate-900/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1 mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-xs text-white">{lead.customerName}</span>
                        {lead.status === 'replied' ? (
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.2 rounded">
                            Replied
                          </span>
                        ) : lead.status === 'drafted' ? (
                          <span className="text-[10px] bg-sky-500/20 text-sky-400 border border-sky-500/30 px-1.5 py-0.2 rounded">
                            Draft Ready
                          </span>
                        ) : (
                          <span className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.2 rounded">
                            New Lead
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 whitespace-nowrap">
                        {lead.receivedAt}
                      </span>
                    </div>

                    <p className="text-xs font-medium text-slate-200 line-clamp-1 mb-1">
                      {lead.jobTitle}
                    </p>

                    <p className="text-[11px] text-slate-400 line-clamp-2 mb-2">
                      {lead.messageText}
                    </p>

                    <div className="flex items-center justify-between text-[10px]">
                      <span className="flex items-center gap-1 text-slate-400">
                        <MapPin className="w-3 h-3 text-slate-500" />
                        {lead.location} ({lead.postcode})
                      </span>

                      {isEmergency ? (
                        <span className="flex items-center gap-1 text-rose-400 font-bold bg-rose-500/10 px-1.5 py-0.5 rounded">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          Emergency
                        </span>
                      ) : (
                        <span className="text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded">
                          {lead.tradeCategory}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick Extension Status in Sidebar Footer */}
            <div className="p-3 bg-slate-900 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>Auto-Draft: Ready</span>
              </span>
              <span className="text-sky-400 font-mono">{businessProfile.companyName.slice(0, 20)}</span>
            </div>
          </div>

          {/* Right Column: Active Lead Thread & Injected Extension (8 cols) */}
          <div className="lg:col-span-8 flex flex-col bg-slate-900/40">
            {activeLead ? (
              <>
                {/* Active Lead Header */}
                <div className="p-4 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-white">{activeLead.customerName}</h2>
                      <span className="bg-sky-900/60 border border-sky-600/40 text-sky-300 text-[11px] px-2 py-0.5 rounded font-medium">
                        Verified Checkatrade Lead
                      </span>
                      {activeLead.urgency.includes('Emergency') && (
                        <span className="bg-rose-900/60 border border-rose-600/40 text-rose-300 text-[11px] px-2 py-0.5 rounded font-bold flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-rose-400" />
                          Immediate Callout
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 mt-1">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-500" />
                        {activeLead.location}, {activeLead.postcode}
                      </span>
                      <span className="flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-slate-500" />
                        {activeLead.phone}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        Received {activeLead.receivedAt}
                      </span>
                      {activeLead.budgetStated && (
                        <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[11px]">
                          Budget: {activeLead.budgetStated}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Quick Action Button in Header */}
                  <button
                    onClick={() => handleGenerateReply()}
                    disabled={isDrafting}
                    className="flex items-center gap-2 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-semibold text-xs px-3.5 py-2 rounded-lg shadow-md shadow-sky-600/20 transition disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>{isDrafting ? 'Drafting with Gemini...' : '⚡ Generate Auto-Reply'}</span>
                  </button>
                </div>

                {/* Message Thread Body */}
                <div className="flex-1 p-4 overflow-y-auto space-y-4">
                  {/* Customer's Lead Enquiry Bubble */}
                  <div className="flex items-start gap-3 max-w-2xl">
                    <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-bold text-xs shrink-0">
                      {activeLead.customerName.charAt(0)}
                    </div>
                    <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl rounded-tl-sm p-4 text-slate-200 text-sm shadow-sm space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                        <span className="font-semibold text-sky-400">{activeLead.jobTitle}</span>
                        <span>{activeLead.receivedAt}</span>
                      </div>
                      <p className="leading-relaxed whitespace-pre-line text-slate-100 font-normal">
                        {activeLead.messageText}
                      </p>
                      {activeLead.photos && activeLead.photos.length > 0 && (
                        <div className="mt-3 pt-2 border-t border-slate-700/60">
                          <p className="text-[11px] font-semibold text-slate-400 mb-1.5">
                            Customer Attached Photos ({activeLead.photos.length}):
                          </p>
                          <div className="flex gap-2">
                            {activeLead.photos.map((src, i) => (
                              <img
                                key={i}
                                src={src}
                                alt="Lead attachment"
                                className="w-24 h-24 object-cover rounded-lg border border-slate-700 hover:scale-105 transition cursor-pointer"
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Previous responses if any */}
                  {activeLead.responseHistory?.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex items-start gap-3 max-w-2xl ${
                        msg.sender === 'tradesperson' ? 'ml-auto flex-row-reverse' : ''
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                          msg.sender === 'tradesperson'
                            ? 'bg-sky-600 text-white'
                            : 'bg-slate-800 text-slate-300 border border-slate-700'
                        }`}
                      >
                        {msg.sender === 'tradesperson' ? 'You' : activeLead.customerName.charAt(0)}
                      </div>
                      <div
                        className={`rounded-2xl p-4 text-sm leading-relaxed whitespace-pre-line ${
                          msg.sender === 'tradesperson'
                            ? 'bg-sky-950/70 border border-sky-800 text-sky-100 rounded-tr-sm'
                            : 'bg-slate-800/90 border border-slate-700 text-slate-200 rounded-tl-sm'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                          <span className="font-semibold text-white">
                            {msg.sender === 'tradesperson'
                              ? businessProfile.companyName
                              : activeLead.customerName}
                          </span>
                          <span>{msg.timestamp}</span>
                        </div>
                        <p>{msg.text}</p>
                      </div>
                    </div>
                  ))}

                  {/* Simulated Customer Reply Notification */}
                  {simulatedCustomerReplied && (
                    <div className="flex items-start gap-3 max-w-2xl animate-fade-in">
                      <div className="w-8 h-8 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-xs shrink-0">
                        {activeLead.customerName.charAt(0)}
                      </div>
                      <div className="bg-emerald-950/50 border border-emerald-800/80 rounded-2xl rounded-tl-sm p-4 text-emerald-100 text-sm leading-relaxed">
                        <div className="flex items-center justify-between text-xs text-emerald-300 mb-1">
                          <span className="font-semibold">{activeLead.customerName}</span>
                          <span>Just now</span>
                        </div>
                        <p>
                          Hi {businessProfile.contactPerson}, that sounds great! Yes, please come by
                          tomorrow morning. My address is 14 Highfield Lane, {activeLead.location}.
                          Looking forward to meeting you.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* ========================================================================= */}
                  {/* BROWSER EXTENSION INJECTED WORKSPACE (VISIBLY INTEGRATED INTO CHECKATRADE) */}
                  {/* ========================================================================= */}
                  <div className="mt-6 pt-4 border-t border-slate-700/80">
                    <div className="bg-slate-950 border-2 border-sky-500/50 rounded-xl shadow-xl shadow-sky-950/50 overflow-hidden transition-all">
                      {/* Extension Injected Header Bar */}
                      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-4 py-2.5 border-b border-sky-500/30 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-6 h-6 rounded-md bg-sky-500 flex items-center justify-center text-white shadow-sm">
                            <Zap className="w-3.5 h-3.5 fill-white" />
                          </div>
                          <div>
                            <span className="font-bold text-xs text-white">TradeReply AI</span>
                            <span className="text-[10px] text-sky-400 font-mono ml-2">
                              v1.2 Injected into Checkatrade Chat
                            </span>
                          </div>
                        </div>

                        {/* Tone Selector Pills */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] text-slate-400 font-medium mr-1">Tone:</span>
                          {[
                            { id: 'professional_polished', label: '👔 Professional' },
                            { id: 'friendly_approachable', label: '🤝 Friendly' },
                            { id: 'urgent_fasttrack', label: '🚨 Urgent Dispatch' },
                            { id: 'direct_pricing', label: '💷 Direct Pricing' },
                            { id: 'consultative_expert', label: '🧠 Consultative' },
                          ].map((t) => (
                            <button
                              key={t.id}
                              onClick={() => {
                                setToneSettings((prev) => ({
                                  ...prev,
                                  activeTone: t.id as ToneType,
                                }));
                              }}
                              className={`text-[11px] px-2.5 py-1 rounded-md font-medium transition ${
                                toneSettings.activeTone === t.id
                                  ? 'bg-sky-500 text-white font-semibold shadow-sm shadow-sky-500/30'
                                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                              }`}
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>

                        {/* Template Dropdown Toggle */}
                        <div className="relative">
                          <button
                            onClick={() => setShowTemplateSelector(!showTemplateSelector)}
                            className="flex items-center gap-1.5 text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg border border-slate-700 transition"
                          >
                            <FileText className="w-3.5 h-3.5 text-amber-400" />
                            <span>Quick Template</span>
                            <ChevronDown className="w-3 h-3 text-slate-400" />
                          </button>

                          {/* Template Dropdown */}
                          {showTemplateSelector && (
                            <div className="absolute right-0 top-9 w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-30 p-2 divide-y divide-slate-800 text-xs">
                              <p className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                Select Template to Populate
                              </p>
                              <div className="max-h-60 overflow-y-auto py-1 space-y-1">
                                {templates.map((tpl) => (
                                  <button
                                    key={tpl.id}
                                    onClick={() => {
                                      const filled = fillLeadTemplate(tpl.body, activeLead);
                                      setDraftText(filled);
                                      setShowTemplateSelector(false);
                                    }}
                                    className="w-full text-left p-2 rounded-lg hover:bg-slate-800 text-slate-200 hover:text-white transition flex flex-col gap-0.5"
                                  >
                                    <span className="font-semibold text-xs text-sky-300">
                                      {tpl.title}
                                    </span>
                                    <span className="text-[10px] text-slate-400 line-clamp-1">
                                      {tpl.description}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Live engine failure — surfaced, never silently swallowed */}
                      {engineError && (
                        <div className="bg-rose-950/60 border-b border-rose-800 px-3 py-2 text-[11px] text-rose-200 flex items-start gap-2">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                          <span>
                            <strong className="font-bold">Live engine unavailable:</strong> {engineError}{' '}
                            No simulated or placeholder reply has been generated.
                          </span>
                        </div>
                      )}

                      {/* Lead Intelligence Banner (AI Analysis) */}
                      {analysis && showAnalysis && (
                        <div className="bg-sky-950/40 border-b border-sky-900/60 p-3 text-xs">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sky-300 flex items-center gap-1">
                                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                                Lead Intelligence Analysis:
                              </span>
                              <span className="bg-sky-900/80 text-sky-200 px-2 py-0.5 rounded text-[10px] font-mono">
                                Quality Score: {analysis.leadQualityScore}/100
                              </span>
                              <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded text-[10px]">
                                Sentiment: {analysis.sentiment}
                              </span>
                            </div>
                            <button
                              onClick={() => setShowAnalysis(false)}
                              className="text-slate-400 hover:text-slate-200"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] text-slate-300">
                            <div>
                              <p className="text-slate-400 mb-0.5">
                                <span className="font-semibold text-white">Recommended Strategy:</span>{' '}
                                {analysis.recommendedReplyAngle}
                              </p>
                              <p className="text-slate-400">
                                <span className="font-semibold text-white">Urgency Assessment:</span>{' '}
                                {analysis.urgencyReasoning}
                              </p>
                            </div>
                            <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                              <p className="font-semibold text-amber-400 mb-1">
                                Key Missing Details to Request:
                              </p>
                              <ul className="list-disc list-inside space-y-0.5 text-slate-300">
                                {analysis.keyQuestionsNeeded.map((q, idx) => (
                                  <li key={idx} className="line-clamp-1">
                                    {q}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* AI Draft Box & Quick Polishing */}
                      <div className="p-3 bg-slate-950">
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                            <Pencil className="w-3 h-3 text-sky-400" />
                            AI Suggested Personalized Reply:
                          </span>
                          <div className="flex items-center gap-2">
                            {draftText && (
                              <button
                                onClick={handleCopyDraft}
                                className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition"
                              >
                                <Copy className="w-3 h-3" />
                                <span>{copiedNotification ? 'Copied!' : 'Copy'}</span>
                              </button>
                            )}
                            <button
                              onClick={() => handleGenerateReply()}
                              disabled={isDrafting}
                              className="flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 transition"
                            >
                              <RefreshCw
                                className={`w-3 h-3 ${isDrafting ? 'animate-spin' : ''}`}
                              />
                              <span>Regenerate</span>
                            </button>
                          </div>
                        </div>

                        {/* Textarea for Draft */}
                        <div className="relative">
                          <textarea
                            value={draftText}
                            onChange={(e) => setDraftText(e.target.value)}
                            placeholder="Click 'Generate Auto-Reply' above or select a template to have TradeReply AI draft a personalized response..."
                            rows={6}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 font-sans leading-relaxed resize-y"
                          />
                          {isDrafting && (
                            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm rounded-lg flex items-center justify-center gap-2 text-xs text-sky-400 font-semibold">
                              <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
                              <span>Drafting tailored reply using Gemini 3.8 Flash...</span>
                            </div>
                          )}
                        </div>

                        {/* Quick AI Polish Pills */}
                        {draftText && (
                          <div className="flex flex-wrap items-center gap-1.5 mt-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              AI Quick Tweak:
                            </span>
                            <button
                              onClick={() => handleQuickPolish('Make it more concise and punchy')}
                              className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-0.5 rounded border border-slate-700"
                            >
                              ✂️ Shorter
                            </button>
                            <button
                              onClick={() =>
                                handleQuickPolish(
                                  'Make it warmer, more neighbourly, and stress-free'
                                )
                              }
                              className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-0.5 rounded border border-slate-700"
                            >
                              🤝 Friendlier
                            </button>
                            <button
                              onClick={() =>
                                handleQuickPolish(
                                  'Emphasize requesting photos or short video via WhatsApp or here'
                                )
                              }
                              className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-0.5 rounded border border-slate-700"
                            >
                              📸 Ask for Photos
                            </button>
                            <button
                              onClick={() =>
                                handleQuickPolish(
                                  `Add prominent mention of our Checkatrade ${businessProfile.checkatradeRating}/10 score and ${businessProfile.accreditationBadge}`
                                )
                              }
                              className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-0.5 rounded border border-slate-700"
                            >
                              ⭐ Emphasize 9.9 Checkatrade Rating
                            </button>
                          </div>
                        )}

                        {/* Extension Primary Action Bar */}
                        <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-800">
                          <span className="text-[11px] text-slate-400">
                            {draftText.length > 0
                              ? `${draftText.length} characters drafted`
                              : 'No draft generated yet'}
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={handleInsertToChat}
                              disabled={!draftText}
                              className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white font-semibold text-xs px-3.5 py-1.5 rounded-lg shadow-sm transition"
                            >
                              <ArrowRight className="w-3.5 h-3.5" />
                              <span>Insert to Checkatrade Chat</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ========================================================================= */}
                  {/* NATIVE CHECKATRADE CHAT INPUT BOX (SIMULATED PORTAL UI) */}
                  {/* ========================================================================= */}
                  <div className="mt-4 bg-slate-900 border border-slate-700 rounded-xl p-3 shadow-lg">
                    <p className="text-[11px] font-semibold text-slate-400 mb-1.5 flex items-center justify-between">
                      <span>Checkatrade Message Box:</span>
                      <span className="text-[10px] text-slate-500">
                        Replies are sent directly to customer's SMS & Email
                      </span>
                    </p>
                    <textarea
                      value={chatInputValue}
                      onChange={(e) => setChatInputValue(e.target.value)}
                      placeholder="Type your message here or click 'Insert to Checkatrade Chat' above..."
                      rows={4}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500 leading-relaxed font-sans"
                    />
                    <div className="flex items-center justify-between mt-2.5">
                      <span className="text-[11px] text-slate-500">
                        Pressing Send logs your lead response time on Checkatrade
                      </span>
                      <button
                        onClick={handleSendReply}
                        disabled={!chatInputValue.trim()}
                        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs px-4 py-2 rounded-lg shadow-md shadow-emerald-700/30 transition"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Send Reply to Homeowner</span>
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center p-8 text-center text-slate-400">
                <div>
                  <Zap className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="font-semibold text-slate-300">Select a lead from the inbox</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Or create a custom lead to test the auto-reply generator.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal: Add Custom Lead */}
      {showAddLeadModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
              <Plus className="w-4 h-4 text-sky-400" />
              Add Custom Checkatrade Lead
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Paste any real customer message you received on Checkatrade, MyBuilder, or Bark to test
              how TradeReply AI analyzes and drafts the response.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Customer Name</label>
                <input
                  type="text"
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  placeholder="e.g. Richard Davies"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Town / Postcode</label>
                  <input
                    type="text"
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    placeholder="e.g. Epsom (KT17)"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Trade Category</label>
                  <select
                    value={newTrade}
                    onChange={(e) => setNewTrade(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100"
                  >
                    <option value="Plumbing & Heating">Plumbing & Heating</option>
                    <option value="Electrical">Electrical</option>
                    <option value="Roofing & Gutters">Roofing & Gutters</option>
                    <option value="Tiling & Bathrooms">Tiling & Bathrooms</option>
                    <option value="Carpentry & Joinery">Carpentry & Joinery</option>
                    <option value="Painting & Decorating">Painting & Decorating</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Customer Lead Message
                </label>
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Paste customer's enquiry text here..."
                  rows={4}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                onClick={() => setShowAddLeadModal(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!newMessage.trim()) return;
                  const newLead: Lead = {
                    id: `lead_custom_${Date.now()}`,
                    customerName: newCustomerName.trim() || 'Homeowner',
                    platform: 'Checkatrade',
                    phone: '07800 000111',
                    email: 'customer@example.co.uk',
                    location: newLocation.trim() || 'Local area',
                    postcode: 'UK',
                    tradeCategory: newTrade,
                    jobTitle: `${newTrade} enquiry in ${newLocation || 'local area'}`,
                    messageText: newMessage.trim(),
                    receivedAt: 'Just now',
                    urgency:
                      newMessage.toLowerCase().includes('leak') ||
                      newMessage.toLowerCase().includes('urgent') ||
                      newMessage.toLowerCase().includes('emergency')
                        ? 'Emergency (Immediate)'
                        : 'Urgent (24-48h)',
                    status: 'new',
                  };
                  onAddCustomLead(newLead);
                  setActiveLeadId(newLead.id);
                  setShowAddLeadModal(false);
                  setNewCustomerName('');
                  setNewLocation('');
                  setNewMessage('');
                }}
                className="bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-lg text-xs font-bold transition shadow-sm"
              >
                Add Lead to Inbox
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
