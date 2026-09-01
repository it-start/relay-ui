import React, { useState } from 'react';
import { 
  ShieldAlert, Play, RotateCcw, AlertTriangle, CheckCircle2, 
  XCircle, Zap, HardDrive, RefreshCw, Layers 
} from 'lucide-react';
import { FAILURE_SIMULATIONS } from '../data/simulationScenarios';
import { FailureModeSimulation } from '../types';

export const FailureSandbox: React.FC = () => {
  const [selectedFailureId, setSelectedFailureId] = useState<string>(FAILURE_SIMULATIONS[0].id);

  // Simulation 1: 16 Racing Writers State
  const [writerCount, setWriterCount] = useState<number>(16);
  const [raceMode, setRaceMode] = useState<'naive_max_plus_one' | 'atomic_wx_marker'>('naive_max_plus_one');
  const [racingResults, setRacingResults] = useState<{
    slots: { id: number; writer: string; status: 'ok' | 'collision' }[];
    collisions: number;
    completed: boolean;
  } | null>(null);

  // Simulation 2: Rebind / Deletion State
  const [rebindStep, setRebindStep] = useState<'idle' | 'written' | 'deleted' | 'rebound'>('idle');
  const [rebindMode, setRebindMode] = useState<'naive' | 'conforming'>('naive');

  // Simulation 3: Crash State
  const [crashStage, setCrashStage] = useState<'none' | 'ledger_allocated' | 'crashed' | 'recovered'>('none');

  const activeFailure = FAILURE_SIMULATIONS.find(f => f.id === selectedFailureId) || FAILURE_SIMULATIONS[0];

  // Run 16 Racing Writers Simulation
  const runRacingSimulation = () => {
    const slots: { id: number; writer: string; status: 'ok' | 'collision' }[] = [];
    let collisions = 0;

    if (raceMode === 'naive_max_plus_one') {
      // In naive mode, simulated race condition where some threads read max at same tick
      const baseMax = 200;
      const claimedIds = new Map<number, string[]>();

      for (let i = 0; i < writerCount; i++) {
        const writer = `Thread-${i + 1}`;
        // 35% chance of reading stale max due to race
        const randomLag = Math.random() < 0.4 ? 0 : Math.floor(Math.random() * 3);
        const assignedId = baseMax + 1 + (i > 3 ? i - randomLag : 0);

        if (!claimedIds.has(assignedId)) {
          claimedIds.set(assignedId, []);
        }
        claimedIds.get(assignedId)!.push(writer);
      }

      claimedIds.forEach((writers, id) => {
        if (writers.length > 1) {
          collisions += (writers.length - 1);
          writers.forEach(w => {
            slots.push({ id, writer: w, status: 'collision' });
          });
        } else {
          slots.push({ id, writer: writers[0], status: 'ok' });
        }
      });
    } else {
      // In atomic wx marker mode, every thread successfully claims a unique sequential marker
      const baseMax = 200;
      for (let i = 0; i < writerCount; i++) {
        slots.push({
          id: baseMax + i + 1,
          writer: `Thread-${i + 1}`,
          status: 'ok'
        });
      }
    }

    setRacingResults({
      slots: slots.sort((a, b) => a.id - b.id),
      collisions,
      completed: true
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-rose-600/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">
              Полигон Аварийных Сценариев и Гонки (Failure Sandbox)
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Симуляция исторических сбоев релея: коллизии гонки 16 писателей, перепривязка удалённых ID (relay-0183) и сбои до записи полезной нагрузки.
            </p>
          </div>
        </div>
      </div>

      {/* Failure Mode Selector */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {FAILURE_SIMULATIONS.map((fail) => (
          <button
            key={fail.id}
            id={`btn-fail-${fail.id}`}
            onClick={() => {
              setSelectedFailureId(fail.id);
              setRacingResults(null);
              setRebindStep('idle');
              setCrashStage('none');
            }}
            className={`p-3.5 rounded-xl border text-left transition-all ${
              selectedFailureId === fail.id
                ? 'bg-rose-950/30 border-rose-500 text-rose-200 shadow-md'
                : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <div className="text-[10px] font-mono uppercase text-rose-400 font-bold">{fail.specClause}</div>
            <div className="text-xs font-semibold text-slate-200 mt-1">{fail.name}</div>
          </button>
        ))}
      </div>

      {/* Main Interactive Stage for Selected Failure */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 6 Cols: Failure Theory & Incident Report */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <span className="text-xs font-mono text-rose-400 font-bold uppercase">
                {activeFailure.specClause}
              </span>
              <h3 className="text-base font-bold text-slate-100 mt-1">
                {activeFailure.name}
              </h3>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-mono uppercase text-slate-400 font-semibold">Описание уязвимости:</span>
              <p className="text-xs text-slate-300 bg-slate-950/60 p-3 rounded-lg border border-slate-800 leading-relaxed">
                {activeFailure.description}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-mono uppercase text-amber-400 font-semibold flex items-center space-x-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Исторический инцидент:</span>
              </span>
              <p className="text-xs text-amber-200/90 bg-amber-950/20 p-3 rounded-lg border border-amber-500/30">
                {activeFailure.historicalIncident}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="bg-rose-950/20 border border-rose-500/30 p-3 rounded-lg">
                <span className="text-rose-400 font-bold block mb-1">❌ Наивное поведение:</span>
                <p className="text-slate-300 text-[11px]">{activeFailure.naiveBehavior}</p>
              </div>
              <div className="bg-emerald-950/20 border border-emerald-500/30 p-3 rounded-lg">
                <span className="text-emerald-400 font-bold block mb-1">✓ Решение по SPEC v1:</span>
                <p className="text-slate-300 text-[11px]">{activeFailure.v1ConformingBehavior}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right 6 Cols: Live Interactive Simulator */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-300 font-bold flex items-center space-x-2">
                <Zap className="w-4 h-4 text-rose-400" />
                <span>Интерактивный Эксперимент</span>
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 font-mono">
                Live POSIX Simulation
              </span>
            </div>

            {/* Experiment 1: 16 Racing Writers */}
            {selectedFailureId === 'fail_rebind' || selectedFailureId === 'fail_rename_overwrite' ? (
              <div className="space-y-4">
                <div className="text-xs text-slate-400">
                  Демонстрация жизненного цикла ID <code className="text-indigo-300 font-mono">relay-0183</code>:
                </div>

                <div className="flex space-x-2 text-xs">
                  <button
                    onClick={() => setRebindMode('naive')}
                    className={`px-3 py-1.5 rounded-lg border font-medium ${
                      rebindMode === 'naive' ? 'bg-rose-950/50 border-rose-500 text-rose-200' : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    1. Наивный подход (Удалить маркер и переиспользовать ID)
                  </button>
                  <button
                    onClick={() => setRebindMode('conforming')}
                    className={`px-3 py-1.5 rounded-lg border font-medium ${
                      rebindMode === 'conforming' ? 'bg-emerald-950/50 border-emerald-500 text-emerald-200' : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    2. SPEC v1 (Вечный маркер + KNOWN_MISSING)
                  </button>
                </div>

                {/* State Machine Steps */}
                <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Текущее состояние хранилища:</span>
                    <span className="font-mono font-bold text-indigo-300">{rebindStep.toUpperCase()}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setRebindStep('written')}
                      className={`p-2 rounded border text-center ${rebindStep === 'written' ? 'border-indigo-500 bg-indigo-950/40 text-indigo-200' : 'border-slate-800 bg-slate-900 text-slate-400'}`}
                    >
                      1. Записать Doc α (seq=183)
                    </button>
                    <button
                      onClick={() => setRebindStep('deleted')}
                      className={`p-2 rounded border text-center ${rebindStep === 'deleted' ? 'border-amber-500 bg-amber-950/40 text-amber-200' : 'border-slate-800 bg-slate-900 text-slate-400'}`}
                    >
                      2. Удалить Doc α
                    </button>
                    <button
                      onClick={() => setRebindStep('rebound')}
                      className={`p-2 rounded border text-center ${rebindStep === 'rebound' ? 'border-rose-500 bg-rose-950/40 text-rose-200' : 'border-slate-800 bg-slate-900 text-slate-400'}`}
                    >
                      3. Записать Doc β
                    </button>
                  </div>

                  {/* Status Report */}
                  <div className="pt-2 border-t border-slate-800 text-xs">
                    {rebindStep === 'written' && (
                      <div className="text-emerald-400">
                        ✓ ID #183 занят документом Alpha (Digest: 7a9f8b...). Читатели цитируют relay-0183.
                      </div>
                    )}
                    {rebindStep === 'deleted' && (
                      <div className={rebindMode === 'naive' ? 'text-amber-400' : 'text-emerald-400'}>
                        {rebindMode === 'naive' 
                          ? '⚠️ Наивный стор удалил маркер history/relay-0183. Теперь слот считается пустым!' 
                          : '✓ SPEC v1: Тело records/relay-0183.dat удалено, но маркер history/relay-0183 СОХРАНЁН. Чтение возвращает KNOWN_MISSING.'}
                      </div>
                    )}
                    {rebindStep === 'rebound' && (
                      <div className={rebindMode === 'naive' ? 'text-rose-400' : 'text-emerald-400'}>
                        {rebindMode === 'naive' 
                          ? '🚨 КАТАСТРОФА ПЕРЕПРИВЯЗКИ! Новый документ Beta занял relay-0183. Старые цитаты читателей на Alpha теперь указывают на Beta!' 
                          : '✓ SPEC v1 ЗАЩИТА: Запись Doc Beta получила НОВЫЙ seq #184. relay-0183 навсегда остаётся KNOWN_MISSING.'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-xs text-slate-400">
                  Симуляция 16 параллельных процессов, одновременно пытающихся зарезервировать следующий свободный ID:
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-slate-400 block mb-1">Механизм выделения:</label>
                    <select
                      value={raceMode}
                      onChange={(e: any) => setRaceMode(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200"
                    >
                      <option value="naive_max_plus_one">1. max(ids) + 1 (Чтение затем Запись)</option>
                      <option value="atomic_wx_marker">2. O_EXCL / wx маркеры (SPEC MUST 1)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Параллельных потоков:</label>
                    <input
                      type="number"
                      value={writerCount}
                      onChange={(e) => setWriterCount(Number(e.target.value))}
                      min={2}
                      max={32}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 font-mono text-slate-200"
                    />
                  </div>
                </div>

                <button
                  onClick={runRacingSimulation}
                  className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center space-x-2 transition shadow-sm"
                >
                  <Play className="w-4 h-4" />
                  <span>Запустить Гонку 16 Писателей (Stress Test)</span>
                </button>

                {racingResults && (
                  <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-3 text-xs">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="text-slate-400">Результат гонки:</span>
                      <span className={`font-bold font-mono ${racingResults.collisions > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {racingResults.collisions > 0 
                          ? `🚨 ${racingResults.collisions} КОЛЛИЗИЙ (Дубликатов ID)` 
                          : '✓ 0 Коллизий (100% Уникальных ID)'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 max-h-48 overflow-y-auto">
                      {racingResults.slots.map((s, idx) => (
                        <div
                          key={idx}
                          className={`p-1.5 rounded border text-[11px] font-mono text-center ${
                            s.status === 'collision'
                              ? 'bg-rose-950/60 border-rose-500 text-rose-300'
                              : 'bg-slate-900 border-slate-800 text-slate-300'
                          }`}
                        >
                          <div>#{s.id}</div>
                          <div className="text-[9px] text-slate-400 truncate">{s.writer}</div>
                        </div>
                      ))}
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
