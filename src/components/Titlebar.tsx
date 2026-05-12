import { getCurrentWindow } from '@tauri-apps/api/window';

const Titlebar = () => {
  const minimize = async () => { try { await getCurrentWindow().minimize(); } catch (e) { console.error("Ошибка:", e); } };
  const maximize = async () => { try { await getCurrentWindow().toggleMaximize(); } catch (e) { console.error("Ошибка:", e); } };
  const closeApp = async () => { try { await getCurrentWindow().hide(); } catch (e) { console.error("Ошибка:", e); } };

  const startDrag = async (e: React.MouseEvent) => {
    if (e.buttons === 1) { try { await getCurrentWindow().startDragging(); } catch (error) { console.error(error); } }
  };

  return (
    <div className="h-8 flex justify-between items-center select-none bg-slate-200 dark:bg-slate-950 transition-colors duration-300">
      <div onMouseDown={startDrag} className="flex-1 h-full flex items-center pl-4 gap-2 cursor-default">
        <div className="w-3 h-3 rounded-full bg-indigo-500 pointer-events-none"></div>
        <span className="text-xs font-semibold tracking-wide text-slate-500 dark:text-slate-400 pointer-events-none">DailyHabit</span>
      </div>
      <div className="flex h-full shrink-0">
        <button onClick={minimize} className="h-full px-4 flex items-center justify-center hover:bg-slate-300 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors outline-none" title="Свернуть">
          <svg className="w-3 h-3 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
        </button>
        <button onClick={maximize} className="h-full px-4 flex items-center justify-center hover:bg-slate-300 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors outline-none" title="Развернуть">
          <svg className="w-3 h-3 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4h16v16H4z" /></svg>
        </button>
        <button onClick={closeApp} className="h-full px-4 flex items-center justify-center hover:bg-red-500 hover:text-white text-slate-500 dark:text-slate-400 transition-colors outline-none" title="Закрыть">
          <svg className="w-3 h-3 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
    </div>
  );
};

export default Titlebar;
