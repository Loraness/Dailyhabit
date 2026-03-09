import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { enable, isEnabled, disable } from '@tauri-apps/plugin-autostart';
import './App.css';
import rules from './rules.json';

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
      <div className="flex h-full flex-shrink-0">
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

interface AppUsage { name: string; active_duration: number; background_duration: number; }

const PALETTE = [ '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e' ];

const getPaletteColor = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length];
};

const getCategoryInfo = (appName: string) => {
  let catId = 'other';
  const siteMatch = rules.sites.find(s => s.name === appName);
  const appMatch = rules.apps.find(a => a.name === appName);
  
  if (siteMatch) catId = siteMatch.category;
  else if (appMatch) catId = appMatch.category;

  switch (catId) {
    case 'games': return { id: 'games', label: 'Игры', icon: '🎮', color: '#10b981' };
    case 'study': return { id: 'study', label: 'Учеба и Работа', icon: '🎓', color: '#3b82f6' };
    case 'social': return { id: 'social', label: 'Общение', icon: '💬', color: '#8b5cf6' };
    case 'entertainment': return { id: 'entertainment', label: 'Развлечения', icon: '▶️', color: '#f59e0b' };
    default: return { id: 'other', label: 'Прочее', icon: '⚙️', color: '#94a3b8' };
  }
};

const RefreshButton = ({ onRefresh, isRefreshing }: { onRefresh: () => void, isRefreshing: boolean }) => (
  <button onClick={onRefresh} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-none" title="Обновить">
    <svg className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  </button>
);

