import React from 'react';
import { formatTime, getTodayString } from '../utils';
import { TimerSettings, DailyTimerStats, FocusApp } from '../types';

interface TimerSectionProps {
  timerState: 'idle' | 'work' | 'rest';
  timeLeft: number;
  totalPhaseTime: number;
  timerActive: boolean;
  currentCycle: number;
  timerSettings: TimerSettings;
  toggleTimer: () => void;
  stopTimer: () => void;
  handleSettingChange: (field: 'workMinutes' | 'restMinutes' | 'cycles', value: string) => void;
  setTimerSettings: React.Dispatch<React.SetStateAction<TimerSettings>>;
  smartCalc: { totalWorkHours: number; totalRestMinutes: number; restCount: number };
  setSmartCalc: React.Dispatch<React.SetStateAction<{ totalWorkHours: number; totalRestMinutes: number; restCount: number }>>;
  applySmartCalc: () => void;
  setAutoPreset: () => void;
  displayTimerStats: DailyTimerStats;
  selectedFocusDate: string;
  setIsFocusDatePickerOpen: (open: boolean) => void;
  setIsClearConfirmOpen: (open: boolean) => void;
  sortedFocusApps: FocusApp[];
  getAppColor: (name: string) => string;
  getAppDisplayName: (name: string) => string;
  sessions: any[];
}

