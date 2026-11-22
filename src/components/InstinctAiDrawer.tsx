'use client';

import React, { useState } from 'react';
import { CheckCircle2, ExternalLink, KeyRound, Send, ShieldCheck, Terminal } from 'lucide-react';
import { ModalSheet } from './Badges';

const SAMPLE_INGEST =
  'Cow 214 had a bull calf this morning, gave her a shot of penicillin, and spent $320 on hay at the co-op';
const SAMPLE_QUERY =
  'How many cows are pregnant and what did I spend on feed this month?';

export function InstinctAiDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<'ingest' | 'query'>('ingest');
  const [apiKey, setApiKey] = useState('');
  const [input, setInput] = useState(SAMPLE_INGEST);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    ok: boolean;
    headline: string;
    raw: unknown;
  } | null>(null);

  async function handleRun(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    setLoading(true);
    setResult(null);

    try {
      const endpoint = mode === 'ingest' ? '/api/ai/ingest' : '/api/ai/query';
      const body =
        mode === 'ingest'
          ? { transcript: input.trim() }
          : { question: input.trim() };

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (apiKey.trim()) {
        headers.Authorization = `Bearer ${apiKey.trim()}`;
      }
      if (mode === 'ingest' && typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        headers['Idempotency-Key'] = `ui-${crypto.randomUUID()}`;
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      const data = await res.json();
      setResult({
        ok: res.ok,
        headline:
          data.message ||
          data.summary ||
          data.error ||
          (res.ok ? 'Request succeeded.' : `HTTP ${res.status}`),
        raw: data,
      });

      if (res.ok && mode === 'ingest') {
        window.dispatchEvent(new CustomEvent('granch:data-changed'));
      }
    } catch {
      setResult({
        ok: false,
        headline: 'Network error calling Instinct AI endpoint.',
        raw: null,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModalSheet
      open={open}
      onClose={onClose}
      title="Instinct AI Console"
      subtitle="Run multi-action voice notes or natural-language ranch queries"
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-[#E2E0D9] text-xs text-[#525753]">
          <ShieldCheck className="w-4 h-4 text-[#157347] shrink-0" />
          <span>
            Authenticated via your owner session. External Instinct AI calls require{' '}
            <code className="font-mono text-[#111312]">Bearer AI_API_KEY</code>.
          </span>
        </div>

        <div className="grid grid-cols-2 gap-1 p-1 bg-[#EFEDE8] rounded-lg border border-[#E2E0D9]">
          <button
            type="button"
            onClick={() => {
              setMode('ingest');
              setInput(SAMPLE_INGEST);
              setResult(null);
            }}
            className={`min-h-[42px] rounded-md font-mono font-semibold text-xs transition ${
              mode === 'ingest'
                ? 'bg-white text-[#111312] shadow-xs border border-[#E2E0D9]'
                : 'text-[#525753] hover:text-[#111312]'
            }`}
          >
            POST /api/ai/ingest
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('query');
              setInput(SAMPLE_QUERY);
              setResult(null);
            }}
            className={`min-h-[42px] rounded-md font-mono font-semibold text-xs transition ${
              mode === 'query'
                ? 'bg-white text-[#111312] shadow-xs border border-[#E2E0D9]'
                : 'text-[#525753] hover:text-[#111312]'
            }`}
          >
            POST /api/ai/query
          </button>
        </div>

        <form onSubmit={handleRun} className="space-y-4">
          <div>
            <label htmlFor="instinct-input" className="field-label">
              {mode === 'ingest' ? 'Voice / Text Transcript' : 'Ranch Query'}
            </label>
            <textarea
              id="instinct-input"
              rows={3}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="field-input resize-none"
            />
          </div>

          <details className="text-xs">
            <summary className="cursor-pointer font-semibold text-[#767C77] hover:text-[#111312] inline-flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5" />
              Optional: Override with External Bearer Key
            </summary>
            <div className="mt-2">
              <input
                id="instinct-api-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Leave blank to use signed-in owner session"
                className="field-input font-mono text-xs min-h-[42px]!"
                autoComplete="off"
              />
            </div>
          </details>

          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="w-full min-h-[50px] flex items-center justify-center gap-2 rounded-lg bg-[#173324] hover:bg-[#0F2419] disabled:opacity-50 text-white font-semibold text-sm transition"
          >
            <Send className="w-4 h-4" />
            {loading
              ? 'Executing...'
              : mode === 'ingest'
              ? 'Send to /api/ai/ingest'
              : 'Query /api/ai/query'}
          </button>
        </form>

        {result && (
          <div
            className={`p-4 rounded-lg bg-white border border-[#E2E0D9] border-l-[3px] space-y-2 ${
              result.ok ? 'border-l-[#157347]' : 'border-l-[#B42318]'
            }`}
          >
            <div className="flex items-start gap-2 font-semibold text-sm text-[#111312]">
              <CheckCircle2
                className={`w-4 h-4 shrink-0 mt-0.5 ${
                  result.ok ? 'text-[#157347]' : 'text-[#B42318]'
                }`}
              />
              <span>{result.headline}</span>
            </div>
            {result.raw != null && (
              <details className="text-xs">
                <summary className="cursor-pointer font-semibold text-[#525753]">
                  Inspect JSON Payload
                </summary>
                <pre className="mt-2 p-3 rounded-lg bg-[#111312] text-[#F5F4F0] overflow-x-auto font-mono text-xs leading-relaxed">
                  {JSON.stringify(result.raw, null, 2)}
                </pre>
              </details>
            )}
          </div>
        )}

        <div className="p-3.5 rounded-lg bg-white border border-[#E2E0D9] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Terminal className="w-4 h-4 text-[#525753] shrink-0" />
            <div>
              <p className="font-semibold text-sm text-[#111312]">Protected OpenAPI 3.1 Spec</p>
              <p className="text-xs text-[#767C77]">Requires owner session or Bearer key</p>
            </div>
          </div>
          <a
            href="/api/openapi"
            target="_blank"
            rel="noreferrer"
            className="min-h-[38px] px-3 inline-flex items-center gap-1.5 rounded-md bg-[#F5F4F0] hover:bg-[#EFEDE8] border border-[#D6D3CB] text-xs font-mono font-semibold text-[#111312]"
          >
            openapi.json
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </ModalSheet>
  );
}