function App() {
  const [appsData, setAppsData] = useState<AppUsage[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'categories' | 'calendar'>('dashboard');
  const [viewMode, setViewMode] = useState<'active' | 'background'>('active');
  const [showAllApps, setShowAllApps] = useState(false);
  const [chartLimit, setChartLimit] = useState<5 | 10>(5);
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const [customColors, setCustomColors] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('customAppColors');
    return saved ? JSON.parse(saved) : {};
  });
  const [colorPanel, setColorPanel] = useState<{ visible: boolean, appName: string } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [autoStartEnabled, setAutoStartEnabled] = useState(true);

  // Эффект для проверки статуса автозапуска
  useEffect(() => {
    const checkAutostart = async () => {
      try {
        const enabled = await isEnabled();
        setAutoStartEnabled(enabled);
        
        // Включаем по умолчанию при самом первом запуске приложения
        const hasSetDefault = localStorage.getItem('autostart_initialized');
        if (!hasSetDefault) {
           await enable();
           setAutoStartEnabled(true);
           localStorage.setItem('autostart_initialized', 'true');
        }
      } catch (e) { console.error("Ошибка автозапуска:", e); }
    };
    checkAutostart();
  }, []);

  const toggleAutoStart = async () => {
    try {
      if (autoStartEnabled) { await disable(); setAutoStartEnabled(false); }
      else { await enable(); setAutoStartEnabled(true); }
    } catch (e) { console.error(e); }
  };

  const [refreshKey, setRefreshKey] = useState(0);
  
  // Дата по умолчанию: сегодня
  const getTodayString = () => new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(getTodayString());
  
  // Состояния для календаря
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [monthStats, setMonthStats] = useState<Record<string, number>>({});
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false); // <-- Новое состояние

  const lastFetchTime = useRef(0);

  useEffect(() => {
    if (isDarkMode) { document.documentElement.classList.add('dark'); localStorage.setItem('theme', 'dark'); }
    else { document.documentElement.classList.remove('dark'); localStorage.setItem('theme', 'light'); }
  }, [isDarkMode]);

  const fetchData = useCallback(async (withAnimation = false) => {
    if (withAnimation) setIsRefreshing(true);
    try {
      // Запрашиваем данные за месяц, если открыт таб "Календарь" ИЛИ если открыта модалка выбора даты
      if (activeTab === 'calendar' || isDatePickerOpen) {

        const y = calendarMonth.getFullYear();
        const m = String(calendarMonth.getMonth() + 1).padStart(2, '0');
        const data: {date: string, total_active: number}[] = await invoke('get_month_stats', { month: `${y}-${m}` });
        const map: Record<string, number> = {};
        data.forEach(d => { map[d.date] = d.total_active; });
        setMonthStats(map);
      } else {
        const data = await invoke<AppUsage[]>('get_stats_for_date', { date: selectedDate });
        setAppsData(data);
      }
    } catch (error) { console.error("Ошибка загрузки:", error); }
    
    if (withAnimation) {
      setRefreshKey(prev => prev + 1); 
      setTimeout(() => setIsRefreshing(false), 2500); 
    }
  }, [activeTab, selectedDate, calendarMonth, isDatePickerOpen]);


  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const handleFocus = () => {
      const now = Date.now();
      if (now - lastFetchTime.current < 10000) return;
      lastFetchTime.current = now; 
      fetchData(true);
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchData]);

  const handleColorChange = (appName: string, color: string) => {
    const updated = { ...customColors, [appName]: color };
    setCustomColors(updated);
    localStorage.setItem('customAppColors', JSON.stringify(updated));
  };

  const getAppColor = useCallback((appName: string) => customColors[appName] || getPaletteColor(appName), [customColors]);

  const formatTime = (totalSeconds: number) => {
    if (!totalSeconds) return '0с';
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
      const data = payload[0].payload;
      const color = data.isOther ? OTHER_COLOR : getAppColor(data.name);
      return (
        <div className="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 z-50">
          <div className="flex items-center space-x-2 mb-1">
             <span className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: color }}></span>
             <p className="font-bold text-slate-700 dark:text-slate-200">{data.name}</p>
          </div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{formatTime(payload[0].value)}</p>
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

  // --- ЛОГИКА КАЛЕНДАРЯ ---
  const changeMonth = (offset: number) => {
    setCalendarMonth(prev => {
      const newDate = new Date(prev.getFullYear(), prev.getMonth() + offset, 1);
      return newDate;
    });
  };

  // Передаем параметр isModal, чтобы менять размер ячеек
  const renderCalendarDays = (isModal: boolean = false) => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let firstDay = new Date(year, month, 1).getDay();
    firstDay = firstDay === 0 ? 6 : firstDay - 1; 

    const daysArray = [];
    for (let i = 0; i < firstDay; i++) { daysArray.push(<div key={`empty-${i}`} className="p-2" />); }
    
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const totalSecs = monthStats[dateStr] || 0;
      const isSelected = dateStr === selectedDate;
      const isToday = dateStr === getTodayString();
      
      // Фиксированная высота вместо aspect-square (решает проблему с огромным календарем)
      const heightClass = isModal ? "min-h-[56px] sm:min-h-[64px]" : "min-h-[70px] sm:min-h-[85px]";
      const textSize = isModal ? "text-base" : "text-lg";
      
      daysArray.push(
        <button
          key={i}
          onClick={() => { 
            setSelectedDate(dateStr); 
            setActiveTab('dashboard'); 
            if (isModal) setIsDatePickerOpen(false); // Закрываем модалку при выборе
          }}
          className={`relative w-full ${heightClass} rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all border-2 
            ${isSelected ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30' : 'border-transparent hover:border-slate-200 dark:hover:border-slate-600 bg-slate-50 dark:bg-slate-800/50'}
          `}
        >
          <span className={`${textSize} font-bold z-10 ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300'}`}>
            {i}
          </span>
          {totalSecs > 0 && (
            <span className={`font-semibold text-indigo-500 dark:text-indigo-400 mt-1 ${isModal ? 'text-[9px]' : 'text-[10px]'}`}>{formatTime(totalSecs)}</span>
          )}
          {isToday && <div className="absolute top-2 right-2 w-1.5 h-1.5 sm:w-2 sm:h-2 bg-emerald-500 rounded-full"></div>}
        </button>
      );
    }
    return daysArray;
  };


  return (
    <div className="h-screen bg-slate-50 dark:bg-slate-900 font-sans cursor-default transition-colors duration-300 flex flex-col rounded-xl overflow-hidden shadow-2xl outline-none border-none ring-0">
      <Titlebar />

      <div className="flex-1 overflow-y-auto custom-scrollbar px-8 pb-8 pt-3">
        <div className="max-w-5xl mx-auto">
          
          <header className="mb-6 flex flex-col md:flex-row md:justify-between md:items-end gap-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 mb-2">DailyHabit</h1>
              <p className="text-slate-500 dark:text-slate-400">Аналитика вашей продуктивности</p>
            </div>
            
            <div className="flex items-center space-x-4">
              <button onClick={() => setIsDarkMode(!isDarkMode)} className="w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors" title="Сменить тему">
                <span className="text-xl">{isDarkMode ? '☀️' : '🌙'}</span>
              </button>

              <div className="bg-white dark:bg-slate-800 p-1.5 rounded-2xl shadow-sm flex space-x-1 border border-slate-100 dark:border-slate-700 overflow-x-auto">
                <button onClick={() => setActiveTab('dashboard')} className={`whitespace-nowrap px-4 py-2.5 rounded-xl font-medium transition-all ${activeTab === 'dashboard' ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>📊 Дашборд</button>
                <button onClick={() => setActiveTab('categories')} className={`whitespace-nowrap px-4 py-2.5 rounded-xl font-medium transition-all ${activeTab === 'categories' ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>🗂️ Категории</button>
                <button onClick={() => setActiveTab('calendar')} className={`whitespace-nowrap px-4 py-2.5 rounded-xl font-medium transition-all ${activeTab === 'calendar' ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>📅 Календарь</button>
                <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1 self-center"></div>
                <button onClick={() => setIsSettingsOpen(true)} className="p-2.5 rounded-xl transition-all text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none" title="Настройки">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                </button>
              </div>
            </div>
          </header>


          {/* ЕДИНАЯ ПАНЕЛЬ ДЛЯ ДАШБОРДА И КАТЕГОРИЙ: Переключатель + Выбор Даты */}
          {(activeTab === 'dashboard' || activeTab === 'categories') && (
            <div className="flex flex-col sm:flex-row justify-between items-center bg-transparent mb-6 gap-4">
              <div className="flex bg-slate-200/50 dark:bg-slate-800 p-1 rounded-xl w-full sm:w-fit">
                <button onClick={() => setViewMode('active')} className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${viewMode === 'active' ? 'bg-white dark:bg-slate-600 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>Активное время</button>
                <button onClick={() => setViewMode('background')} className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${viewMode === 'background' ? 'bg-white dark:bg-slate-600 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>Активность в фоне</button>
              </div>

              {/* КАСТОМНАЯ КНОПКА ВЫБОРА ДАТЫ СПРАВА */}
              <button 
                onClick={() => setIsDatePickerOpen(true)}
                className="flex items-center justify-center space-x-3 bg-white dark:bg-slate-800 px-5 py-2 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:bg-slate-50 dark:hover:bg-slate-700/80 transition-all w-full sm:w-auto outline-none group"
                title="Выбрать другой день"
              >
                <span className="text-xl group-hover:scale-110 transition-transform">📅</span>
                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                  {selectedDate === getTodayString() ? 'Сегодня' : selectedDate.split('-').reverse().join('.')}
                </span>
                <svg className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
            </div>
          )}

          {activeTab === 'dashboard' && (
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
                      <div key={index} className="flex justify-between items-center p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-700/50 border border-transparent hover:border-slate-100 dark:hover:border-slate-600 transition-all">
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
                <div className="flex-1 relative">
                  <ResponsiveContainer key={`pie-${refreshKey}`} width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieChartData} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={2} dataKey="duration" stroke="none" className="cursor-pointer"
                        onClick={(data) => {
                          const entryData = data.payload || data;
                          if (!entryData.isOther) setColorPanel({ visible: true, appName: entryData.name });
                        }}
                      >
                        {pieChartData.map((entry: any, index) => <Cell key={`cell-${index}`} fill={entry.isOther ? OTHER_COLOR : getAppColor(entry.name)} className="hover:opacity-80 transition-opacity outline-none" />)}
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
                    <h2 className="text-lg font-semibold text-slate-600 dark:text-slate-200">Сравнение активностей за день</h2>
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
                          {barChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
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
          {activeTab === 'calendar' && (
            // Ограничение max-w-4xl и mx-auto не дает календарю растянуться
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none border border-transparent dark:border-slate-700 max-w-4xl mx-auto">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-200">История активности</h2>
                <div className="flex items-center space-x-4">
                  <button onClick={() => changeMonth(-1)} className="p-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl transition-colors text-slate-600 dark:text-slate-300">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
                  </button>
                  <span className="text-lg font-semibold text-slate-700 dark:text-slate-200 w-32 text-center capitalize">
                    {calendarMonth.toLocaleString('ru-RU', { month: 'long', year: 'numeric' })}
                  </span>
                  <button onClick={() => changeMonth(1)} className="p-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl transition-colors text-slate-600 dark:text-slate-300">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-7 gap-3 sm:gap-4">
                {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(d => (
                  <div key={d} className="text-center text-slate-400 dark:text-slate-500 font-bold mb-2">{d}</div>
                ))}
                {renderCalendarDays(false)}
              </div>
            </div>
          )}

          {/* МОДАЛЬНОЕ ОКНО НАСТРОЕК */}
          {isSettingsOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 dark:bg-slate-900/60 backdrop-blur-sm transition-all p-4" onClick={() => setIsSettingsOpen(false)}>
              <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 w-full max-w-md animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                    <svg className="w-6 h-6 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                    Настройки
                  </h3>
                  <button onClick={() => setIsSettingsOpen(false)} className="w-8 h-8 flex justify-center items-center rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors flex-shrink-0" title="Закрыть">✕</button>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                    <div className="pr-4">
                      <h4 className="font-semibold text-slate-700 dark:text-slate-200">Запускать по умолчанию</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug">При запуске ПК приложение будет работать в фоне. Откройте его ярлыком, чтобы посмотреть статистику.</p>
                    </div>
                    <button 
                      onClick={toggleAutoStart}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none ${autoStartEnabled ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${autoStartEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>

                  {/* КНОПКА ДЛЯ ПОЛНОГО ЗАКРЫТИЯ ПРИЛОЖЕНИЯ */}
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

          )}


          {/* НОВОЕ МОДАЛЬНОЕ ОКНО ДЛЯ ВЫБОРА ДАТЫ (ВЫЗЫВАЕТСЯ ИЗ ДАШБОРДА/КАТЕГОРИЙ) */}
          {isDatePickerOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 dark:bg-slate-900/60 backdrop-blur-sm transition-all p-4" onClick={() => setIsDatePickerOpen(false)}>
              <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 w-full max-w-xl animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200">Выберите день</h3>
                  <button onClick={() => setIsDatePickerOpen(false)} className="w-8 h-8 flex justify-center items-center rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors flex-shrink-0" title="Закрыть">✕</button>
                </div>
                
                <div className="flex justify-between items-center mb-6 bg-slate-50 dark:bg-slate-900/50 p-2 rounded-2xl">
                  <button onClick={() => changeMonth(-1)} className="p-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors shadow-sm text-slate-600 dark:text-slate-300">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
                  </button>
                  <span className="text-lg font-semibold text-slate-700 dark:text-slate-200 capitalize">
                    {calendarMonth.toLocaleString('ru-RU', { month: 'long', year: 'numeric' })}
                  </span>
                  <button onClick={() => changeMonth(1)} className="p-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors shadow-sm text-slate-600 dark:text-slate-300">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-2">
                  {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(d => (
                    <div key={d} className="text-center text-xs text-slate-400 dark:text-slate-500 font-bold mb-1">{d}</div>
                  ))}
                  {/* Вызываем с флагом true для уменьшенного размера */}
                  {renderCalendarDays(true)}
                </div>
              </div>
            </div>
          )}


          {colorPanel && colorPanel.visible && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 dark:bg-slate-900/60 backdrop-blur-sm transition-all" onClick={() => setColorPanel(null)}>
              <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 w-[300px] animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-5">
                  <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 truncate pr-2">Цвет: {colorPanel.appName}</h3>
                  <button onClick={() => setColorPanel(null)} className="w-8 h-8 flex justify-center items-center rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors flex-shrink-0" title="Закрыть">✕</button>
                </div>
                <div className="grid grid-cols-4 gap-3 mb-6">
                  {PALETTE.map(c => <button key={c} className={`w-12 h-12 rounded-2xl shadow-sm border-[3px] transition-transform hover:scale-110 ${customColors[colorPanel.appName] === c ? 'border-slate-800 dark:border-white scale-110' : 'border-transparent'}`} style={{ backgroundColor: c }} onClick={() => handleColorChange(colorPanel.appName, c)} />)}
                </div>
                <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-700/50 p-3 rounded-2xl">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Свой цвет:</span>
                  <input type="color" className="w-10 h-10 rounded-xl cursor-pointer border-0 bg-transparent p-0" value={getAppColor(colorPanel.appName)} onChange={(e) => handleColorChange(colorPanel.appName, e.target.value)} />
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

export default App;