const TimerSection: React.FC<TimerSectionProps> = ({
  timerState, timeLeft, totalPhaseTime, timerActive, currentCycle, timerSettings,
  toggleTimer, stopTimer, handleSettingChange, setTimerSettings,
  smartCalc, setSmartCalc, applySmartCalc, setAutoPreset,
  displayTimerStats, selectedFocusDate, setIsFocusDatePickerOpen,
  setIsClearConfirmOpen, sortedFocusApps, getAppColor, getAppDisplayName, sessions
}) => {

  const formatTimerDisplay = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const timerRadius = 130;
  const timerCircumference = 2 * Math.PI * timerRadius;
  const timerOffset = timerCircumference - (timeLeft / totalPhaseTime) * timerCircumference;

  const isTimerValid = timerSettings.workMinutes !== '' && timerSettings.restMinutes !== '' && timerSettings.cycles !== '';

  return (
    <div className="max-w-5xl mx-auto pb-10 space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 md:gap-6">
        <div className="flex-1 min-w-0 w-full bg-white dark:bg-slate-800 rounded-3xl p-4 sm:p-6 lg:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none border border-transparent dark:border-slate-700 flex flex-col items-center justify-center relative overflow-hidden min-h-[400px] sm:min-h-[450px]">
          <div className="relative flex items-center justify-center mb-8 w-full max-w-[320px]">
            <svg viewBox="0 0 320 320" className="w-full h-full transform -rotate-90 relative z-10">
              <circle cx="160" cy="160" r={timerRadius} stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-200 dark:text-slate-700/50" />
              <circle cx="160" cy="160" r={timerRadius} stroke="currentColor" strokeWidth="8" fill="transparent"
                strokeDasharray={timerCircumference} strokeDashoffset={timerState === 'idle' ? 0 : timerOffset}
                className={timerState === 'rest' ? 'text-emerald-500' : 'text-indigo-500'} strokeLinecap="round" 
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center z-10">
              <span className="text-4xl sm:text-5xl md:text-6xl font-black text-slate-800 dark:text-white tracking-tighter">
                {timerState === 'idle' ? formatTimerDisplay((Number(timerSettings.workMinutes) || 0) * 60) : formatTimerDisplay(timeLeft)}
              </span>
              <span className={`mt-2 text-xs sm:text-sm font-bold uppercase tracking-widest px-3 py-1 rounded-full ${timerState === 'work' ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400' : timerState === 'rest' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}`}>
                {timerState === 'idle' ? 'Ожидание' : timerState === 'work' ? 'Фокус' : 'Отдых'}
              </span>
              {(timerState === 'work' || timerState === 'rest') && (
                <span className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-tight">Цикл {currentCycle} / {timerSettings.cycles}</span>
              )}
            </div>
          </div>

          <div className="flex space-x-6 z-10">
            <button onClick={toggleTimer} disabled={timerState === 'idle' && !isTimerValid}
              className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center transition-transform ${(timerState === 'idle' && !isTimerValid) ? 'bg-slate-100 text-slate-300 dark:bg-slate-800/50 dark:text-slate-600 cursor-not-allowed shadow-none' : timerActive ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 hover:scale-105 active:scale-95' : 'bg-indigo-500 text-white hover:bg-indigo-600 hover:scale-105 active:scale-95'}`}>
              {timerActive ? (<svg className="w-7 h-7 sm:w-8 sm:h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>) : (<svg className="w-7 h-7 sm:w-8 sm:h-8 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>)}
            </button>
            <button onClick={stopTimer} disabled={timerState === 'idle'} className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center transition-all ${timerState === 'idle' ? 'bg-slate-100 text-slate-300 dark:bg-slate-800/50 dark:text-slate-600 cursor-not-allowed' : 'bg-red-100 text-red-500 hover:bg-red-200 dark:bg-red-500/20 dark:hover:bg-red-500/30'}`}>
              <svg className="w-7 h-7 sm:w-8 sm:h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h12v12H6z"/></svg>
            </button>
          </div>
        </div>

        <div className="w-full sm:w-[260px] md:w-[280px] lg:w-[300px] shrink-0 bg-white dark:bg-slate-800 rounded-3xl p-4 md:p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none border border-transparent dark:border-slate-700 flex flex-col h-fit">
          <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
            <span className="text-indigo-500">⚙️</span> Настройки
          </h3>
          <div className={`space-y-3 mb-3 transition-opacity ${timerState !== 'idle' ? 'opacity-50 pointer-events-none' : ''}`}>
            <div>
              <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1 block">Время фокуса (мин)</label>
              <input type="text" inputMode="numeric" value={timerSettings.workMinutes} onChange={(e) => handleSettingChange('workMinutes', e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 font-bold text-slate-700 dark:text-slate-200 outline-none focus:border-indigo-500 transition-colors"/>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1 block">Отдых</label>
                <input type="text" inputMode="numeric" value={timerSettings.restMinutes} onChange={(e) => handleSettingChange('restMinutes', e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 font-bold text-slate-700 dark:text-slate-200 outline-none focus:border-emerald-500 transition-colors"/>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1 block">Циклы</label>
                <input type="text" inputMode="numeric" value={timerSettings.cycles} onChange={(e) => handleSettingChange('cycles', e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 font-bold text-slate-700 dark:text-slate-200 outline-none focus:border-indigo-500 transition-colors"/>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700 mb-0">
            <div>
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 block">Автозапуск фаз</span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight block">Сразу начинать следующий отсчет</span>
            </div>
            <button onClick={() => setTimerSettings({...timerSettings, autoStartNextPhase: !timerSettings.autoStartNextPhase})} className={`relative inline-flex h-4 w-8 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none ${timerSettings.autoStartNextPhase ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
              <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow-sm transition-transform ${timerSettings.autoStartNextPhase ? 'translate-x-4' : 'translate-x-1'}`} />
            </button>
          </div>
          <hr className="border-slate-100 dark:border-slate-700 my-3" />
          <div className={timerState !== 'idle' ? 'opacity-50 pointer-events-none' : ''}>
            <h4 className="text-[13px] font-bold text-slate-700 dark:text-slate-200 mb-2 flex items-center justify-between">
              Умный расчет
              <button onClick={setAutoPreset} className="text-[9px] bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 px-2 py-0.5 rounded-md hover:bg-indigo-200 dark:hover:bg-indigo-800 transition-colors font-bold uppercase tracking-wide" title="Установить 50/10/3">Авто</button>
            </h4>
            <div className="space-y-2 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700/50">
               <div><label className="text-xs font-medium text-slate-500 dark:text-slate-400 flex justify-between">Общее время <span>{smartCalc.totalWorkHours} ч.</span></label><input type="range" min="1" max="12" value={smartCalc.totalWorkHours} onChange={(e) => setSmartCalc({...smartCalc, totalWorkHours: Number(e.target.value)})} className="w-full h-1.5 accent-indigo-500" /></div>
               <div><label className="text-xs font-medium text-slate-500 dark:text-slate-400 flex justify-between">Перерывы <span>{smartCalc.restCount} шт.</span></label><input type="range" min="1" max="10" value={smartCalc.restCount} onChange={(e) => setSmartCalc({...smartCalc, restCount: Number(e.target.value)})} className="w-full h-1.5 accent-emerald-500" /></div>
               <div><label className="text-xs font-medium text-slate-500 dark:text-slate-400 flex justify-between">Отдых всего <span>{smartCalc.totalRestMinutes} мин.</span></label><input type="range" min="10" max="120" step="5" value={smartCalc.totalRestMinutes} onChange={(e) => setSmartCalc({...smartCalc, totalRestMinutes: Number(e.target.value)})} className="w-full h-1.5 accent-emerald-500" /></div>
               <button onClick={applySmartCalc} className="w-full mt-1 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-bold py-1.5 rounded-lg transition-colors text-[11px]">Применить</button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none border border-transparent dark:border-slate-700">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
          <div className="flex items-center flex-wrap gap-3">
            <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
              <span className="text-indigo-500">🎯</span> Куда ушло время фокуса
            </h3>
            <button onClick={() => setIsFocusDatePickerOpen(true)} className="flex items-center gap-2 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-xs font-bold text-slate-600 dark:text-slate-300 shadow-sm">
              <span>📅</span>
              <span>{selectedFocusDate === getTodayString() ? 'Сегодня' : selectedFocusDate.split('-').reverse().join('.')}</span>
            </button>
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/50 px-2.5 py-1 rounded-md flex items-center gap-2 uppercase tracking-wide">
              <span className="text-indigo-600 dark:text-indigo-400">{formatTime(displayTimerStats.focus)} фокуса</span>
              <span className="text-slate-300 dark:text-slate-600">|</span>
              <span className="text-emerald-600 dark:text-emerald-400">{formatTime(displayTimerStats.rest)} отдыха</span>
            </span>
          </div>
          {(sortedFocusApps.length > 0 || displayTimerStats.focus > 0 || displayTimerStats.rest > 0) && (
            <button onClick={() => setIsClearConfirmOpen(true)} className="text-xs font-bold text-slate-400 hover:text-red-500 transition-colors uppercase tracking-wider shrink-0">
              Очистить
            </button>
          )}
        </div>

        {sessions && sessions.length > 0 && (
          <div className="mb-6 space-y-4">
            {sessions.map((session, index) => (
              <div key={session.id} className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-700">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">Фокус {index + 1}</h4>
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/30 px-2 py-0.5 rounded shadow-sm">
                    {formatTime(session.duration)}
                  </span>
                </div>
                {session.apps && session.apps.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {session.apps.sort((a: any, b: any) => b.duration - a.duration).map((app: any, idx: number) => {
                      const appColor = getAppColor(app.name);
                      const displayName = getAppDisplayName(app.name);
                      return (
                        <div key={idx} className="flex justify-between items-center p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                          <div className="flex items-center space-x-2 overflow-hidden">
                            <div className="w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-sm" style={{ backgroundColor: appColor }}>
                              {displayName.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate" title={displayName}>{displayName}</span>
                          </div>
                          <span className="ml-2 shrink-0 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                            {formatTime(app.duration)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 dark:text-slate-400 italic">Нет данных о приложениях</p>
                )}
              </div>
            ))}
            <hr className="border-slate-100 dark:border-slate-700 my-6" />
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-4 px-2">Общее время за день</h4>
          </div>
        )}

        {sortedFocusApps.length === 0 ? (
          <div className="text-center py-8 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
            <span className="text-4xl mb-3 block opacity-80">👀</span>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Вы еще не работали в режиме фокуса сегодня.</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Запустите таймер, и здесь появится ваша статистика!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedFocusApps.map((app, idx) => {
              const appColor = getAppColor(app.name);
              const displayName = getAppDisplayName(app.name);
              return (
                <div key={idx} className="flex justify-between items-center p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 hover:border-indigo-100 dark:hover:border-indigo-900/50 transition-colors">
                  <div className="flex items-center space-x-3 overflow-hidden">
                    <div className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm" style={{ backgroundColor: appColor }}>
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium text-slate-700 dark:text-slate-200 truncate" title={displayName}>{displayName}</span>
                  </div>
                  <span className="ml-3 shrink-0 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/30 px-2.5 py-1 rounded-lg shadow-sm">
                    {formatTime(app.duration)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default TimerSection;
