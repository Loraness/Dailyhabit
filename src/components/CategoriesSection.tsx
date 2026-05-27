import React from 'react';
import { formatTime } from '../utils';
import RefreshButton from './RefreshButton';

interface CategoriesSectionProps {
  barChartData: any[];
  fetchData: (withAnimation?: boolean) => void;
  isRefreshing: boolean;
  memoizedBarChart: React.ReactNode;
  categorizedData: Record<string, { info: any, totalTime: number, apps: {name: string, duration: number}[] }>;
  onAppContextMenu: (e: React.MouseEvent, appName: string) => void;
  getAppDisplayName: (name: string) => string;
}

const CategoriesSection: React.FC<CategoriesSectionProps> = ({
  barChartData, fetchData, isRefreshing, memoizedBarChart, categorizedData, onAppContextMenu, getAppDisplayName
}) => {
  return (
    <div>
      {barChartData.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none mb-6 border border-transparent dark:border-slate-700">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-slate-600 dark:text-slate-200">Сравнение активностей за день</h2>
            <RefreshButton onRefresh={() => fetchData(true)} isRefreshing={isRefreshing} />
          </div>
          <div className="h-[250px] w-full">
            {memoizedBarChart}
          </div>
        </div>
      )}
      {barChartData.length === 0 && <p className="text-slate-400 text-center py-8">В этот день не было активности</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Object.values(categorizedData).map((category, idx) => {
          if (category.apps.length === 0) return null;
          return (
            <div key={idx} className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none flex flex-col border border-transparent dark:border-slate-700">
              <div className="flex items-center space-x-3 mb-6 pb-4 border-b border-slate-100 dark:border-slate-700">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ backgroundColor: `${category.info.color}15`, color: category.info.color }}>{category.info.icon}</div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{category.info.label}</h2>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{formatTime(category.totalTime)} всего</p>
                </div>
              </div>
              <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar max-h-[300px] pr-2">
                {category.apps.map((app, appIdx) => {
                  const displayName = getAppDisplayName(app.name);
                  return (
                    <div 
                      key={appIdx} 
                      onContextMenu={(e) => onAppContextMenu(e, app.name)}
                      className="flex justify-between items-center group cursor-context-menu hover:bg-slate-50 dark:hover:bg-slate-700/50 p-1.5 -mx-1.5 rounded-lg transition-colors"
                    >
                      <span className="font-medium text-slate-600 dark:text-slate-300 truncate mr-2 transition-colors group-hover:text-slate-900 dark:group-hover:text-white" title={displayName}>{displayName}</span>
                      <span className="text-sm font-semibold text-slate-400 dark:text-slate-500 whitespace-nowrap bg-slate-50 dark:bg-slate-700 px-2 py-0.5 rounded-md">{formatTime(app.duration)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  );
};

export default CategoriesSection;
