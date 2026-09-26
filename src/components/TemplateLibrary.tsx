import React, { useState } from 'react';
import { BusinessProfile, Template } from '../types.ts';
import { fillTemplate, SAMPLE_TEMPLATE_VALUES } from '../utils/templateFill.ts';
import { postEngine } from '../utils/engineClient.ts';
import {
  Library,
  Plus,
  Sparkles,
  Copy,
  Check,
  Edit2,
  Trash2,
  Search,
  Filter,
  RefreshCw,
  Eye,
  CheckCircle2,
  Code2,
} from 'lucide-react';

interface TemplateLibraryProps {
  templates: Template[];
  setTemplates: React.Dispatch<React.SetStateAction<Template[]>>;
  businessProfile: BusinessProfile;
  onUseTemplateInSimulator: (template: Template) => void;
}

export const TemplateLibrary: React.FC<TemplateLibraryProps> = ({
  templates,
  setTemplates,
  businessProfile,
  onUseTemplateInSimulator,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(templates[0] || null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Edit / Create Modal state
  const [showModal, setShowModal] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'ai'>('create');
  const [editingTemplate, setEditingTemplate] = useState<Partial<Template>>({});

  // AI Generator Form
  const [aiPurpose, setAiPurpose] = useState('');
  const [aiTrade, setAiTrade] = useState(businessProfile.tradeType);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  // Live-engine failure state, surfaced inside the AI modal.
  const [aiError, setAiError] = useState<string>('');

  // Categories
  const categories = ['All', 'Emergency & Call-Out', 'Estimates & Quotes', 'Pre-Visit Triage', 'Availability', 'Follow-Up'];

  // Fill placeholders for preview. The substitution itself is shared with the
  // simulator so the two views can never disagree about what a placeholder means;
  // only the sample values differ.
  const fillSampleVariables = (text: string) =>
    fillTemplate(text, businessProfile, SAMPLE_TEMPLATE_VALUES);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(fillSampleVariables(text));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this template?')) {
      const updated = templates.filter((t) => t.id !== id);
      setTemplates(updated);
      if (previewTemplate?.id === id) {
        setPreviewTemplate(updated[0] || null);
      }
    }
  };

  const handleSaveModal = () => {
    if (!editingTemplate.title || !editingTemplate.body) return;

    if (modalMode === 'edit' && editingTemplate.id) {
      setTemplates((prev) =>
        prev.map((t) => (t.id === editingTemplate.id ? ({ ...t, ...editingTemplate } as Template) : t))
      );
    } else {
      const newTpl: Template = {
        id: `tpl_custom_${Date.now()}`,
        title: editingTemplate.title || 'Custom Trade Template',
        category: editingTemplate.category || 'General',
        description: editingTemplate.description || 'Custom quick reply template',
        body: editingTemplate.body || '',
        variablesUsed: ['customer_name', 'business_name', 'service', 'phone'],
        isCustom: true,
      };
      setTemplates((prev) => [newTpl, ...prev]);
      setPreviewTemplate(newTpl);
    }
    setShowModal(false);
  };

  const handleGenerateAiTemplate = async () => {
    if (!aiPurpose.trim()) return;
    setIsGeneratingAi(true);
    setAiError('');
    try {
      const result = await postEngine<{ title?: string; category?: string; body?: string; variablesUsed?: string[] }>(
        '/api/generate-template',
        {
          tradeCategory: aiTrade,
          purpose: aiPurpose,
        },
      );

      if (!result.ok) {
        setAiError(result.error || 'Template generation failed.');
        return;
      }

      const data = result.data;
      if (data?.body) {
        const newTpl: Template = {
          id: `tpl_ai_${Date.now()}`,
          title: `✨ ${data.title}`,
          category: data.category || 'Estimates & Quotes',
          description: `AI-generated template for ${aiPurpose}`,
          body: data.body,
          variablesUsed: data.variablesUsed || [],
          isCustom: true,
        };
        setTemplates((prev) => [newTpl, ...prev]);
        setPreviewTemplate(newTpl);
        setShowModal(false);
        setAiPurpose('');
      } else {
        setAiError('The engine returned no template body.');
      }
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const filteredTemplates = templates.filter((t) => {
    const matchesCat = selectedCategory === 'All' || t.category === selectedCategory;
    const matchesSearch =
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.body.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            <Library className="w-6 h-6 text-sky-400" />
            <span>Customizable Template Library</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Pre-configured, battle-tested UK trades templates with dynamic placeholders for
            Checkatrade, MyBuilder, and Bark.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setModalMode('ai');
              setShowModal(true);
            }}
            className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs px-3.5 py-2 rounded-lg shadow-md transition"
          >
            <Sparkles className="w-3.5 h-3.5 fill-slate-950" />
            <span>Generate with AI</span>
          </button>
          <button
            onClick={() => {
              setEditingTemplate({
                title: '',
                category: 'Estimates & Quotes',
                description: '',
                body: '',
              });
              setModalMode('create');
              setShowModal(true);
            }}
            className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs px-3.5 py-2 rounded-lg shadow-md transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Template</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6 bg-slate-900 p-3 rounded-xl border border-slate-800">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-slate-500 hidden sm:block" />
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${
                selectedCategory === cat
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates or variables..."
            className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
          />
        </div>
      </div>

      {/* Grid: Templates List (Left) and Live Variable Preview (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Templates Cards (7 cols) */}
        <div className="lg:col-span-7 space-y-3">
          {filteredTemplates.map((tpl) => {
            const isSelected = previewTemplate?.id === tpl.id;
            return (
              <div
                key={tpl.id}
                onClick={() => setPreviewTemplate(tpl)}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-slate-900 border-sky-500 shadow-md shadow-sky-950/40'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-full mr-2">
                      {tpl.category}
                    </span>
                    <h3 className="inline font-bold text-sm text-white">{tpl.title}</h3>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingTemplate(tpl);
                        setModalMode('edit');
                        setShowModal(true);
                      }}
                      className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800"
                      title="Edit template"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {tpl.isCustom && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(tpl.id);
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-800"
                        title="Delete template"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-xs text-slate-400 mb-2">{tpl.description}</p>

                <p className="text-xs text-slate-300 line-clamp-2 font-mono bg-slate-950/80 p-2 rounded-lg border border-slate-800">
                  {tpl.body}
                </p>

                <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-800/80 text-[11px]">
                  <div className="flex items-center gap-1 text-slate-500">
                    <Code2 className="w-3 h-3 text-sky-500" />
                    <span>
                      {tpl.variablesUsed.length} variables ({tpl.variablesUsed.slice(0, 3).map(v => `{${v}}`).join(', ')}...)
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onUseTemplateInSimulator(tpl);
                    }}
                    className="text-sky-400 hover:text-sky-300 font-semibold"
                  >
                    Use in Simulator &rarr;
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Live Variable Preview Pane (5 cols) */}
        <div className="lg:col-span-5">
          <div className="bg-slate-900 border border-slate-700/80 rounded-xl p-5 sticky top-20 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-emerald-400" />
                <h3 className="font-bold text-sm text-white">Live Variable Preview</h3>
              </div>
              {previewTemplate && (
                <button
                  onClick={() => handleCopy(previewTemplate.id, previewTemplate.body)}
                  className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1 rounded-lg border border-slate-700"
                >
                  {copiedId === previewTemplate.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Filled Text</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {previewTemplate ? (
              <div className="space-y-3">
                <div>
                  <h4 className="font-bold text-sm text-sky-400">{previewTemplate.title}</h4>
                  <p className="text-xs text-slate-400">{previewTemplate.description}</p>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    What Homeowner Sees (Sample Lead: Sarah, Guildford):
                  </label>
                  <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 whitespace-pre-line leading-relaxed max-h-72 overflow-y-auto">
                    {fillSampleVariables(previewTemplate.body)}
                  </div>
                </div>

                <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 space-y-1.5 text-[11px]">
                  <p className="font-semibold text-slate-300">Active Placeholders in this Template:</p>
                  <div className="flex flex-wrap gap-1">
                    {previewTemplate.variablesUsed.map((v) => (
                      <span
                        key={v}
                        className="bg-slate-800 text-sky-400 font-mono px-2 py-0.5 rounded text-[10px]"
                      >
                        {`{${v}}`}
                      </span>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => onUseTemplateInSimulator(previewTemplate)}
                  className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs py-2.5 rounded-lg shadow-sm transition"
                >
                  Load into Checkatrade Chat &rarr;
                </button>
              </div>
            ) : (
              <p className="text-xs text-slate-500">Select a template to view preview.</p>
            )}
          </div>
        </div>
      </div>

      {/* Modal: Create / Edit / AI Generate */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full p-6 shadow-2xl">
            {modalMode === 'ai' ? (
              <div>
                <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  Generate Trade Template with Gemini AI
                </h3>
                <p className="text-xs text-slate-400 mb-4">
                  Describe what kind of response template you want (e.g., weekend callout rate, deposit
                  request for materials, or pre-installation checklist).
                </p>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">Trade Category</label>
                    <input
                      type="text"
                      value={aiTrade}
                      onChange={(e) => setAiTrade(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">
                      Template Purpose / Scenario
                    </label>
                    <textarea
                      value={aiPurpose}
                      onChange={(e) => setAiPurpose(e.target.value)}
                      placeholder="e.g. Asking for 30% materials deposit before ordering boiler parts and scheduling Monday installation..."
                      rows={3}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100"
                    />
                  </div>
                </div>

                {aiError && (
                  <div className="bg-rose-950/60 border border-rose-800 rounded-lg p-2.5 text-[11px] text-rose-200 leading-relaxed">
                    <strong className="font-bold">Live engine unavailable:</strong> {aiError}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 mt-5">
                  <button
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleGenerateAiTemplate}
                    disabled={isGeneratingAi || !aiPurpose.trim()}
                    className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 px-4 py-2 rounded-lg text-xs font-bold transition disabled:opacity-50"
                  >
                    {isGeneratingAi ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Generating...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 fill-slate-950" />
                        <span>Generate Template</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <h3 className="text-base font-bold text-white mb-1">
                  {modalMode === 'edit' ? 'Edit Template' : 'Create New Template'}
                </h3>
                <p className="text-xs text-slate-400 mb-4">
                  Use placeholders like <code className="text-sky-400 font-mono">{'{customer_name}'}</code>,{' '}
                  <code className="text-sky-400 font-mono">{'{service}'}</code>,{' '}
                  <code className="text-sky-400 font-mono">{'{callout_rate}'}</code>, etc.
                </p>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">Template Title</label>
                    <input
                      type="text"
                      value={editingTemplate.title || ''}
                      onChange={(e) =>
                        setEditingTemplate((prev) => ({ ...prev, title: e.target.value }))
                      }
                      placeholder="e.g. Deposit & Part Order Confirmation"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">Category</label>
                      <select
                        value={editingTemplate.category || 'Estimates & Quotes'}
                        onChange={(e) =>
                          setEditingTemplate((prev) => ({ ...prev, category: e.target.value }))
                        }
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100"
                      >
                        <option value="Emergency & Call-Out">Emergency & Call-Out</option>
                        <option value="Estimates & Quotes">Estimates & Quotes</option>
                        <option value="Pre-Visit Triage">Pre-Visit Triage</option>
                        <option value="Availability">Availability</option>
                        <option value="Follow-Up">Follow-Up</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">Short Description</label>
                      <input
                        type="text"
                        value={editingTemplate.description || ''}
                        onChange={(e) =>
                          setEditingTemplate((prev) => ({ ...prev, description: e.target.value }))
                        }
                        placeholder="e.g. When homeowner accepts estimate"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">Template Body</label>
                    <textarea
                      value={editingTemplate.body || ''}
                      onChange={(e) =>
                        setEditingTemplate((prev) => ({ ...prev, body: e.target.value }))
                      }
                      rows={6}
                      placeholder="Hi {customer_name}, thanks for confirming..."
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100 font-mono text-xs"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 mt-5">
                  <button
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveModal}
                    className="bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-lg text-xs font-bold transition"
                  >
                    Save Template
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
