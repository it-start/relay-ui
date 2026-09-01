import React, { useState } from 'react';
import { 
  Scale, BookOpen, Shield, Code, CheckCircle, ArrowRight, Dices, 
  HelpCircle, RefreshCw, Copy, Check, Sparkles, AlertCircle 
} from 'lucide-react';
import { ROSETTA_PRINCIPLES } from '../data/rosettaPrinciples';
import { canonicalJson, syncFastHash, castTheLot } from '../utils/crypto';

export const RosettaMatrix: React.FC = () => {
  const [activePrincipleId, setActivePrincipleId] = useState<string>(ROSETTA_PRINCIPLES[0].id);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Interactive Principle 1: Just Scales Playground
  const [jsonA, setJsonA] = useState<string>('{\n  "action": "deposit",\n  "seq": 42,\n  "author": "claude"\n}');
  const [jsonB, setJsonB] = useState<string>('{\n  "author": "claude",\n  "seq": 42,\n  "action": "deposit"\n}');

  // Interactive Principle 2: Cross-Examination Playground
  const [userClaim, setUserClaim] = useState<string>('Our caching layer never serves stale data because TTL is 5 seconds.');
  const [falsificationResult, setFalsificationResult] = useState<{ counterCase: string; verdict: 'PASS' | 'VIOLATES' } | null>(null);

  // Interactive Principle 3: Role Separation Playground
  const [authorName, setAuthorName] = useState<string>('Agent-Claude');
  const [witnessName, setWitnessName] = useState<string>('Agent-ChatGPT');
  const [judgeName, setJudgeName] = useState<string>('Agent-Gemini');

  // Interactive Principle 4: Pre-declared Criterion (Genesis 18)
  const [righteousCount, setRighteousCount] = useState<number>(12);
  const [justiceThreshold, setJusticeThreshold] = useState<number>(10);

  // Interactive Principle 5: The Lot (Proverbs 18:18)
  const [lotSeed, setLotSeed] = useState<string>('RELAY_V1_ARBITRATION_SEED');
  const [lotCandidates, setLotCandidates] = useState<string>('Option A: snake_case_keys\nOption B: camelCaseKeys\nOption C: kebab-case-keys');
  const [lotWinner, setLotWinner] = useState<{ winner: string; index: number; lotProof: string } | null>(null);

  const selectedPrinciple = ROSETTA_PRINCIPLES.find(p => p.id === activePrincipleId) || ROSETTA_PRINCIPLES[0];

  // Helper calculation for Just Scales
  let hashRawA = '', hashRawB = '', hashCanA = '', hashCanB = '';
  let validJsonA = true, validJsonB = true;
  try {
    const parsedA = JSON.parse(jsonA);
    hashRawA = syncFastHash(jsonA);
    hashCanA = syncFastHash(canonicalJson(parsedA));
  } catch (e) {
    validJsonA = false;
  }
  try {
    const parsedB = JSON.parse(jsonB);
    hashRawB = syncFastHash(jsonB);
    hashCanB = syncFastHash(canonicalJson(parsedB));
  } catch (e) {
    validJsonB = false;
  }

  // Cross examination evaluator
  const runCrossExamination = () => {
    const claimLower = userClaim.toLowerCase();
    if (claimLower.includes('never') || claimLower.includes('always') || claimLower.includes('100%') || claimLower.includes('safe')) {
      setFalsificationResult({
        verdict: 'VIOLATES',
        counterCase: 'Обнаружен контрпример: если сетевой таймаут превысит TTL или часы клиентов рассинхронизированы на 6 секунд, кэш выдаст stale ответ. Утверждение "never" опровергнуто.'
      });
    } else {
      setFalsificationResult({
        verdict: 'PASS',
        counterCase: 'Состязательный агент не смог построить контрпример в рамках заданных граничных условий.'
      });
    }
  };

  // Run The Lot
  const handleCastLot = () => {
    const items = lotCandidates.split('\n').map(s => s.trim()).filter(Boolean);
    if (items.length === 0) return;
    const result = castTheLot(items, lotSeed, syncFastHash(lotCandidates));
    setLotWinner(result);
  };

  const copySnippet = () => {
    navigator.clipboard.writeText(selectedPrinciple.codeSnippet);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">
              Розеттский Камень: Древняя Юриспруденция ↔ Протоколы ИИ
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Систематическое отображение 5 древнейших принципов установления истины на архитектуру распределённых систем и консенсуса ИИ-агентов.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs of Principles */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
        {ROSETTA_PRINCIPLES.map((principle) => {
          const isActive = activePrincipleId === principle.id;
          return (
            <button
              key={principle.id}
              id={`principle-tab-${principle.id}`}
              onClick={() => setActivePrincipleId(principle.id)}
              className={`p-3 rounded-xl border text-left transition-all ${
                isActive
                  ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200 shadow-md shadow-indigo-500/10'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <div className="text-xs font-mono font-bold text-indigo-400">{principle.source}</div>
              <div className="text-xs font-semibold text-slate-200 mt-1 truncate">{principle.title}</div>
            </button>
          );
        })}
      </div>

      {/* Active Principle Detailed View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 6 Cols: Ancient Concept vs System Primitive */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <span className="text-xs font-mono text-indigo-400 font-bold uppercase">
                {selectedPrinciple.source}
              </span>
              <h3 className="text-base font-bold text-slate-100 mt-1">
                {selectedPrinciple.title}
              </h3>
            </div>

            {/* Scripture Quote */}
            <div className="bg-indigo-950/30 border border-indigo-500/30 p-3.5 rounded-lg">
              <span className="text-xs text-indigo-300 font-serif italic block">
                "{selectedPrinciple.quote}"
              </span>
            </div>

            {/* Problem in AI / Multi-Agent */}
            <div className="space-y-1">
              <span className="text-xs font-mono uppercase text-rose-400 font-semibold flex items-center space-x-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Проблема в мультиагентных системах:</span>
              </span>
              <p className="text-xs text-slate-300 bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                {selectedPrinciple.problemInAI}
              </p>
            </div>

            {/* Protocol Primitive */}
            <div className="space-y-1">
              <span className="text-xs font-mono uppercase text-emerald-400 font-semibold flex items-center space-x-1">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Протокольный инвариант (Решение):</span>
              </span>
              <p className="text-xs text-slate-300 bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                {selectedPrinciple.protocolPrimitive}
              </p>
            </div>

            {/* Code Snippet */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-mono flex items-center space-x-1">
                  <Code className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Эталонная реализация:</span>
                </span>
                <button
                  onClick={copySnippet}
                  className="flex items-center space-x-1 text-indigo-400 hover:text-indigo-300"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? 'Скопировано' : 'Копировать'}</span>
                </button>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs font-mono text-emerald-300 overflow-x-auto">
                <pre>{selectedPrinciple.codeSnippet}</pre>
              </div>
            </div>
          </div>
        </div>

        {/* Right 6 Cols: Live Interactive Lab for this principle */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 h-full flex flex-col">
            <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-300 font-bold flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <span>Интерактивный Полигон Принципа</span>
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">
                Live Test
              </span>
            </div>

            {/* Principle 1: Just Scales Playground */}
            {selectedPrinciple.interactiveType === 'canonicalizer' && (
              <div className="space-y-4 flex-1 flex flex-col justify-between">
                <div className="text-xs text-slate-400">
                  Попробуйте изменить порядок ключей или пробелы в двух JSON-объектах. Обычный хэш разойдётся (ложный конфликт), а канонический хэш останется строго идентичным!
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-mono text-slate-400 block mb-1">Payload A (Claude):</label>
                    <textarea
                      value={jsonA}
                      onChange={(e) => setJsonA(e.target.value)}
                      rows={5}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 font-mono text-xs text-slate-200 focus:border-indigo-500 outline-none"
                    />
                    <div className="mt-1 text-[10px] font-mono space-y-0.5">
                      <div className="text-slate-400 truncate">Raw SHA: {hashRawA.slice(0, 16)}...</div>
                      <div className="text-emerald-400 truncate">Just Scales SHA: {hashCanA.slice(0, 16)}...</div>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-mono text-slate-400 block mb-1">Payload B (ChatGPT):</label>
                    <textarea
                      value={jsonB}
                      onChange={(e) => setJsonB(e.target.value)}
                      rows={5}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 font-mono text-xs text-slate-200 focus:border-indigo-500 outline-none"
                    />
                    <div className="mt-1 text-[10px] font-mono space-y-0.5">
                      <div className="text-slate-400 truncate">Raw SHA: {hashRawB.slice(0, 16)}...</div>
                      <div className="text-emerald-400 truncate">Just Scales SHA: {hashCanB.slice(0, 16)}...</div>
                    </div>
                  </div>
                </div>

                {/* Comparison Card */}
                <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Сравнение сырых байт (Naive bytes):</span>
                    <span className={hashRawA === hashRawB ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                      {hashRawA === hashRawB ? '✓ Совпадают' : '✗ Ложный конфликт (False Balance)'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Сравнение по верным весам (Canonical):</span>
                    <span className={hashCanA === hashCanB ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                      {hashCanA === hashCanB ? '✓ 100% Эквивалентны (Just Weight)' : '✗ Разные данные'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Principle 2: Cross-Examination Playground */}
            {selectedPrinciple.interactiveType === 'cross_examination' && (
              <div className="space-y-4 flex-1">
                <div className="text-xs text-slate-400">
                  Введите утверждение модели. Состязательный агент попытается найти граничные условия, где утверждение терпит крах (Proverbs 18:17).
                </div>
                <div>
                  <label className="text-[11px] font-mono text-slate-400 block mb-1">Утверждение первого спикера (Claim):</label>
                  <textarea
                    value={userClaim}
                    onChange={(e) => setUserClaim(e.target.value)}
                    rows={3}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:border-indigo-500 outline-none"
                  />
                </div>
                <button
                  onClick={runCrossExamination}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition"
                >
                  Запустить Состязательный Допрос (Cross-Examine)
                </button>

                {falsificationResult && (
                  <div className={`p-3.5 rounded-lg border text-xs space-y-1.5 ${
                    falsificationResult.verdict === 'VIOLATES' 
                      ? 'bg-rose-950/30 border-rose-500/40 text-rose-200' 
                      : 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                  }`}>
                    <div className="font-bold flex items-center space-x-1.5">
                      {falsificationResult.verdict === 'VIOLATES' ? <AlertCircle className="w-4 h-4 text-rose-400" /> : <CheckCircle className="w-4 h-4 text-emerald-400" />}
                      <span>Вердикт допроса: {falsificationResult.verdict}</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-slate-300">
                      {falsificationResult.counterCase}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Principle 3: Role Separation Playground */}
            {selectedPrinciple.interactiveType === 'role_separation' && (
              <div className="space-y-4 flex-1">
                <div className="text-xs text-slate-400">
                  Проверка правила непредвзятости: Автор не может свидетельствовать в свою пользу и выносить вердикт (Author ≠ Witness ≠ Judge).
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-mono text-slate-400 block mb-1">1. Автор (Depositor):</label>
                    <input
                      type="text"
                      value={authorName}
                      onChange={(e) => setAuthorName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 font-mono text-xs text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-mono text-slate-400 block mb-1">2. Свидетель (Witness):</label>
                    <input
                      type="text"
                      value={witnessName}
                      onChange={(e) => setWitnessName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 font-mono text-xs text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-mono text-slate-400 block mb-1">3. Судья (Judge):</label>
                    <input
                      type="text"
                      value={judgeName}
                      onChange={(e) => setJudgeName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 font-mono text-xs text-slate-200"
                    />
                  </div>
                </div>

                {/* Validation Status */}
                {(() => {
                  const set = new Set([authorName.trim(), witnessName.trim(), judgeName.trim()]);
                  const isValid = set.size === 3 && !set.has('');
                  return (
                    <div className={`p-4 rounded-lg border text-xs ${
                      isValid 
                        ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200' 
                        : 'bg-rose-950/30 border-rose-500/40 text-rose-200'
                    }`}>
                      <div className="font-bold flex items-center space-x-2">
                        {isValid ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-400" />}
                        <span>{isValid ? 'Кворум валиден (Strict 3-Role Separation)' : 'Нарушение независимости (Conflict of Interest)'}</span>
                      </div>
                      <p className="mt-1 text-slate-300">
                        {isValid 
                          ? 'Все три участника процесса изолированы. Самосуд и сговор исключены.' 
                          : 'Один агент пытается совместить роли автора, свидетеля или судьи, что порождает слепые зоны галлюцинаций.'}
                      </p>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Principle 4: Pre-declared Criterion (Genesis 18) */}
            {selectedPrinciple.interactiveType === 'criterion_guard' && (
              <div className="space-y-4 flex-1">
                <div className="text-xs text-slate-400">
                  Принцип Авраама (Genesis 18): Критерий справедливости фиксируется ДО суда, а не подгоняется под результат.
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs text-slate-300 mb-1">
                      <span>Порог праведности (Justice Threshold):</span>
                      <span className="font-bold text-indigo-400">{justiceThreshold}</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={50}
                      value={justiceThreshold}
                      onChange={(e) => setJusticeThreshold(Number(e.target.value))}
                      className="w-full accent-indigo-500"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-slate-300 mb-1">
                      <span>Фактическое число доказательств (Evidence Count):</span>
                      <span className="font-bold text-emerald-400">{righteousCount}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={50}
                      value={righteousCount}
                      onChange={(e) => setRighteousCount(Number(e.target.value))}
                      className="w-full accent-emerald-500"
                    />
                  </div>
                </div>

                <div className={`p-4 rounded-lg border text-xs ${
                  righteousCount >= justiceThreshold 
                    ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200' 
                    : 'bg-rose-950/30 border-rose-500/40 text-rose-200'
                }`}>
                  <div className="font-bold">
                    {righteousCount >= justiceThreshold 
                      ? 'ВЕРДИКТ: ПОМИЛОВАНИЕ / PASS' 
                      : 'ВЕРДИКТ: ОСУЖДЕНИЕ / VIOLATES'}
                  </div>
                  <p className="mt-1 text-slate-300 text-[11px]">
                    {righteousCount >= justiceThreshold 
                      ? `Найдено ${righteousCount} праведных свидетельств (требовалось ≥ ${justiceThreshold}). Критерий выполнен.` 
                      : `Найдено только ${righteousCount} свидетельств (требовалось ≥ ${justiceThreshold}). Недостаточно для прохождения порога.`}
                  </p>
                </div>
              </div>
            )}

            {/* Principle 5: The Lot Playground */}
            {selectedPrinciple.interactiveType === 'the_lot' && (
              <div className="space-y-4 flex-1">
                <div className="text-xs text-slate-400">
                  Жребий (Proverbs 18:18): Разрешение 50/50 тупика между равноправными агентами через детерминированный VRF.
                </div>
                <div>
                  <label className="text-[11px] font-mono text-slate-400 block mb-1">Кандидаты спора (по одному в строке):</label>
                  <textarea
                    value={lotCandidates}
                    onChange={(e) => setLotCandidates(e.target.value)}
                    rows={3}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 font-mono text-xs text-slate-200"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-mono text-slate-400 block mb-1">Seed / Entropy String:</label>
                  <input
                    type="text"
                    value={lotSeed}
                    onChange={(e) => setLotSeed(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 font-mono text-xs text-slate-200"
                  />
                </div>
                <button
                  onClick={handleCastLot}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center space-x-2 transition"
                >
                  <Dices className="w-4 h-4" />
                  <span>Бросить Жребий (Cast The Lot VRF)</span>
                </button>

                {lotWinner && (
                  <div className="p-3.5 rounded-lg bg-indigo-950/40 border border-indigo-500/50 text-xs space-y-1.5">
                    <div className="text-indigo-300 font-bold flex items-center space-x-1.5">
                      <Dices className="w-4 h-4 text-indigo-400" />
                      <span>Победитель Жребия: {lotWinner.winner}</span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-300 space-y-0.5">
                      <div>Индекс: #{lotWinner.index}</div>
                      <div>Криптографическое доказательство: {lotWinner.lotProof}</div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
