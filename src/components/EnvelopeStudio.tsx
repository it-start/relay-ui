import React, { useState, useEffect } from 'react';
import { 
  Binary, Copy, Check, RefreshCw, AlertTriangle, ShieldCheck, 
  Layers, ArrowRight, Sparkles, CheckCircle2, XCircle 
} from 'lucide-react';
import { generateUUIDv7, canonicalJson, syncFastHash } from '../utils/crypto';

export const EnvelopeStudio: React.FC = () => {
  const [envelopeType, setEnvelopeType] = useState<'claim' | 'challenge' | 'finding' | 'ruling' | 'message'>('claim');
  const [storeId, setStoreId] = useState<string>('urn:relay:store:agent-mesh-01');
  const [locator, setLocator] = useState<string>('relay-0183');
  const [author, setAuthor] = useState<string>('agent:claude-code-cli');
  const [recipient, setRecipient] = useState<string>('agent:gemini-judge');
  const [seq, setSeq] = useState<number>(183);
  const [uuid, setUuid] = useState<string>(generateUUIDv7());
  const [payloadText, setPayloadText] = useState<string>(
    JSON.stringify(
      {
        claim: "atomic_exclusive_marker_retained",
        remedy: "retain empty marker history/relay-0183 upon payload delete",
        conforming_to: "SPEC.md#MUST-1"
      },
      null,
      2
    )
  );

  const [copied, setCopied] = useState<boolean>(false);
  const [useCurvedScales, setUseCurvedScales] = useState<boolean>(false);

  let parsedPayload: any = {};
  let isJsonValid = true;
  try {
    parsedPayload = JSON.parse(payloadText);
  } catch (e) {
    isJsonValid = false;
  }

  // Generate canonical digest
  const canonicalBytes = isJsonValid ? canonicalJson(parsedPayload) : '';
  const justScalesDigest = isJsonValid ? syncFastHash(canonicalBytes) : 'ERR_INVALID_JSON';
  const curvedScalesDigest = isJsonValid ? syncFastHash(payloadText) : 'ERR_INVALID_JSON';
  const activeDigest = useCurvedScales ? curvedScalesDigest : justScalesDigest;

  const fullEnvelope = {
    id: uuid,
    seq: seq,
    type: envelopeType,
    store_id: storeId,
    locator: locator,
    digest: `sha256:${activeDigest}`,
    from: author,
    to: recipient,
    header_block: {
      id: uuid,
      deposited_by: author,
      timestamp: new Date().toISOString()
    },
    payload: isJsonValid ? parsedPayload : { raw: payloadText }
  };

  const copyEnvelope = () => {
    navigator.clipboard.writeText(JSON.stringify(fullEnvelope, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const regenerateUuid = () => {
    setUuid(generateUUIDv7());
  };

  // Spec Conformance Checks
  const checks = [
    {
      name: 'Just Scales Canonicalization (Prov 11:1)',
      pass: !useCurvedScales && isJsonValid,
      desc: useCurvedScales ? 'Curved scales active! Naive raw byte hashing causes boundary drift.' : 'Keys recursively sorted, normalized formatting.'
    },
    {
      name: 'Header Block ID Parity (SPEC MUST 6)',
      pass: fullEnvelope.id === fullEnvelope.header_block.id,
      desc: 'Top-level id matches internal header block optional-and-checked id.'
    },
    {
      name: 'Cross-Store 3-Tuple Citation (SPEC Citation Rule)',
      pass: Boolean(fullEnvelope.store_id && fullEnvelope.locator && fullEnvelope.digest),
      desc: 'Contains complete (store_id, locator, content_digest) tuple.'
    },
    {
      name: 'Time-Sorted K-Sortable UUIDv7',
      pass: uuid.startsWith(Date.now().toString(16).slice(0, 4)) || uuid.includes('-7'),
      desc: 'UUIDv7 embeds millisecond epoch for monotonic ordering.'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Binary className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">
                Конструктор Конвертов Relay v1 (Envelope & Scales Studio)
              </h2>
              <p className="text-xs sm:text-sm text-slate-400">
                Генератор канонических конвертов сообщений с вычислением SHA-256 дайджеста и проверкой соответствия инвариантам SPEC.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setUseCurvedScales(!useCurvedScales)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                useCurvedScales
                  ? 'bg-rose-950/50 border-rose-500/60 text-rose-300'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {useCurvedScales ? '⚠️ Кривые весы (Curved Scales ON)' : '⚖️ Верные весы (Just Scales ON)'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 5 Cols: Envelope Config Form */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold border-b border-slate-800 pb-2">
              Параметры конверта (Envelope Fields)
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Тип конверта (Type):</label>
                <select
                  value={envelopeType}
                  onChange={(e: any) => setEnvelopeType(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200"
                >
                  <option value="claim">claim (Заявление / Предложение)</option>
                  <option value="challenge">challenge (Состязательное возражение)</option>
                  <option value="finding">finding (Наблюдение эксперта)</option>
                  <option value="ruling">ruling (Окончательное решение / коммит)</option>
                  <option value="message">message (Рядовое релей-сообщение)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block mb-1">Sequence (seq):</label>
                  <input
                    type="number"
                    value={seq}
                    onChange={(e) => setSeq(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 font-mono text-slate-200"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Locator (relay-NNNN):</label>
                  <input
                    type="text"
                    value={locator}
                    onChange={(e) => setLocator(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 font-mono text-slate-200"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Store Authority ID:</label>
                <input
                  type="text"
                  value={storeId}
                  onChange={(e) => setStoreId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 font-mono text-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block mb-1">From (Author):</label>
                  <input
                    type="text"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 font-mono text-slate-200"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">To (Recipient):</label>
                  <input
                    type="text"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 font-mono text-slate-200"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-400">UUIDv7 (Time-Ordered):</label>
                  <button
                    onClick={regenerateUuid}
                    className="text-indigo-400 hover:text-indigo-300 text-[11px] flex items-center space-x-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Сгенерировать</span>
                  </button>
                </div>
                <input
                  type="text"
                  readOnly
                  value={uuid}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 font-mono text-slate-400 text-[11px]"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Тело сообщения (Payload JSON):</label>
                <textarea
                  value={payloadText}
                  onChange={(e) => setPayloadText(e.target.value)}
                  rows={6}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 font-mono text-slate-200 text-xs focus:border-indigo-500 outline-none"
                />
                {!isJsonValid && (
                  <span className="text-rose-400 text-[10px] block mt-1">
                    ⚠️ Ошибка синтаксиса JSON в теле сообщения
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Invariant Health Checklist */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2.5">
            <span className="text-xs font-mono text-slate-400 uppercase tracking-wider font-bold block">
              Проверка Соответствия Инвариантам:
            </span>
            <div className="space-y-2">
              {checks.map((c, i) => (
                <div key={i} className="flex items-start space-x-2 text-xs">
                  {c.pass ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <span className={`font-semibold ${c.pass ? 'text-slate-200' : 'text-rose-300'}`}>
                      {c.name}
                    </span>
                    <p className="text-[11px] text-slate-400">{c.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right 7 Cols: Canonical JSON Envelope Output */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold">
                  Итоговый Relay v1 Envelope JSON
                </span>
                <div className="text-[11px] text-emerald-400 font-mono mt-0.5">
                  Digest: sha256:{activeDigest}
                </div>
              </div>

              <button
                onClick={copyEnvelope}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Скопировано!' : 'Копировать JSON'}</span>
              </button>
            </div>

            <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-xs text-emerald-300 overflow-x-auto max-h-[520px]">
              <pre>{JSON.stringify(fullEnvelope, null, 2)}</pre>
            </div>

            <div className="text-[11px] text-slate-400 bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
              💡 <span className="font-semibold text-slate-300">Правило цитирования SPEC MUST 5:</span> Любая ссылка на этот документ в стороннем релей-хранилище обязана передаваться в виде 3-кортежа: <code className="text-indigo-300 font-mono">({fullEnvelope.store_id}, {fullEnvelope.locator}, {fullEnvelope.digest.slice(0, 15)}...)</code>.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
