import React from 'react';
import { formatTime } from '../utils';
import RefreshButton from './RefreshButton';

interface DashboardSectionProps {
  processedApps: { name: string; duration: number }[];
  showAllApps: boolean;
  setShowAllApps: (show: boolean) => void;
  selectedDate: string;
  getTodayString: () => string;
  getAppColor: (name: string) => string;
  fetchData: (withAnimation?: boolean) => void;
  isRefreshing: boolean;
  chartLimit: 5 | 10;
  setChartLimit: (limit: 5 | 10) => void;
  memoizedPieChart: React.ReactNode;
  onAppContextMenu: (e: React.MouseEvent, appName: string) => void;
}

const DashboardSection: React.FC<DashboardSectionProps> = ({
  processedApps, showAllApps, setShowAllApps, selectedDate, getTodayString,
  getAppColor, fetchData, isRefreshing, chartLimit, setChartLimit, memoizedPieChart,
  onAppContextMenu
}) => {
  const displayedApps = showAllApps ? processedApps : processedApps.slice(0, 5);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none flex flex-col h-[calc(100vh-280px)] min-h-[400px] border border-transparent dark:border-slate-700">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-slate-600 dark:text-slate-200">{showAllApps ? "Все приложения" : `Топ за ${selectedDate === getTodayString() ? 'сегодня' : selectedDate}`}</h2>
          {processedApps.length > 5 && (
            <button onClick={() => setShowAllApps(!showAllApps)} className="text-sm font-medium text-indigo-500 hover:text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1.5 rounded-full transition-colors">
              {showAllApps ? "Свернуть" : "Показать все"}
            </button>
          )}
        </div>
        <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar flex-1">
          {displayedApps.map((app, index) => {
            const appColor = getAppColor(app.name); 
            return (
              <div 
                key={index} 
                onContextMenu={(e) => onAppContextMenu(e, app.name)}
                className="flex justify-between items-center p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-700/50 border border-transparent hover:border-slate-100 dark:hover:border-slate-600 transition-all cursor-context-menu"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm" style={{ backgroundColor: appColor }}>{index + 1}</div>
                  <span className="font-medium text-slate-700 dark:text-slate-200 truncate max-w-[200px]" title={app.name}>{app.name}</span>
                </div>
                <span className="text-slate-500 dark:text-slate-400 font-semibold bg-slate-50 dark:bg-slate-700 px-3 py-1 rounded-lg">{formatTime(app.duration)}</span>
              </div>
            );
          })}
          {processedApps.length === 0 && <p className="text-slate-400 text-center py-8">Нет данных за этот день</p>}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none flex flex-col h-[calc(100vh-280px)] min-h-[400px] border border-transparent dark:border-slate-700">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-slate-600 dark:text-slate-200">Распределение времени</h2>
          <div className="flex items-center space-x-2">
            <RefreshButton onRefresh={() => fetchData(true)} isRefreshing={isRefreshing} />
            <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
              <button onClick={() => setChartLimit(5)} className={`text-xs font-semibold px-2 py-1 rounded-md transition-all ${chartLimit === 5 ? 'bg-white dark:bg-slate-600 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}>Топ 5</button>
              <button onClick={() => setChartLimit(10)} className={`text-xs font-semibold px-2 py-1 rounded-md transition-all ${chartLimit === 10 ? 'bg-white dark:bg-slate-600 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}>Топ 10</button>
            </div>
          </div>
        </div>
        <div className="flex-1 relative min-h-0">
          {memoizedPieChart}
        </div>
      </div>
    </div>
  );
};

export default DashboardSection;
