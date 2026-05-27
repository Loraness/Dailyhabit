import { formatTime } from '../utils';

const CustomTooltip = ({ active, payload, getAppColor, OTHER_COLOR, getAppDisplayName }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const color = data.isOther ? OTHER_COLOR : getAppColor(data.name);
    const displayName = data.isOther ? data.name : (getAppDisplayName ? getAppDisplayName(data.name) : data.name);
    return (
      <div className="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 z-50">
        <div className="flex items-center space-x-2 mb-1">
           <span className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: color }}></span>
           <p className="font-bold text-slate-700 dark:text-slate-200">{displayName}</p>
        </div>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{formatTime(payload[0].value)}</p>
      </div>
    );
  }
  return null;
};

export default CustomTooltip;
