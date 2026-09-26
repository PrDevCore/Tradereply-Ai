import React, { useState } from 'react';
import { generateExtensionFiles, ExtensionFiles } from '../utils/extensionGenerator.ts';
import { createExtensionZip } from '../utils/zip.ts';
import {
  Download,
  Copy,
  Check,
  FileCode,
  FolderArchive,
  ExternalLink,
  ShieldCheck,
  Terminal,
} from 'lucide-react';

export const ExportExtensionModal: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<keyof ExtensionFiles>('manifest.json');
  const [copied, setCopied] = useState<boolean>(false);

  const files = generateExtensionFiles(window.location.origin);

  const handleCopy = () => {
    navigator.clipboard.writeText(files[selectedFile]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadFile = (fileName: keyof ExtensionFiles) => {
    const content = files[fileName];
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadAll = () => {
    const blob = new Blob([createExtensionZip({ ...files }).buffer], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'tradereply-ai-extension.zip';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            <Download className="w-6 h-6 text-emerald-400" />
            <span>Export Google Chrome Extension (Manifest V3)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Download the production-ready browser extension code to run TradeReply AI natively on
            Checkatrade, MyBuilder, and rated directory portals.
          </p>
        </div>

        <button
          onClick={handleDownloadAll}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2.5 rounded-lg shadow-lg shadow-emerald-700/20 transition"
        >
          <FolderArchive className="w-4 h-4" />
          <span>Download Extension ZIP</span>
        </button>
      </div>

      {/* Guide Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6 grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
        <div className="flex items-start gap-2.5">
          <span className="w-5 h-5 rounded-full bg-sky-500 text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
            1
          </span>
          <div>
            <p className="font-bold text-white">Download and Extract</p>
            <p className="text-slate-400 text-[11px]">Extract the ZIP into a folder named <code>tradereply-ext</code></p>
          </div>
        </div>

        <div className="flex items-start gap-2.5">
          <span className="w-5 h-5 rounded-full bg-sky-500 text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
            2
          </span>
          <div>
            <p className="font-bold text-white">Open Chrome Extensions</p>
            <p className="text-slate-400 text-[11px]">Navigate to <code>chrome://extensions</code></p>
          </div>
        </div>

        <div className="flex items-start gap-2.5">
          <span className="w-5 h-5 rounded-full bg-sky-500 text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
            3
          </span>
          <div>
            <p className="font-bold text-white">Enable Developer Mode</p>
            <p className="text-slate-400 text-[11px]">Toggle switch in the top right corner</p>
          </div>
        </div>

        <div className="flex items-start gap-2.5">
          <span className="w-5 h-5 rounded-full bg-sky-500 text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
            4
          </span>
          <div>
            <p className="font-bold text-white">Click "Load Unpacked"</p>
            <p className="text-slate-400 text-[11px]">Select the extracted folder itself (the one containing <code>manifest.json</code>)</p>
          </div>
        </div>
      </div>

      {/* Code Viewer */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
        {/* Tab List */}
        <div className="bg-slate-950 px-4 py-2 border-b border-slate-800 flex items-center justify-between overflow-x-auto gap-2">
          <div className="flex items-center gap-1">
            {(Object.keys(files) as Array<keyof ExtensionFiles>).map((fileName) => (
              <button
                key={fileName}
                onClick={() => setSelectedFile(fileName)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition ${
                  selectedFile === fileName
                    ? 'bg-slate-800 text-sky-400 font-bold border border-slate-700'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>{fileName}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1 rounded-lg text-xs font-medium border border-slate-700 transition"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Code</span>
                </>
              )}
            </button>
            <button
              onClick={() => handleDownloadFile(selectedFile)}
              className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-500 text-white px-3 py-1 rounded-lg text-xs font-semibold shadow-sm transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download File</span>
            </button>
          </div>
        </div>

        {/* Code Content */}
        <div className="p-4 bg-slate-950 text-xs font-mono text-slate-300 overflow-x-auto max-h-[500px] overflow-y-auto leading-relaxed whitespace-pre">
          {files[selectedFile]}
        </div>
      </div>
    </div>
  );
};
