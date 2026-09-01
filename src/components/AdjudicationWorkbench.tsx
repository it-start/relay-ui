import React, { useState, useEffect } from 'react';
import { 
  Play, Pause, RotateCcw, ChevronRight, CheckCircle2, XCircle, 
  AlertTriangle, Shield, Scale, Dices, FileText, Check, Copy, Sparkles,
  ArrowRight, ShieldCheck, HelpCircle
} from 'lucide-react';
import { SIMULATION_CASES } from '../data/simulationScenarios';
import { AdjudicationCase, AdjudicationPhase, FindingVerdict } from '../types';
import { motion, AnimatePresence } from 'motion/react';

export const AdjudicationWorkbench: React.FC = () => {
  const [selectedCaseId, setSelectedCaseId] = useState<string>(SIMULATION_CASES[0].id);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [copiedLog, setCopiedLog] = useState<boolean>(false);
  const [customClaimText, setCustomClaimText] = useState<string>('');
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);

  const activeCase: AdjudicationCase = SIMULATION_CASES.find(c => c.id === selectedCaseId) || SIMULATION_CASES[0];
  const steps = activeCase.steps;
  const currentStep = steps[currentStepIndex] || steps[0];
  const isFinished = currentStepIndex >= steps.length - 1;

  // Auto-play timer
  useEffect(() => {
    let timer: any;
    if (isPlaying && !isFinished) {
      timer = setTimeout(() => {
        setCurrentStepIndex(prev => prev + 1);
      }, 2200);
    } else if (isFinished) {
      setIsPlaying(false);
    }
    return () => clearTimeout(timer);
  }, [isPlaying, currentStepIndex, isFinished]);

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentStepIndex(0);
  };

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  const copyTranscript = () => {
    const transcript = steps
      .slice(0, currentStepIndex + 1)
      .map(s => `[${s.timestamp}] ${s.agent.name} (${s.phase.toUpperCase()}):\n${s.description}\nLog: ${s.outputLog || ''}`)
      .join('\n\n');
    navigator.clipboard.writeText(transcript);
    setCopiedLog(true);
    setTimeout(() => setCopiedLog(false), 2000);
  };

  const phases: { id: AdjudicationPhase; label: string; icon: string; scripture: string }[] = [
    { id: 'claim', label: '1. Claim', icon: '📝', scripture: 'Deposit / Outcry' },
    { id: 'weighing', label: '2. Weighing', icon: '⚖️', scripture: 'Prov 11:1 (Just Scales)' },
    { id: 'challenge', label: '3. Challenge', icon: '🛡️', scripture: 'Prov 18:17 (Cross-Exam)' },
    { id: 'criterion_check', label: '4. Criterion', icon: '📜', scripture: 'Gen 18:25 (Threshold)' },
    { id: 'arbitration', label: '5. The Lot', icon: '🎲', scripture: 'Prov 18:18 (VRF Tie-Break)' },
    { id: 'ruling', label: '6. Ruling', icon: '🏛️', scripture: 'Append-Only Commit' },
  ];

  const getPhaseStatus = (phase: AdjudicationPhase) => {
    const stepWithPhase = steps.findIndex(s => s.phase === phase);
    if (stepWithPhase === -1) return 'skipped';
    if (stepWithPhase < currentStepIndex) return 'completed';
    if (stepWithPhase === currentStepIndex) return 'active';
    return 'pending';
  };

  const getVerdictBadge = (verdict?: FindingVerdict) => {
    if (!verdict) return null;
    if (verdict === 'PASS') {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>PASS (Invariants Held)</span>
        </span>
      );
    }
    if (verdict === 'VIOLATES') {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
          <XCircle className="w-3.5 h-3.5" />
          <span>VIOLATES (Countercase Found)</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
        <AlertTriangle className="w-3.5 h-3.5" />
        <span>UNDECIDABLE (Split / Needs Lot)</span>
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Scenario Selector */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 backdrop-blur-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xl font-bold text-slate-100">
                Интерактивное Судилище Агентов (Adjudication Court)
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Finding ≠ Ruling
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-1 max-w-3xl">
              Полигон разрешения споров между агентами: от сырого заявления (Claim) через взвешивание на верных весах (Proverbs 11:1), состязательный раунд (Proverbs 18:17) и проверку инвариантов до финального коммита в лог.
            </p>
          </div>

          {/* Preset Case Selector */}
          <div className="flex items-center space-x-2 overflow-x-auto pb-1">
            {SIMULATION_CASES.map((scCase) => (
              <button
                key={scCase.id}
                id={`btn-case-${scCase.id}`}
                onClick={() => {
                  setSelectedCaseId(scCase.id);
                  handleReset();
                }}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all text-left border shrink-0 ${
                  selectedCaseId === scCase.id
                    ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200'
                    : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <div className="font-semibold text-slate-200">{scCase.title.split(':')[0]}</div>
                <div className="text-[10px] text-slate-400 truncate max-w-[150px]">{scCase.title.split(':')[1] || scCase.title}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Active Case Summary Card */}
        <div className="mt-4 pt-4 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
            <span className="text-slate-400 block font-mono text-[11px] mb-1">ПРЕДМЕТ СПОРА:</span>
            <span className="text-slate-200 font-medium">{activeCase.summary}</span>
          </div>
          <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
            <span className="text-slate-400 block font-mono text-[11px] mb-1">ФИКСИРОВАННЫЙ КРИТЕРИЙ (CRITERION):</span>
            <span className="text-indigo-300 font-mono font-semibold">{activeCase.criterionRef}</span>
            <p className="text-slate-400 mt-1 line-clamp-2">{activeCase.criterionText}</p>
          </div>
          <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
            <span className="text-slate-400 block font-mono text-[11px] mb-1">ПЕРВИЧНЫЙ ДАЙДЖЕСТ (SHA-256):</span>
            <span className="text-emerald-400 font-mono break-all text-[11px]">{activeCase.initialClaim.digest}</span>
            <div className="mt-1 text-slate-400">Автор: <span className="text-slate-200 font-medium">{activeCase.initialClaim.author}</span></div>
          </div>
        </div>
      </div>

      {/* Visual State Machine Diagram */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center space-x-2">
            <Scale className="w-4 h-4 text-indigo-400" />
            <span>State Machine Фаз Арбитража</span>
          </div>
          <div className="text-xs text-slate-400">
            Шаг <span className="text-indigo-400 font-bold">{currentStepIndex + 1}</span> из <span className="font-bold">{steps.length}</span>
          </div>
        </div>

        {/* Pipeline Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {phases.map((p, idx) => {
            const status = getPhaseStatus(p.id);
            return (
              <div
                key={p.id}
                className={`relative rounded-lg p-3 border transition-all ${
                  status === 'active'
                    ? 'bg-indigo-600/20 border-indigo-500 shadow-md shadow-indigo-500/10'
                    : status === 'completed'
                    ? 'bg-slate-950 border-emerald-600/40 text-slate-300'
                    : status === 'skipped'
                    ? 'bg-slate-950/30 border-slate-800/40 opacity-40 text-slate-500'
                    : 'bg-slate-950/60 border-slate-800 text-slate-500'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-lg">{p.icon}</span>
                  {status === 'completed' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                  {status === 'active' && (
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-ping" />
                  )}
                </div>
                <div className="mt-2">
                  <div className={`text-xs font-semibold ${status === 'active' ? 'text-indigo-200' : 'text-slate-300'}`}>
                    {p.label}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate mt-0.5">
                    {p.scripture}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Player Controls */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800">
          <div className="flex items-center space-x-2">
            <button
              id="btn-step-prev"
              onClick={handlePrev}
              disabled={currentStepIndex === 0}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              ← Назад
            </button>
            <button
              id="btn-play-pause"
              onClick={() => setIsPlaying(!isPlaying)}
              className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-sm"
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isPlaying ? 'Пауза' : isFinished ? 'Заново' : 'Авто-Шаг'}</span>
            </button>
            <button
              id="btn-step-next"
              onClick={handleNext}
              disabled={isFinished}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Вперёд →
            </button>
            <button
              id="btn-reset"
              onClick={handleReset}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
              title="Сбросить к началу"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center space-x-2 text-xs">
            <button
              id="btn-copy-transcript"
              onClick={copyTranscript}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            >
              {copiedLog ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedLog ? 'Скопировано!' : 'Копировать протокол'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Interactive Stage: Active Step Inspection & Agent Chatter */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 Cols: Active Step Detail Card */}
        <div className="lg:col-span-7 space-y-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${activeCase.id}-${currentStepIndex}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-lg"
            >
              {/* Step Header */}
              <div className="flex items-start justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-2xl shadow-inner">
                    {currentStep.agent.avatar}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-100 text-base">
                        {currentStep.agent.name}
                      </span>
                      <span className="px-2 py-0.5 text-[10px] uppercase font-mono font-bold tracking-wide rounded bg-slate-800 text-indigo-400 border border-slate-700">
                        {currentStep.agent.role}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {currentStep.agent.flavor} · <span className="font-mono text-slate-400">{currentStep.timestamp}</span>
                    </p>
                  </div>
                </div>

                <div>
                  {getVerdictBadge(currentStep.verdict)}
                </div>
              </div>

              {/* Title & Description */}
              <div>
                <h4 className="text-sm font-semibold text-slate-200 flex items-center space-x-2">
                  <span>{currentStep.title}</span>
                </h4>
                <p className="text-sm text-slate-300 mt-2 leading-relaxed bg-slate-950/60 p-3.5 rounded-lg border border-slate-800/80">
                  {currentStep.description}
                </p>
              </div>

              {/* Biblical / Epistemological Anchor Note */}
              {currentStep.biblicalPrinciple && (
                <div className="bg-indigo-950/30 border border-indigo-500/30 rounded-lg p-3 flex items-start space-x-3">
                  <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <span className="font-semibold text-indigo-300 block">
                      Юридический инвариант ({currentStep.scriptureRef}):
                    </span>
                    <span className="text-indigo-200/90 italic">
                      "{currentStep.biblicalPrinciple}"
                    </span>
                  </div>
                </div>
              )}

              {/* Step Payload Inspector */}
              <div className="space-y-1.5">
                <div className="text-xs font-mono text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Данные шага (Payload JSON):</span>
                  <span className="text-[10px] text-slate-400">Canonical format</span>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-xs text-emerald-400 overflow-x-auto max-h-48">
                  <pre>{JSON.stringify(currentStep.payload, null, 2)}</pre>
                </div>
              </div>

              {/* Real-time Execution Output Log */}
              {currentStep.outputLog && (
                <div className="bg-slate-950/80 px-3.5 py-2.5 rounded-lg border border-slate-800 font-mono text-xs flex items-center space-x-2 text-slate-300">
                  <span className="text-indigo-400 font-bold">$</span>
                  <span>{currentStep.outputLog}</span>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Final Ruling Box if finished */}
          {isFinished && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-emerald-950/20 border border-emerald-500/40 rounded-xl p-5 space-y-3"
            >
              <div className="flex items-center space-x-2 text-emerald-400 font-bold text-sm">
                <ShieldCheck className="w-5 h-5" />
                <span>ДЕЛО ЗАКРЫТО: Финальный Вердикт (Ruling Committed)</span>
              </div>
              <p className="text-xs sm:text-sm text-slate-200 font-medium">
                {activeCase.finalRuling.rulingText}
              </p>
              <div className="pt-2 border-t border-emerald-500/20 flex flex-wrap items-center justify-between text-xs text-slate-400 font-mono gap-2">
                <span>Seq: #{activeCase.finalRuling.ledgerSeq || 'N/A'}</span>
                <span>Свидетелей (Witnesses): {activeCase.finalRuling.witnessCount}</span>
                <span className="truncate max-w-[200px]">Digest: {activeCase.finalRuling.digest.slice(0, 16)}...</span>
              </div>
            </motion.div>
          )}
        </div>

        {/* Right 5 Cols: Live Court Chronicle / Timeline */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 flex flex-col h-full max-h-[600px]">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-300 font-bold flex items-center space-x-2">
              <FileText className="w-4 h-4 text-indigo-400" />
              <span>Летопись Процесса (Court Log)</span>
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              {currentStepIndex + 1}/{steps.length} записей
            </span>
          </div>

          <div className="space-y-2.5 overflow-y-auto flex-1 pr-1">
            {steps.map((step, idx) => {
              const isPast = idx < currentStepIndex;
              const isCurrent = idx === currentStepIndex;
              return (
                <div
                  key={idx}
                  onClick={() => setCurrentStepIndex(idx)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    isCurrent
                      ? 'bg-indigo-600/20 border-indigo-500/80 shadow-sm'
                      : isPast
                      ? 'bg-slate-950/60 border-slate-800 hover:bg-slate-800/40 text-slate-300'
                      : 'bg-slate-950/20 border-slate-900 opacity-40 text-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2 font-semibold">
                      <span>{step.agent.avatar}</span>
                      <span className={isCurrent ? 'text-indigo-200' : 'text-slate-300'}>
                        {step.agent.name}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">{step.phase.toUpperCase()}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                    {step.title}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Bottom helper info */}
          <div className="pt-3 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center space-x-2">
            <HelpCircle className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>Каждый шаг детерминирован и может быть проверен любым независимым ридером.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
