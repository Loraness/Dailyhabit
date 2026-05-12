import React from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';

interface SettingsModalProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  autoStartEnabled: boolean;
  toggleAutoStart: () => void;
  bringToFrontEnabled: boolean;
  setBringToFrontEnabled: (enabled: boolean) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen, setIsOpen, autoStartEnabled, toggleAutoStart,
  bringToFrontEnabled, setBringToFrontEnabled
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 dark:bg-slate-900/60 backdrop-blur-sm transition-all p-4" onClick={() => setIsOpen(false)}>
      <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 w-full max-w-md animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
            <svg className="w-6 h-6 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
            Настройки
          </h3>
          <button onClick={() => setIsOpen(false)} className="w-8 h-8 flex justify-center items-center rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors shrink-0" title="Закрыть">✕</button>
        </div>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700">
            <div className="pr-4">
              <h4 className="font-semibold text-slate-700 dark:text-slate-200">Запускать по умолчанию</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug">При запуске ПК приложение будет работать в фоне. Откройте его ярлыком, чтобы посмотреть статистику.</p>
            </div>
            <button 
              onClick={toggleAutoStart}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none ${autoStartEnabled ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-600'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${autoStartEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700">
            <div className="pr-4">
              <h4 className="font-semibold text-slate-700 dark:text-slate-200">Поверх всех окон</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug">Разворачивать приложение и делать его активным при окончании фазы таймера.</p>
            </div>
            <button 
              onClick={() => setBringToFrontEnabled(!bringToFrontEnabled)}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none ${bringToFrontEnabled ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-600'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${bringToFrontEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          <div className="pt-2">
            <button 
              onClick={async () => {
                try { await getCurrentWindow().close(); } catch (e) { console.error(e); }
              }}
              className="w-full py-3 rounded-xl font-semibold text-red-500 bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 transition-colors"
            >
              Полностью закрыть приложение
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
