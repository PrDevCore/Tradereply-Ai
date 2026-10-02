import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  Inbox,
  Clock,
  AlertTriangle,
  Sparkles,
  RefreshCw,
  Plus,
  Send,
  User,
  MapPin,
  Phone,
  Mail,
  Building2,
  CheckCircle2,
  Loader2,
  Inbox as InboxIcon,
} from 'lucide-react';
import { postEngine } from '../utils/engineClient.ts';
import {
  addMessage,
  createLead,
  listLeads,
  relativeAge,
  setStage,
  slaState,
  type LeadStage,
  type LeadUrgency,
  type WorkspaceLead,
  type WorkspaceMessage,
} from '../utils/workspaceClient.ts';
import type { BusinessProfile, ToneSettings } from '../types.ts';

const STAGE_LABELS: Record<LeadStage, string> = {
  new: 'New',
  analyzed: 'Analyzed',
  drafted: 'Drafted',
  replied: 'Replied',
  won: 'Won',
  lost: 'Lost',
};

const STAGE_ORDER: LeadStage[] = ['new', 'analyzed', 'drafted', 'replied', 'won', 'lost'];

const URGENCY_LABELS: Record<LeadUrgency, string> = {
  emergency: 'Emergency',
  urgent: 'Urgent',
  flexible: 'Flexible',
};

interface ResponseWorkspaceProps {
  businessProfile: BusinessProfile;
  toneSettings: ToneSettings;
}

interface DraftState {
  text: string;
  busy: boolean;
  error: string;
}

const EMPTY_DRAFT: DraftState = { text: '', busy: false, error: '' };

/**
 * The customer-response workspace.
 *
 * Three panes: a filterable queue, the selected conversation, and an AI copilot.
 * Every engine call is explicit and user-triggered — nothing is drafted
 * automatically, and no message is ever sent on the tradesperson's behalf.
 */
