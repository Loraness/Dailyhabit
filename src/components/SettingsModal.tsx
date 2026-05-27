import React, { useState, useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import { check, Update } from '@tauri-apps/plugin-updater';

interface SettingsModalProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  autoStartEnabled: boolean;
  toggleAutoStart: () => void;
  bringToFrontEnabled: boolean;
  setBringToFrontEnabled: (enabled: boolean) => void;
  ignoredApps: string[];
  setIgnoredApps: React.Dispatch<React.SetStateAction<string[]>>;
  getAppDisplayName: (appName: string) => string;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen, setIsOpen, autoStartEnabled, toggleAutoStart,
  bringToFrontEnabled, setBringToFrontEnabled,
  ignoredApps, setIgnoredApps, getAppDisplayName
}) => {
  const [isChecking, setIsChecking] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<Update | null>(null);
  const [updateMessage, setUpdateMessage] = useState<string>('');
  const [view, setView] = useState<'main' | 'ignored'>('main');

  useEffect(() => {
    if (!isOpen) setView('main');
  }, [isOpen]);

  const handleUnignore = async (appName: string) => {
    try {
      await invoke('unignore_app', { appName });
      setIgnoredApps(prev => prev.filter(app => app !== appName));
    } catch (error) {
      console.error(error);
    }
  };

  if (!isOpen) return null;

  const handleCheckUpdate = async () => {
    setIsChecking(true);
    setUpdateMessage('');
    try {
      const update = await check();
      if (update) {
        setUpdateInfo(update);
      } else {
        setUpdateMessage('У вас установлена последняя версия.');
      }
    } catch (error) {
      console.error(error);
      setUpdateMessage('Ошибка при проверке обновлений.');
    } finally {
      setIsChecking(false);
    }
  };

  const renderUpdateNotes = (body: string | undefined) => {
    if (!body) return null;
    
    const lines = body.split('\n');
    return (
      <div className="text-sm text-slate-600 dark:text-slate-300 space-y-2 mt-2 max-h-40 overflow-y-auto pr-2">
        {lines.map((line, i) => {
          if (line.trim().startsWith('-') || line.trim().startsWith('*')) {
            return (
              <li key={i} className="ml-4 list-disc marker:text-indigo-500">
                {line.substring(1).trim()}
              </li>
            );
          }
          if (line.trim().startsWith('#')) {
             return <h4 key={i} className="font-bold text-slate-800 dark:text-slate-100 mt-2">{line.replace(/^#+\s/, '')}</h4>;
          }
          return <p key={i}>{line}</p>;
        })}
      </div>
    );
  };

  if (view === 'ignored') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 dark:bg-slate-900/60 backdrop-blur-sm transition-all p-4" onClick={() => setIsOpen(false)}>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 w-full max-w-md animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center mb-6 shrink-0">
            <button onClick={() => setView('main')} className="w-8 h-8 mr-3 flex justify-center items-center rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors shrink-0" title="Назад">←</button>
            <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200">Исключения</h3>
            <button onClick={() => setIsOpen(false)} className="w-8 h-8 ml-auto flex justify-center items-center rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors shrink-0" title="Закрыть">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto pr-1 pb-2 custom-scrollbar">
            {ignoredApps.length === 0 ? (
              <p className="text-sm text-center text-slate-500 dark:text-slate-400 py-8">Список исключений пуст.</p>
            ) : (
              <div className="space-y-2">
                {ignoredApps.map(app => {
                  const displayName = getAppDisplayName(app);
                  return (
                    <div key={app} className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate pr-3" title={displayName}>{displayName}</span>
                      <button 
                        onClick={() => handleUnignore(app)}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 transition-colors shrink-0"
                      >
                        Вернуть
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 dark:bg-slate-900/60 backdrop-blur-sm transition-all p-4" onClick={() => setIsOpen(false)}>
      <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 w-full max-w-md animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6 shrink-0">
          <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
            <svg className="w-6 h-6 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
            Настройки
          </h3>
          <button onClick={() => setIsOpen(false)} className="w-8 h-8 flex justify-center items-center rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors shrink-0" title="Закрыть">✕</button>
        </div>
        
        <div className="space-y-4 overflow-y-auto pr-1 pb-2 flex-grow custom-scrollbar">
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
          
          <button 
            onClick={() => setView('ignored')}
            className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 transition-colors"
          >
            <div className="text-left">
              <h4 className="font-semibold text-slate-700 dark:text-slate-200">Исключения отслеживания</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Управление скрытыми приложениями</p>
            </div>
            <span className="text-slate-400">→</span>
          </button>
          
          <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700">
            <h4 className="font-semibold text-slate-700 dark:text-slate-200 mb-2">Обновления</h4>
            
            {updateInfo ? (
              <div className="bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-xl p-3 mb-3">
                <h5 className="font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
                  <span>🚀 Доступна версия {updateInfo.version}</span>
                </h5>
                <div className="mt-2 text-sm">
                  {renderUpdateNotes(updateInfo.body)}
                </div>
                <div className="mt-3 flex gap-2">
                  <button 
                    onClick={async () => {
                      setUpdateMessage('Скачивание и установка...');
                      try {
                        let downloaded = 0;
                        let contentLength = 0;
                        await updateInfo.downloadAndInstall((event) => {
                          switch (event.event) {
                            case 'Started':
                              contentLength = event.data.contentLength || 0;
                              setUpdateMessage(`Загрузка начата...`);
                              break;
                            case 'Progress':
                              downloaded += event.data.chunkLength;
                              if (contentLength) {
                                setUpdateMessage(`Загружено ${Math.round((downloaded / contentLength) * 100)}%`);
                              } else {
                                setUpdateMessage(`Загружено ${Math.round(downloaded / 1024 / 1024)} МБ`);
                              }
                              break;
                            case 'Finished':
                              setUpdateMessage('Установка завершена. Перезапуск...');
                              break;
                          }
                        });
                      } catch (e) {
                        console.error(e);
                        setUpdateMessage('Ошибка при обновлении.');
                      }
                    }}
                    className="flex-1 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Обновить
                  </button>
                  <button 
                    onClick={() => setUpdateInfo(null)}
                    className="flex-1 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium transition-colors"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            ) : (
              <button 
                onClick={handleCheckUpdate}
                disabled={isChecking}
                className="w-full py-2.5 rounded-xl font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isChecking ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Проверка...
                  </>
                ) : 'Проверить обновления'}
              </button>
            )}
            
            {updateMessage && !updateInfo && (
              <p className="text-xs text-center mt-2 text-slate-500 dark:text-slate-400">{updateMessage}</p>
            )}
          </div>

          <div className="pt-2 shrink-0">
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
