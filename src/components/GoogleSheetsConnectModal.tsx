import React, { useState } from 'react';
import { KeyRound, ExternalLink, ShieldCheck, CheckCircle2, AlertTriangle, X, Copy, Check, Zap } from 'lucide-react';
import { GoogleSheetsAuthConfig } from '../utils/googleSheetsService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  authConfig: GoogleSheetsAuthConfig;
  onSaveAuth: (cfg: GoogleSheetsAuthConfig) => void;
  targetSheetId: string;
  targetTab: string | number;
  onConfirmPush?: () => void;
  pendingPushDescription?: string;
}

export const GoogleSheetsConnectModal: React.FC<Props> = ({
  isOpen,
  onClose,
  authConfig,
  onSaveAuth,
  targetSheetId,
  targetTab,
  onConfirmPush,
  pendingPushDescription
}) => {
  const [tokenInput, setTokenInput] = useState(authConfig.accessToken || '');
  const [webhookInput, setWebhookInput] = useState(authConfig.webhookUrl || '');
  const [activeMode, setActiveMode] = useState<'token' | 'apps_script'>('token');
  const [copiedScript, setCopiedScript] = useState(false);
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  if (!isOpen) return null;

  const handleSaveAndPush = async () => {
    const updated: GoogleSheetsAuthConfig = {
      accessToken: tokenInput.trim() || undefined,
      webhookUrl: webhookInput.trim() || undefined
    };
    onSaveAuth(updated);
    if (onConfirmPush) {
      onConfirmPush();
    }
    onClose();
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestStatus(null);
    try {
      if (webhookInput.trim()) {
        const res = await fetch(webhookInput.trim(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'ping', spreadsheetId: targetSheetId, tabName: targetTab })
        });
        if (res.ok) {
          setTestStatus('✅ Apps Script Webhook connection successful!');
        } else {
          setTestStatus(`⚠️ Webhook responded with HTTP ${res.status}`);
        }
      } else if (tokenInput.trim()) {
        const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${targetSheetId}?fields=sheets.properties.title`, {
          headers: { Authorization: `Bearer ${tokenInput.trim()}` }
        });
        if (res.ok) {
          const data = await res.json();
          const tabNames = (data.sheets || []).map((s: any) => s.properties.title);
          const hasTab = tabNames.includes(String(targetTab));
          setTestStatus(`✅ Connected to Google Sheets! Available tabs: ${tabNames.join(', ')}. Target tab "${targetTab}" ${hasTab ? 'is ready.' : 'NOT FOUND in sheet (please create it).'}`);
        } else if (res.status === 401 || res.status === 403) {
          setTestStatus('❌ Token rejected: 401/403. Check permissions or refresh token.');
        } else if (res.status === 404) {
          setTestStatus('❌ Spreadsheet not found. Verify the Spreadsheet ID.');
        } else {
          setTestStatus(`⚠️ API responded with HTTP ${res.status}`);
        }
      } else {
        setTestStatus('⚠️ Please enter an Access Token or Apps Script URL.');
      }
    } catch (e: any) {
      setTestStatus(`❌ Connection error: ${e.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  const appsScriptCode = `// Paste into Extensions > Apps Script in your Google Sheet, then Deploy as Web App
function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(payload.tabName) || ss.getSheetByName(String(payload.tabName));
    if (!sheet) return ContentService.createTextOutput(JSON.stringify({ error: "Tab not found: " + payload.tabName })).setMimeType(ContentService.MimeType.JSON);
    
    var data = sheet.getDataRange().getValues();
    var nameCol = 3; // Column D (Product Name)
    var targetColLetter = payload.column || "G"; // Col G, H, K, or L
    var colIdx = targetColLetter.charCodeAt(0) - 64; // 1-based col
    
    var count = 0;
    payload.items.forEach(function(item) {
      for (var r = 0; r < data.length; r++) {
        var rowName = String(data[r][nameCol] || "").trim().toLowerCase();
        if (rowName && rowName.indexOf(item.itemName.toLowerCase()) !== -1) {
          sheet.getRange(r + 1, colIdx).setValue(item.value);
          count++;
          break;
        }
      }
    });
    return ContentService.createTextOutput(JSON.stringify({ success: true, updatedCount: count })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}`;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4 safe-pb">
      <div className="bg-slate-900 border border-slate-700 rounded-t-2xl sm:rounded-2xl w-full max-w-xl max-h-[92dvh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70 shrink-0">
          <div className="flex items-center space-x-2.5 min-w-0 pr-2">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20 shrink-0">
              <KeyRound className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white truncate">Google Sheets Real-Time Connection</h3>
              <p className="text-xs text-slate-400 truncate">Target: Tab "{targetTab}" in ID {targetSheetId.slice(0, 15)}...</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="text-slate-400 hover:text-white min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-slate-800 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {pendingPushDescription && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span>{pendingPushDescription}</span>
              <span className="font-mono font-bold bg-emerald-500/20 px-2.5 py-1 rounded text-[11px] self-start sm:self-auto shrink-0">Tab "{targetTab}"</span>
            </div>
          )}

          {/* Mode Switcher */}
          <div className="flex flex-col sm:flex-row bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs gap-1">
            <button
              onClick={() => setActiveMode('token')}
              className={`flex-1 min-h-[44px] px-3 py-2 rounded-lg font-medium transition-colors ${
                activeMode === 'token' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Option 1: Google OAuth Access Token
            </button>
            <button
              onClick={() => setActiveMode('apps_script')}
              className={`flex-1 min-h-[44px] px-3 py-2 rounded-lg font-medium transition-colors ${
                activeMode === 'apps_script' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Option 2: 1-Minute Apps Script Webhook
            </button>
          </div>

          {activeMode === 'token' ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Google OAuth Bearer Token:
                </label>
                <input
                  type="password"
                  value={tokenInput}
                  onChange={e => setTokenInput(e.target.value)}
                  placeholder="ya29.a0Ac..."
                  className="w-full min-h-[44px] bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-base lg:text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                />
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  Enter your Google OAuth token with <code className="text-emerald-400">spreadsheets</code> scope. You can obtain a temporary token from Google OAuth Playground or your Google Cloud service credentials.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 text-xs text-slate-400 space-y-1">
                <div className="text-slate-300 font-semibold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Formula &amp; Column Protection:</span>
                </div>
                <div>Targeted cells update strictly Column G, H, K, or L for matching item names. Existing formulas in Col J (Inventory) and Col M (Shrinkage) are 100% untouched.</div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Google Apps Script Web App URL:
                </label>
                <input
                  type="text"
                  value={webhookInput}
                  onChange={e => setWebhookInput(e.target.value)}
                  placeholder="https://script.google.com/macros/s/AKfycbx.../exec"
                  className="w-full min-h-[44px] bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-base lg:text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-slate-300">Quick Apps Script for your Sheet:</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(appsScriptCode);
                      setCopiedScript(true);
                      setTimeout(() => setCopiedScript(false), 2000);
                    }}
                    className="flex items-center space-x-1.5 min-h-[44px] px-2.5 text-emerald-400 hover:text-emerald-300 text-xs font-semibold shrink-0"
                  >
                    {copiedScript ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedScript ? 'Copied Script!' : 'Copy Script'}</span>
                  </button>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  In your Google Sheet, open <b>Extensions &gt; Apps Script</b>, paste this script, click <b>Deploy &gt; New deployment &gt; Web app (Anyone)</b>, and paste the URL above.
                </p>
              </div>
            </div>
          )}

          {testStatus && (
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono break-words">
              {testStatus}
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
          <button
            onClick={handleTestConnection}
            disabled={isTesting}
            className="w-full sm:w-auto min-h-[44px] px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition-colors"
          >
            {isTesting ? 'Testing...' : 'Test Connection'}
          </button>

          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2">
            <button
              onClick={onClose}
              className="w-full sm:w-auto min-h-[44px] px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveAndPush}
              className="w-full sm:w-auto min-h-[44px] px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center space-x-1.5"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Save &amp; Push to Tab "{targetTab}"</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
