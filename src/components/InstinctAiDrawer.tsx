'use client';

import React, { useState } from 'react';
import { Bot, CheckCircle2, ExternalLink, KeyRound, Send, Terminal } from 'lucide-react';
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

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey.trim() ? { Authorization: `Bearer ${apiKey.trim()}` } : {}),
        },
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
      subtitle="Test authenticated /api/ai/ingest & /api/ai/query endpoints"
    >
      <div className="space-y-4">
        {/* Mode Switcher */}
        <div className="grid grid-cols-2 gap-2 p-1.5 bg-[#EBE6DC] rounded-xl border-2 border-[#CFC8BA]">
          <button
            type="button"
            onClick={() => {
              setMode('ingest');
              setInput(SAMPLE_INGEST);
              setResult(null);
            }}
            className={`min-h-[48px] rounded-lg font-extrabold text-sm transition ${
              mode === 'ingest'
                ? 'bg-[#1B4D2E] text-white shadow-sm'
                : 'text-[#141714] hover:bg-white/60'
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
            className={`min-h-[48px] rounded-lg font-extrabold text-sm transition ${
              mode === 'query'
                ? 'bg-[#1B4D2E] text-white shadow-sm'
                : 'text-[#141714] hover:bg-white/60'
            }`}
          >
            POST /api/ai/query
          </button>
        </div>

        <form onSubmit={handleRun} className="space-y-4">
          <div>
            <label htmlFor="instinct-api-key" className="field-label flex items-center gap-1.5">
              <KeyRound className="w-4 h-4" />
              Bearer API Key (AI_API_KEY)
            </label>
            <input
              id="instinct-api-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Paste AI_API_KEY from .env"
              className="field-input font-mono text-sm"
              autoComplete="off"
            />
          </div>

          <div>
            <label htmlFor="instinct-input" className="field-label flex items-center gap-1.5">
              <Bot className="w-4 h-4" />
              {mode === 'ingest' ? 'Voice / Text Note Transcript' : 'Ranch Question'}
            </label>
            <textarea
              id="instinct-input"
              rows={3}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="field-input resize-none"
              placeholder={
                mode === 'ingest'
                  ? 'e.g., Cow 214 had a bull calf, gave her penicillin, spent $320 on hay...'
                  : 'e.g., How many cows are pregnant and what did I spend on feed this month?'
              }
            />
          </div>

          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="w-full min-h-[54px] flex items-center justify-center gap-2 rounded-xl bg-[#1B4D2E] hover:bg-[#133922] disabled:opacity-50 text-white font-extrabold text-base border-2 border-[#141714] shadow-[0_2px_0_#141714] active:translate-y-0.5 transition"
          >
            <Send className="w-5 h-5" />
            {loading
              ? 'Running...'
              : mode === 'ingest'
              ? 'Send Voice Note to /api/ai/ingest'
              : 'Ask /api/ai/query'}
          </button>
        </form>

        {result && (
          <div
            className={`p-4 rounded-xl border-2 space-y-2 ${
              result.ok
                ? 'bg-[#DCFCE7] border-[#15803D] text-[#14532D]'
                : 'bg-[#FEE2E2] border-[#B91C1C] text-[#7F1D1D]'
            }`}
          >
            <div className="flex items-start gap-2 font-extrabold text-base">
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{result.headline}</span>
            </div>
            {result.raw != null && (
              <details className="text-xs">
                <summary className="cursor-pointer font-bold underline">
                  Inspect JSON Response
                </summary>
                <pre className="mt-2 p-3 rounded-lg bg-[#141714] text-[#F4F1EA] overflow-x-auto font-mono text-xs leading-relaxed">
                  {JSON.stringify(result.raw, null, 2)}
                </pre>
              </details>
            )}
          </div>
        )}

        <div className="p-4 rounded-xl bg-white border-2 border-[#CFC8BA] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Terminal className="w-5 h-5 text-[#1B4D2E] shrink-0" />
            <div>
              <p className="font-extrabold text-sm text-[#141714]">OpenAPI 3.1 Schema</p>
              <p className="text-xs font-medium text-[#474E47]">
                Import directly into Instinct AI tools
              </p>
            </div>
          </div>
          <a
            href="/api/openapi"
            target="_blank"
            rel="noreferrer"
            className="min-h-[44px] px-3.5 inline-flex items-center gap-1.5 rounded-xl bg-[#EBE6DC] hover:bg-[#DFD9CC] border-2 border-[#141714] text-xs font-extrabold text-[#141714]"
          >
            openapi.json
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </ModalSheet>
  );
}
