import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import './App.css';
import rules from './rules.json';

interface AppUsage {
  name: string;
  active_duration: number;
  background_duration: number;
}

interface ProcessInfo {
  name: string;
  uptime: number;
  memory: number;
}

const stringToColor = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const color = Math.floor(Math.abs((Math.sin(hash) * 10000) % 1) * 16777215).toString(16);
  return '#' + '000000'.substring(0, 6 - color.length) + color;
};

const getCategoryInfo = (appName: string) => {
  let catId = 'other';
  const siteMatch = rules.sites.find(s => s.name === appName);
  const appMatch = rules.apps.find(a => a.name === appName);
  
  if (siteMatch) catId = siteMatch.category;
  else if (appMatch) catId = appMatch.category;

  switch (catId) {
    case 'games': return { id: 'games', label: 'Игры', icon: '🎮', color: '#10b981', bgClass: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' };
    case 'study': return { id: 'study', label: 'Учеба и Работа', icon: '🎓', color: '#3b82f6', bgClass: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' };
    case 'social': return { id: 'social', label: 'Общение', icon: '💬', color: '#8b5cf6', bgClass: 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' };
    case 'entertainment': return { id: 'entertainment', label: 'Развлечения', icon: '▶️', color: '#f59e0b', bgClass: 'bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' };
    default: return { id: 'other', label: 'Прочее', icon: '⚙️', color: stringToColor(appName), bgClass: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' };
  }
};

// Компонент красивой кнопки обновления со спиннером
const RefreshButton = ({ onRefresh, isRefreshing }: { onRefresh: () => void, isRefreshing: boolean }) => (
  <button 
    onClick={onRefresh} 
    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-none"
    title="Обновить график"
  >
    <svg 
      className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} 
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  </button>
);

function App() {
  const [appsData, setAppsData] = useState<AppUsage[]>([]);
  const [bgProcesses, setBgProcesses] = useState<ProcessInfo[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'categories' | 'background'>('dashboard');
  const [viewMode, setViewMode] = useState<'active' | 'background'>('active');
  const [showAllApps, setShowAllApps] = useState(false);
  const [chartLimit, setChartLimit] = useState<5 | 10>(5);
  
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  
  // Состояния для анимации загрузки и принудительного ререндера графиков
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const lastFetchTime = useRef(0);
  useEffect(() => {
    // Получаем текущее окно Tauri
    const appWindow = getCurrentWindow(); 

    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      // Делаем системную панель тёмной
      appWindow.setTheme('dark').catch(console.error); 
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      // Делаем системную панель светлой
      appWindow.setTheme('light').catch(console.error); 
    }
  }, [isDarkMode]);


  const fetchData = useCallback(async (withAnimation = false) => {
    if (withAnimation) {
      setIsRefreshing(true);
    }
    
    try {
      if (activeTab === 'background') {
        const bgData = await invoke<ProcessInfo[]>('get_running_processes');
        setBgProcesses(bgData);
      } else {
        const data = await invoke<AppUsage[]>('get_all_today_time');
        setAppsData(data);
      }
    } catch (error) {
      console.error("Ошибка загрузки:", error);
    }

    if (withAnimation) {
      setRefreshKey(prev => prev + 1); 
      // ИЗМЕНЕНИЕ: Увеличиваем время до 1500 мс (длительность анимации Recharts)
      setTimeout(() => setIsRefreshing(false), 2500); 
    }
  }, [activeTab]);

  // Загружаем при смене вкладки
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // АВТООБНОВЛЕНИЕ ПРИ ВОЗВРАЩЕНИИ В ОКНО
  useEffect(() => {
    const handleFocus = () => {
      const now = Date.now();
      // Если с прошлого обновления прошло меньше 10 000 мс (10 секунд) — ничего не делаем
      if (now - lastFetchTime.current < 10000) {
        return;
      }
      
      lastFetchTime.current = now; // Обновляем таймер
      fetchData(true);
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchData]);

  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (h > 0) return `${h}ч ${m}м`;
    if (m > 0) return `${m}м ${s}с`;
    return `${s}с`;
  };

  const processedApps = useMemo(() => {
    return appsData
      .map(app => ({ name: app.name, duration: viewMode === 'active' ? app.active_duration : app.background_duration }))
      .filter(app => app.duration > 0)
      .sort((a, b) => b.duration - a.duration);
  }, [appsData, viewMode]);

  const OTHER_COLOR = isDarkMode ? '#475569' : '#cbd5e1';

  const pieChartData = useMemo(() => {
    if (processedApps.length <= chartLimit) return processedApps; 
    const topApps = processedApps.slice(0, chartLimit);
    const otherApps = processedApps.slice(chartLimit);
    const otherDuration = otherApps.reduce((sum, app) => sum + app.duration, 0);
    return [...topApps, { name: 'Остальное', duration: otherDuration, isOther: true }];
  }, [processedApps, chartLimit]);

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 z-50">
        <p className="font-bold text-slate-700 dark:text-slate-200">{payload[0].payload.name}</p>
        {/* Измененная строка: убрали style и добавили нужные классы */}
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          {formatTime(payload[0].value)}
        </p>
      </div>
    );
  }
  return null;
};


  const displayedApps = showAllApps ? processedApps : processedApps.slice(0, 5);

  const categorizedData = useMemo(() => {
    const groups: Record<string, { info: any, totalTime: number, apps: {name: string, duration: number}[] }> = {
      'study': { info: { id: 'study', label: 'Учеба и Работа', icon: '🎓', color: '#3b82f6' }, totalTime: 0, apps: [] }, 
      'entertainment': { info: { id: 'entertainment', label: 'Развлечения', icon: '▶️', color: '#f59e0b' }, totalTime: 0, apps: [] },
      'games': { info: { id: 'games', label: 'Игры', icon: '🎮', color: '#10b981' }, totalTime: 0, apps: [] },
      'social': { info: { id: 'social', label: 'Общение', icon: '💬', color: '#8b5cf6' }, totalTime: 0, apps: [] },
      'other': { info: { id: 'other', label: 'Прочее', icon: '⚙️', color: '#94a3b8' }, totalTime: 0, apps: [] },
    };

    processedApps.forEach(app => {
      const catInfo = getCategoryInfo(app.name);
      groups[catInfo.id].totalTime += app.duration;
      groups[catInfo.id].apps.push(app); 
    });

    Object.values(groups).forEach(g => g.apps.sort((a, b) => b.duration - a.duration));
    return groups;
  }, [processedApps]);

  const barChartData = Object.values(categorizedData)
    .filter(cat => cat.totalTime > 0)
    .map(cat => ({ name: cat.info.label, duration: cat.totalTime, color: cat.info.color }))
    .sort((a, b) => b.duration - a.duration);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-8 font-sans cursor-default transition-colors duration-300">
      <div className="max-w-5xl mx-auto">
        
        <header className="mb-6 flex flex-col md:flex-row md:justify-between md:items-end gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 mb-2">DailyHabit</h1>
            <p className="text-slate-500 dark:text-slate-400">Ваша реальная активность за сегодня</p>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Оставили только смену темы в шапке */}
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)} 
              className="w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              title="Сменить тему"
            >
              <span className="text-xl">{isDarkMode ? '☀️' : '🌙'}</span>
            </button>

            <div className="bg-white dark:bg-slate-800 p-1.5 rounded-2xl shadow-sm flex space-x-1 border border-slate-100 dark:border-slate-700 overflow-x-auto">
              <button onClick={() => setActiveTab('dashboard')} className={`whitespace-nowrap px-4 py-2.5 rounded-xl font-medium transition-all ${activeTab === 'dashboard' ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>📊 Дашборд</button>
              <button onClick={() => setActiveTab('categories')} className={`whitespace-nowrap px-4 py-2.5 rounded-xl font-medium transition-all ${activeTab === 'categories' ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>🗂️ Категории</button>
              <button onClick={() => setActiveTab('background')} className={`whitespace-nowrap px-4 py-2.5 rounded-xl font-medium transition-all ${activeTab === 'background' ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>⚙️ Фоновые</button>
            </div>
          </div>
        </header>

        {(activeTab === 'dashboard' || activeTab === 'categories') && (
          <div className="flex bg-slate-200/50 dark:bg-slate-800 p-1 rounded-xl w-fit mb-6">
            <button onClick={() => setViewMode('active')} className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${viewMode === 'active' ? 'bg-white dark:bg-slate-600 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>Активное время</button>
            <button onClick={() => setViewMode('background')} className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${viewMode === 'background' ? 'bg-white dark:bg-slate-600 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>Активность в фоне</button>
          </div>
        )}

        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none flex flex-col max-h-[500px] border border-transparent dark:border-slate-700">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-slate-600 dark:text-slate-200">{showAllApps ? "Все приложения" : "Топ за сегодня"}</h2>
                {processedApps.length > 5 && (
                  <button onClick={() => setShowAllApps(!showAllApps)} className="text-sm font-medium text-indigo-500 hover:text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1.5 rounded-full transition-colors">
                    {showAllApps ? "Свернуть" : "Показать все"}
                  </button>
                )}
              </div>
              <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar flex-1">
                {displayedApps.map((app, index) => {
                  const catColor = getCategoryInfo(app.name).color; 
                  return (
                    <div key={index} className="flex justify-between items-center p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-700/50 border border-transparent hover:border-slate-100 dark:hover:border-slate-600 transition-all">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm" style={{ backgroundColor: catColor }}>{index + 1}</div>
                        <span className="font-medium text-slate-700 dark:text-slate-200 truncate max-w-[200px]" title={app.name}>{app.name}</span>
                      </div>
                      <span className="text-slate-500 dark:text-slate-400 font-semibold bg-slate-50 dark:bg-slate-700 px-3 py-1 rounded-lg">{formatTime(app.duration)}</span>
                    </div>
                  );
                })}
                {processedApps.length === 0 && <p className="text-slate-400 text-center py-8">Сбор данных...</p>}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none flex flex-col min-h-[400px] border border-transparent dark:border-slate-700">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-slate-600 dark:text-slate-200">Распределение времени</h2>
                
                {/* Блок с тумблером Топ-5 и КНОПКОЙ ОБНОВЛЕНИЯ */}
                <div className="flex items-center space-x-2">
                  <RefreshButton onRefresh={() => fetchData(true)} isRefreshing={isRefreshing} />
                  <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
                    <button onClick={() => setChartLimit(5)} className={`text-xs font-semibold px-2 py-1 rounded-md transition-all ${chartLimit === 5 ? 'bg-white dark:bg-slate-600 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}>Топ 5</button>
                    <button onClick={() => setChartLimit(10)} className={`text-xs font-semibold px-2 py-1 rounded-md transition-all ${chartLimit === 10 ? 'bg-white dark:bg-slate-600 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}>Топ 10</button>
                  </div>
                </div>

              </div>
              <div className="flex-1">
                {/* Ключ refreshKey заставляет график перерисоваться с анимацией при обновлении */}
                <ResponsiveContainer key={`pie-${refreshKey}`} width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieChartData} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={2} dataKey="duration" stroke="none">
                      {pieChartData.map((entry: any, index) => {
                        const cellColor = entry.isOther ? OTHER_COLOR : getCategoryInfo(entry.name).color; 
                        return <Cell key={`cell-${index}`} fill={cellColor} />;
                      })}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'categories' && (
          <div>
            {barChartData.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none mb-6 border border-transparent dark:border-slate-700">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-semibold text-slate-600 dark:text-slate-200">Сравнение активностей</h2>
                  {/* КНОПКА ОБНОВЛЕНИЯ В КАТЕГОРИЯХ */}
                  <RefreshButton onRefresh={() => fetchData(true)} isRefreshing={isRefreshing} />
                </div>
                <div className="h-[250px] w-full">
                  <ResponsiveContainer key={`bar-${refreshKey}`} width="100%" height="100%">
                    <BarChart data={barChartData} margin={{ top: 0, right: 30, left: 0, bottom: 0 }} barSize={30}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#334155' : '#f1f5f9'} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 12}} />
                      <YAxis hide />
                      <Tooltip cursor={{fill: 'transparent'}} content={<CustomTooltip />} />
                      <Bar dataKey="duration" radius={[6, 6, 6, 6]}>
                        {barChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Object.values(categorizedData).map((category, idx) => {
                if (category.apps.length === 0) return null;
                
                return (
                  <div key={idx} className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none flex flex-col border border-transparent dark:border-slate-700">
                    <div className="flex items-center space-x-3 mb-6 pb-4 border-b border-slate-100 dark:border-slate-700">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ backgroundColor: `${category.info.color}15`, color: category.info.color }}>
                        {category.info.icon}
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{category.info.label}</h2>
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{formatTime(category.totalTime)} всего</p>
                      </div>
                    </div>
                    
                    <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar max-h-[300px] pr-2">
                      {category.apps.map((app, appIdx) => (
                        <div key={appIdx} className="flex justify-between items-center group">
                          <span className="font-medium text-slate-600 dark:text-slate-300 truncate mr-2 transition-colors group-hover:text-slate-900 dark:group-hover:text-white" title={app.name}>{app.name}</span>
                          <span className="text-sm font-semibold text-slate-400 dark:text-slate-500 whitespace-nowrap bg-slate-50 dark:bg-slate-700 px-2 py-0.5 rounded-md">{formatTime(app.duration)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {activeTab === 'background' && (
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none border border-transparent dark:border-slate-700">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold text-slate-600 dark:text-slate-200">Диспетчер фоновых задач</h2>
              <RefreshButton onRefresh={() => fetchData(true)} isRefreshing={isRefreshing} />
            </div>
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-white dark:bg-slate-800 z-10">
                  <tr className="border-b border-slate-100 dark:border-slate-700 text-slate-400 dark:text-slate-500 text-sm">
                    <th className="pb-3 font-medium px-4">Имя процесса</th>
                    <th className="pb-3 font-medium px-4">Время работы (Аптайм)</th>
                    <th className="pb-3 font-medium px-4">Потребление ОЗУ</th>
                  </tr>
                </thead>
                <tbody>
                  {bgProcesses.slice(0, 50).map((proc, index) => (
                    <tr key={index} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group">
                      <td className="py-4 px-4 font-medium text-slate-700 dark:text-slate-300 flex items-center">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 mr-3 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                        {proc.name}
                      </td>
                      <td className="py-4 px-4 text-slate-500 dark:text-slate-400">{formatTime(proc.uptime)}</td>
                      <td className="py-4 px-4"><span className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2.5 py-1 rounded-lg text-sm font-medium whitespace-nowrap">{proc.memory} МБ</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default App;