export const ResponseWorkspace: React.FC<ResponseWorkspaceProps> = ({
  businessProfile,
  toneSettings,
}) => {
  const [leads, setLeads] = useState<WorkspaceLead[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [stageFilter, setStageFilter] = useState<LeadStage | ''>('');
  const [loading, setLoading] = useState(true);
  const [queueError, setQueueError] = useState('');
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [composing, setComposing] = useState('');
  const [showIntake, setShowIntake] = useState(false);
  const [intake, setIntake] = useState({ customerName: '', messageText: '', jobTitle: '' });
  const [intakeBusy, setIntakeBusy] = useState(false);
  const [intakeError, setIntakeError] = useState('');
  // Re-render once a minute so relative ages and SLA states stay truthful.
  const [now, setNow] = useState(() => Date.now());
  const searchRef = useRef<HTMLInputElement | null>(null);

  const selected = useMemo(
    () => leads.find((l) => l.id === selectedId) || null,
    [leads, selectedId],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setQueueError('');
    const result = await listLeads({ stage: stageFilter || undefined, search: search || undefined });
    if (!result.ok || !result.data) {
      setQueueError(result.error || 'Could not load the lead queue.');
      setLoading(false);
      return;
    }
    setLeads(result.data.leads);
    setSelectedId((current) => current || result.data!.leads[0]?.id || '');
    setLoading(false);
  }, [stageFilter, search]);

  // Debounce the query so typing in the search box does not fire a request per key.
  useEffect(() => {
    const handle = setTimeout(refresh, search ? 250 : 0);
    return () => clearTimeout(handle);
  }, [refresh, search]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  // j / k move through the queue, / focuses search, r refreshes. Ignored while
  // the user is typing so a shortcut can never eat what they are writing.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (typing) return;

      if (event.key === '/') {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (event.key === 'r' || event.key === 'R') {
        void refresh();
        return;
      }
      if (event.key !== 'j' && event.key !== 'k') return;
      if (leads.length === 0) return;
      event.preventDefault();
      const index = leads.findIndex((l) => l.id === selectedId);
      const next =
        event.key === 'j'
          ? Math.min(leads.length - 1, index + 1)
          : Math.max(0, index <= 0 ? 0 : index - 1);
      setSelectedId(leads[next].id);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [leads, selectedId, refresh]);

  // Switching conversations must not leave the previous lead's draft on screen.
  useEffect(() => {
    setDraft(EMPTY_DRAFT);
    setComposing('');
  }, [selectedId]);

  async function handleGenerate() {
    if (!selected) return;
    setDraft({ text: '', busy: true, error: '' });
    const result = await postEngine<{ replyText: string }>('/api/generate-reply', {
      // The full thread is what the model needs: a lead that has already been
      // answered must not be drafted as if the message were new.
      leadMessage: selected.messages.map((m) => `${m.author}: ${m.body}`).join('\n\n'),
      businessProfile,
      tone: toneSettings.activeTone,
      replyLength: toneSettings.replyLength,
      includeCheckatradeBadge: toneSettings.includeCheckatradeBadge,
      includeCallToAction: toneSettings.includeCallToAction,
      formalityLevel: toneSettings.formalityLevel,
      autoSignOff: toneSettings.autoSignOff,
      customInstructions: toneSettings.customRulePrompt,
    });

    if (!result.ok || !result.data?.replyText) {
      setDraft({ text: '', busy: false, error: result.error || 'The engine returned no reply.' });
      return;
    }
    setDraft({ text: result.data.replyText, busy: false, error: '' });
  }

  async function handleRewrite(instruction: string) {
    if (!selected || !draft.text) return;
    setDraft((prev) => ({ ...prev, busy: true, error: '' }));
    const result = await postEngine<{ rewrittenText: string }>('/api/rewrite-draft', {
      instruction,
      currentText: draft.text,
    });
    if (!result.ok || !result.data?.rewrittenText) {
      setDraft((prev) => ({ ...prev, busy: false, error: result.error || 'The engine returned nothing.' }));
      return;
    }
    setDraft({ text: result.data.rewrittenText, busy: false, error: '' });
  }

  async function handleSaveDraft() {
    if (!selected || !draft.text) return;
    const result = await addMessage(selected.id, draft.text, 'draft');
    if (!result.ok) {
      setDraft((prev) => ({ ...prev, error: result.error || 'Could not save the draft.' }));
      return;
    }
    setDraft(EMPTY_DRAFT);
    await refresh();
  }

  async function handleLogReply() {
    if (!selected || !composing.trim()) return;
    const result = await addMessage(selected.id, composing.trim(), 'tradesperson');
    if (!result.ok) {
      setDraft((prev) => ({ ...prev, error: result.error || 'Could not record the reply.' }));
      return;
    }
    setComposing('');
    await refresh();
  }

  async function handleStageChange(stage: LeadStage) {
    if (!selected) return;
    const result = await setStage(selected.id, stage);
    if (!result.ok) {
      setQueueError(result.error || 'Could not update the lead stage.');
      return;
    }
    await refresh();
  }

  async function handleIntake() {
    if (!intake.customerName.trim() || !intake.messageText.trim()) {
      setIntakeError('A customer name and a message are both required.');
      return;
    }
    setIntakeBusy(true);
    setIntakeError('');
    const result = await createLead({ ...intake, platform: 'Checkatrade', isDemo: true });
    setIntakeBusy(false);
    if (!result.ok || !result.data?.lead) {
      setIntakeError(result.error || 'Could not file the lead.');
      return;
    }
    setIntake({ customerName: '', messageText: '', jobTitle: '' });
    setShowIntake(false);
    setStageFilter('');
    await refresh();
    setSelectedId(result.data.lead.id);
  }

  const unresponded = leads.filter((l) => l.stage === 'new').length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <InboxIcon className="w-5 h-5 text-sky-400" />
            Response Workspace
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Every lead in one queue, with an AI copilot for each conversation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void refresh()}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium"
            title="Refresh the queue (r)"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Refresh
          </button>
          <button
            onClick={() => setShowIntake((v) => !v)}
            className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5" />
            File a lead
          </button>
        </div>
      </div>

      {showIntake && (
        <div className="mb-4 bg-slate-900 border border-slate-700 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-white mb-3">File a lead into the queue</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Customer name</label>
              <input
                value={intake.customerName}
                onChange={(e) => setIntake({ ...intake, customerName: e.target.value })}
                className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white"
                placeholder="Jane Doe"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Job summary (optional)</label>
              <input
                value={intake.jobTitle}
                onChange={(e) => setIntake({ ...intake, jobTitle: e.target.value })}
                className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white"
                placeholder="Leaking kitchen tap"
              />
            </div>
          </div>
          <label className="block text-xs text-slate-400 mt-3 mb-1">The enquiry</label>
          <textarea
            value={intake.messageText}
            onChange={(e) => setIntake({ ...intake, messageText: e.target.value })}
            rows={3}
            className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white"
            placeholder="Paste what the customer wrote…"
          />
          {intakeError && (
            <p className="mt-2 text-xs text-rose-400 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              {intakeError}
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => void handleIntake()}
              disabled={intakeBusy}
              className="bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-xs font-semibold"
            >
              {intakeBusy ? 'Filing…' : 'Add to queue'}
            </button>
            <button
              onClick={() => setShowIntake(false)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-lg text-xs font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {queueError && (
        <div className="mb-4 bg-rose-500/10 border border-rose-500/30 rounded-lg px-4 py-3 text-xs text-rose-300 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
          <div>
            <p>{queueError}</p>
            <button onClick={() => void refresh()} className="mt-1 underline hover:text-rose-200">
              Try again
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* QUEUE PANE */}
        <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-lg overflow-hidden flex flex-col">
          <div className="p-3 border-b border-slate-800 space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, job, area or message…  (/)"
                className="w-full bg-slate-800 border border-slate-600 rounded pl-8 pr-3 py-2 text-xs text-white"
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => setStageFilter('')}
                  className={`px-2 py-1 rounded text-[11px] font-medium ${
                    stageFilter === '' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  All
                </button>
                {STAGE_ORDER.slice(0, 4).map((stage) => (
                  <button
                    key={stage}
                    onClick={() => setStageFilter(stageFilter === stage ? '' : stage)}
                    className={`px-2 py-1 rounded text-[11px] font-medium ${
                      stageFilter === stage ? 'bg-sky-600 text-white' : 'text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    {STAGE_LABELS[stage]}
                  </button>
                ))}
              </div>
              {unresponded > 0 && (
                <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-semibold whitespace-nowrap">
                  {unresponded} waiting
                </span>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60" style={{ maxHeight: '620px' }}>
            {loading && leads.length === 0 && (
              <p className="p-6 text-center text-xs text-slate-500">Loading the queue…</p>
            )}
            {!loading && leads.length === 0 && (
              <div className="p-6 text-center">
                <p className="text-xs text-slate-400">No leads match this view.</p>
                <button
                  onClick={() => void refresh()}
                  className="mt-2 text-xs text-sky-400 hover:text-sky-300 underline"
                >
                  Refresh
                </button>
              </div>
            )}
            {leads.map((lead) => {
              const active = lead.id === selectedId;
              const sla = slaState(lead, now);
              return (
                <button
                  key={lead.id}
                  onClick={() => setSelectedId(lead.id)}
                  className={`w-full text-left px-3 py-3 hover:bg-slate-800/60 transition ${
                    active ? 'bg-slate-800 border-l-2 border-sky-500' : 'border-l-2 border-transparent'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-semibold text-white truncate">{lead.customerName}</span>
                    <span className="text-[10px] text-slate-500 flex items-center gap-1 shrink-0">
                      <Clock className="w-3 h-3" />
                      {relativeAge(lead.receivedAt, now)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">{lead.jobTitle || lead.messageText}</p>
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    <span className="text-[10px] bg-slate-700/60 text-slate-300 px-1.5 py-0.5 rounded">
                      {lead.platform}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        lead.urgency === 'emergency'
                          ? 'bg-rose-500/20 text-rose-300'
                          : lead.urgency === 'urgent'
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-slate-700/60 text-slate-400'
                      }`}
                    >
                      {URGENCY_LABELS[lead.urgency]}
                    </span>
                    {sla === 'breached' && (
                      <span className="text-[10px] bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded font-semibold">
                        Overdue
                      </span>
                    )}
                    {lead.stage !== 'new' && (
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded">
                        {STAGE_LABELS[lead.stage]}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-slate-600 px-3 py-2 border-t border-slate-800">
            <kbd className="text-slate-400">j</kbd>/<kbd className="text-slate-400">k</kbd> move ·{' '}
            <kbd className="text-slate-400">/</kbd> search · <kbd className="text-slate-400">r</kbd> refresh
          </p>
        </div>

        {/* CONVERSATION PANE */}
        <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-lg overflow-hidden flex flex-col">
          <div className="p-3 border-b border-slate-800">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <User className="w-4 h-4 text-sky-400" />
              {selected ? selected.customerName : 'No lead selected'}
            </h2>
            {selected && (
              <>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px] text-slate-400">
                  {selected.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {selected.location}
                      {selected.postcode ? ` ${selected.postcode}` : ''}
                    </span>
                  )}
                  {selected.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {selected.phone}
                    </span>
                  )}
                  {selected.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      {selected.email}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3 h-3" />
                    {selected.platform}
                    {selected.channelLive ? ' (live)' : ''}
                  </span>
                </div>
                {selected.isDemo && (
                  <p className="mt-2 text-[10px] bg-amber-500/10 text-amber-300 px-2 py-1 rounded">
                    Demo lead — invented for preview, not a real customer.
                  </p>
                )}
                <div className="flex items-center gap-1 mt-2 flex-wrap">
                  <span className="text-[10px] text-slate-500 mr-1">Stage:</span>
                  {STAGE_ORDER.map((stage) => (
                    <button
                      key={stage}
                      onClick={() => void handleStageChange(stage)}
                      className={`text-[10px] px-1.5 py-0.5 rounded ${
                        selected.stage === stage
                          ? 'bg-sky-600 text-white font-semibold'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      {STAGE_LABELS[stage]}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {selected ? (
            <>
              <div className="flex-1 overflow-y-auto p-3 space-y-3" style={{ maxHeight: '400px' }}>
                {selected.messages.length === 0 && (
                  <p className="text-xs text-slate-500">No messages in this thread yet.</p>
                )}
                {selected.messages.map((message: WorkspaceMessage) => {
                  const mine = message.author === 'tradesperson';
                  const isDraft = message.author === 'draft';
                  return (
                    <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                          isDraft
                            ? 'bg-slate-800 text-slate-300 border border-dashed border-slate-600'
                            : mine
                              ? 'bg-sky-900/60 text-sky-50'
                              : 'bg-slate-800 text-slate-100'
                        }`}
                      >
                        {isDraft && (
                          <span className="block text-[10px] uppercase tracking-wide text-slate-400 mb-1 font-semibold">
                            Saved draft
                          </span>
                        )}
                        {message.body}
                        <span className="block text-[10px] text-slate-500 mt-1.5">
                          {mine ? 'You' : selected.customerName} · {relativeAge(message.createdAt, now)} ago
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Log a reply the tradesperson already sent on the platform. */}
              <div className="border-t border-slate-800 p-3">
                <label className="block text-[11px] text-slate-400 mb-1">
                  Log a reply you sent on {selected.platform}
                </label>
                <textarea
                  value={composing}
                  onChange={(e) => setComposing(e.target.value)}
                  rows={2}
                  placeholder="Paste or summarise the reply you already sent…"
                  className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-xs text-white"
                />
                <button
                  onClick={() => void handleLogReply()}
                  disabled={!composing.trim()}
                  className="mt-2 flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg text-xs font-semibold"
                >
                  <Send className="w-3.5 h-3.5" />
                  Log reply
                </button>
              </div>
            </>
          ) : (
            <div className="p-8 text-center">
              <InboxIcon className="w-8 h-8 text-slate-700 mx-auto mb-3" />
              <p className="text-sm text-slate-400">Select a lead to open the conversation.</p>
            </div>
          )}
        </div>
        {/* COPILOT PANE */}
        <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-lg overflow-hidden flex flex-col">
          <div className="p-3 border-b border-slate-800">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-sky-400" />
              AI Copilot
            </h2>
            <p className="text-[11px] text-slate-400 mt-1">
              Drafts only — nothing is sent without you reading and sending it yourself.
            </p>
          </div>

          <div className="p-3 space-y-3 overflow-y-auto" style={{ maxHeight: '560px' }}>
            {!selected ? (
              <p className="text-xs text-slate-500">Select a lead to draft a reply.</p>
            ) : (
              <>
                <button
                  onClick={() => void handleGenerate()}
                  disabled={draft.busy}
                  className="w-full flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg text-sm font-semibold"
                >
                  {draft.busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {draft.busy ? 'Drafting…' : 'Draft a reply'}
                </button>
                <p className="text-[10px] text-slate-500">
                  Uses your saved tone ({toneSettings.activeTone.replace(/_/g, ' ')}) and business profile.
                </p>

                {draft.error && (
                  <div className="bg-rose-500/10 border border-rose-500/30 rounded px-3 py-2 text-[11px] text-rose-300 flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
                    <span>{draft.error}</span>
                  </div>
                )}

                {draft.text && (
                  <div className="bg-slate-800 border border-sky-500/30 rounded-lg p-3">
                    <p className="text-[10px] uppercase tracking-wide text-sky-300 font-semibold mb-1.5">
                      Suggested reply
                    </p>
                    <p className="text-xs text-slate-100 leading-relaxed whitespace-pre-wrap">{draft.text}</p>

                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {['Make it shorter', 'More confident', 'Add a call to action'].map((instruction) => (
                        <button
                          key={instruction}
                          onClick={() => void handleRewrite(instruction)}
                          disabled={draft.busy}
                          className="text-[10px] bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-slate-200 px-2 py-1 rounded"
                        >
                          {instruction}
                        </button>
                      ))}
                    </div>

                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => void handleSaveDraft()}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-lg text-xs font-semibold"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Save draft
                      </button>
                      <button
                        onClick={() => setDraft(EMPTY_DRAFT)}
                        className="px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-slate-200"
                      >
                        Discard
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-2">
                      Copy this into Checkatrade, or use the extension&apos;s &quot;Insert to Chat&quot; button.
                    </p>
                  </div>
                )}

                {selected.budgetStated && (
                  <div className="bg-slate-800 rounded px-3 py-2 text-[11px] text-slate-300">
                    <span className="text-slate-500">Customer budget: </span>
                    {selected.budgetStated}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
