import { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { enable, isEnabled, disable } from '@tauri-apps/plugin-autostart';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import './App.css';

import { AppUsage, DailyTimerStats, TimerSettings } from './types';
import { getCategoryInfo, getPaletteColor, getTodayString, OTHER_COLOR, PALETTE } from './utils';

import Titlebar from './components/Titlebar';
import CustomTooltip from './components/CustomTooltip';
import TimerSection from './components/TimerSection';
import DashboardSection from './components/DashboardSection';
import CategoriesSection from './components/CategoriesSection';
import SettingsModal from './components/SettingsModal';
import DatePickerModal from './components/DatePickerModal';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

const MemoizedPieChart = memo(({ refreshKey, pieChartData, OTHER_COLOR, getAppColor, setColorPanel }: any) => (
  <ResponsiveContainer key={`pie-${refreshKey}`} width="99%" height="100%" minHeight={0} minWidth={0}>
    <PieChart>
      <Pie 
        data={pieChartData} 
        cx="50%" 
        cy="50%" 
        innerRadius={70} 
        outerRadius={100} 
        paddingAngle={2} 
        dataKey="duration" 
        stroke="none" 
        className="cursor-pointer" 
        onClick={(data) => { 
          const entryData = data.payload || data; 
          if (!entryData.isOther) setColorPanel({ visible: true, appName: entryData.name }); 
        }}
      >
        {pieChartData.map((entry: any, index: number) => (
          <Cell key={`cell-${index}`} fill={entry.isOther ? OTHER_COLOR : getAppColor(entry.name)} className="hover:opacity-80 transition-opacity outline-none" />
        ))}
      </Pie>
      <Tooltip content={<CustomTooltip getAppColor={getAppColor} OTHER_COLOR={OTHER_COLOR} />} />
    </PieChart>
  </ResponsiveContainer>
));

const MemoizedBarChart = memo(({ refreshKey, barChartData, isDarkMode, getAppColor, OTHER_COLOR }: any) => (
  <ResponsiveContainer key={`bar-${refreshKey}`} width="99%" height="100%" minHeight={0} minWidth={0}>
    <BarChart data={barChartData} margin={{ top: 0, right: 30, left: 0, bottom: 0 }} barSize={30}>
      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#334155' : '#f1f5f9'} />
      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 12}} />
      <YAxis hide />
      <Tooltip cursor={{fill: 'transparent'}} content={<CustomTooltip getAppColor={getAppColor} OTHER_COLOR={OTHER_COLOR} />} />
      <Bar dataKey="duration" radius={[6, 6, 6, 6]}>
        {barChartData.map((entry: any, index: number) => <Cell key={`cell-${index}`} fill={entry.color} />)}
      </Bar>
    </BarChart>
  </ResponsiveContainer>
));

function App() {
  const [appsData, setAppsData] = useState<AppUsage[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'categories' | 'timer'>('dashboard');
  
  // --- СОСТОЯНИЯ ТАЙМЕРА ---
  const [timerState, setTimerState] = useState<'idle' | 'work' | 'rest'>('idle');
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalPhaseTime, setTotalPhaseTime] = useState(1);
  const [timerActive, setTimerActive] = useState(false);
  const [currentCycle, setCurrentCycle] = useState(1);
  
  const [timerSettings, setTimerSettings] = useState<TimerSettings>({
    workMinutes: 50,
    restMinutes: 10,
    cycles: 3,
    autoStartNextPhase: false
  });

  const [smartCalc, setSmartCalc] = useState({
    totalWorkHours: 3,
    totalRestMinutes: 40,
    restCount: 3
  });
  
  const [focusUsage, setFocusUsage] = useState<Record<string, number>>(() => {
    try { const saved = localStorage.getItem(`focusUsage_${getTodayString()}`); return saved ? (JSON.parse(saved) || {}) : {}; } catch { return {}; }
  });
  const [dailyTimerStats, setDailyTimerStats] = useState<DailyTimerStats>(() => {
    try {
      const saved = localStorage.getItem(`dailyTimerStats_${getTodayString()}`); const parsed = saved ? JSON.parse(saved) : null;
      return parsed && typeof parsed === 'object' ? { focus: parsed.focus || 0, rest: parsed.rest || 0 } : { focus: 0, rest: 0 };
    } catch { return { focus: 0, rest: 0 }; }
  });

  const [isFocusLoaded, setIsFocusLoaded] = useState(false);
  const [historyFocusUsage, setHistoryFocusUsage] = useState<Record<string, number>>({});
  const [historyTimerStats, setHistoryTimerStats] = useState<DailyTimerStats>({focus: 0, rest: 0});
  const [selectedFocusDate, setSelectedFocusDate] = useState<string>(getTodayString());
  const [isFocusDatePickerOpen, setIsFocusDatePickerOpen] = useState(false);
  const [focusCalendarMonth, setFocusCalendarMonth] = useState(new Date());
  const [focusMonthStats, setFocusMonthStats] = useState<Record<string, number>>({});

  useEffect(() => {
    invoke('get_focus_stats', { date: selectedFocusDate }).then((res: any) => {
      const usage: Record<string, number> = {};
      res.apps.forEach((a: any) => usage[a.name] = a.duration);
      
      if (selectedFocusDate === getTodayString()) {
        setFocusUsage(prev => Object.keys(prev).length > Object.keys(usage).length ? prev : usage);
        setDailyTimerStats(prev => prev.focus > res.focus_time ? prev : { focus: res.focus_time, rest: res.rest_time });
        setIsFocusLoaded(true);
      } else {
        setHistoryFocusUsage(usage);
        setHistoryTimerStats({ focus: res.focus_time, rest: res.rest_time });
      }
    }).catch((e) => {
      console.error(e);
      if (selectedFocusDate === getTodayString()) setIsFocusLoaded(true);
    });
  }, [selectedFocusDate]);



  useEffect(() => {
    if (isFocusDatePickerOpen) {
      const y = focusCalendarMonth.getFullYear();
      const m = String(focusCalendarMonth.getMonth() + 1).padStart(2, '0');
      invoke('get_focus_month_stats', { month: `${y}-${m}` }).then((data: any) => {
        const map: Record<string, number> = {};
        data.forEach((d: any) => { map[d.date] = d.total_active; });
        setFocusMonthStats(map);
      }).catch(console.error);
    }
  }, [focusCalendarMonth, isFocusDatePickerOpen]);

  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        const update = await check();
        if (update) {
          const yes = window.confirm(`Доступно обновление до версии ${update.version}!\n\nЧто нового:\n${update.body}\n\nУстановить сейчас?`);
          if (yes) {
            await update.downloadAndInstall();
            await relaunch();
          }
        }
      } catch (e) {
        console.error('Ошибка проверки обновлений:', e);
      }
    };
    // Откладываем проверку на 3 секунды, чтобы не тормозить запуск
    setTimeout(checkForUpdates, 3000);
  }, []);

  const displayFocusUsage = selectedFocusDate === getTodayString() ? focusUsage : historyFocusUsage;
  const displayTimerStats = selectedFocusDate === getTodayString() ? dailyTimerStats : historyTimerStats;
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

  const [bringToFrontEnabled, setBringToFrontEnabled] = useState(() => {
    const saved = localStorage.getItem('bringToFront');
    return saved !== null ? saved === 'true' : false;
  });

  useEffect(() => {
    localStorage.setItem('bringToFront', bringToFrontEnabled ? 'true' : 'false');
  }, [bringToFrontEnabled]);

  useEffect(() => {
    const checkAutostart = async () => {
      try {
        const enabled = await isEnabled();
        setAutoStartEnabled(enabled);
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
  const [selectedDate, setSelectedDate] = useState<string>(getTodayString());
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [monthStats, setMonthStats] = useState<Record<string, number>>({});
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);

  const lastFetchTime = useRef(0);

  useEffect(() => {
    if (isDarkMode) { document.documentElement.classList.add('dark'); localStorage.setItem('theme', 'dark'); }
    else { document.documentElement.classList.remove('dark'); localStorage.setItem('theme', 'light'); }
  }, [isDarkMode]);

  const fetchData = useCallback(async (withAnimation = false) => {
    if (withAnimation) setIsRefreshing(true);
    try {
      if (isDatePickerOpen) {
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
  }, [selectedDate, calendarMonth, isDatePickerOpen]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const isWindowFocusedRef = useRef(true);
  const expectedEndTime = useRef(0);

  useEffect(() => {
    const handleFocus = () => {
      isWindowFocusedRef.current = true;
      if (expectedEndTime.current > 0) {
        const remaining = Math.max(0, Math.round((expectedEndTime.current - Date.now()) / 1000));
        setTimeLeft(remaining);
      }
    };
    const handleBlur = () => { isWindowFocusedRef.current = false; };
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    return () => { window.removeEventListener('focus', handleFocus); window.removeEventListener('blur', handleBlur); };
  }, []);

  useEffect(() => {
    let interval: any = null;
    const bringWindowToFront = async () => {
      if (!bringToFrontEnabled) return;
      try {
        // Вызываем обновленную команду в Rust
        await invoke('show_window');
      } catch (e) {
        console.error("Ошибка при попытке развернуть окно:", e);
      }
    };

    if (timerActive && timeLeft > 0) {
      if (expectedEndTime.current === 0) { expectedEndTime.current = Date.now() + (timeLeft * 1000); }
      interval = setInterval(() => {
        if (isWindowFocusedRef.current) { setTimeLeft((t) => t - 1); }
        else { setTimeLeft(Math.max(0, Math.round((expectedEndTime.current - Date.now()) / 1000))); }
      }, 1000);
    } else if (timerActive && timeLeft === 0) {
      expectedEndTime.current = 0;
      if (timerState === 'work') {
        setDailyTimerStats(prev => ({ ...prev, focus: prev.focus + totalPhaseTime }));
        try { new Audio('/audio/end_focus.mp3').play(); } catch (e) { console.error(e); }
        bringWindowToFront(); 

        if (currentCycle < Number(timerSettings.cycles)) {
          setTimerState('rest');
          setTimeLeft(Number(timerSettings.restMinutes) * 60);
          setTotalPhaseTime(Number(timerSettings.restMinutes) * 60);
          if (!timerSettings.autoStartNextPhase) setTimerActive(false); 
        } else {
          setTimerActive(false); setTimerState('idle'); setCurrentCycle(1);
        }
      } else if (timerState === 'rest') {
        setDailyTimerStats(prev => ({ ...prev, rest: prev.rest + totalPhaseTime }));
        try { new Audio('/audio/end_freetime.mp3').play(); } catch (e) { console.error(e); }
        bringWindowToFront(); 
        setCurrentCycle((c) => c + 1); setTimerState('work');
        setTimeLeft(Number(timerSettings.workMinutes) * 60);
        setTotalPhaseTime(Number(timerSettings.workMinutes) * 60);
        if (!timerSettings.autoStartNextPhase) setTimerActive(false);
      }
    }
    return () => clearInterval(interval);
  }, [timerActive, timeLeft, timerState, currentCycle, timerSettings, bringToFrontEnabled, totalPhaseTime]);

  useEffect(() => {
    let stateCode = 0;
    if (timerActive) {
      if (timerState === 'work') stateCode = 1;
      else if (timerState === 'rest') stateCode = 2;
    }
    invoke('set_timer_state', { timerState: stateCode }).catch(console.error);

    if (timerState === 'idle' && !timerActive && isFocusLoaded) {
      // Подтягиваем свежую статистику фокуса с бэкенда, чтобы обновить UI
      invoke('get_focus_stats', { date: getTodayString() }).then((res: any) => {
        const usage: Record<string, number> = {};
        res.apps.forEach((a: any) => usage[a.name] = a.duration);
        setFocusUsage(usage);
        setDailyTimerStats({ focus: res.focus_time, rest: res.rest_time });
      }).catch(console.error);
    }
  }, [timerState, timerActive, isFocusLoaded]);

  const toggleTimer = useCallback(() => {
    expectedEndTime.current = 0;
    if (timerState === 'idle') {
      const work = Number(timerSettings.workMinutes);
      if (!work) return;
      setTimerState('work'); setTimeLeft(work * 60); setTotalPhaseTime(work * 60); setCurrentCycle(1);
    }
    setTimerActive(active => !active);
  }, [timerState, timerSettings]);

  const stopTimer = useCallback(() => {
    expectedEndTime.current = 0;
    if (timerState === 'work') { setDailyTimerStats(prev => ({ ...prev, focus: prev.focus + (totalPhaseTime - timeLeft) })); }
    else if (timerState === 'rest') { setDailyTimerStats(prev => ({ ...prev, rest: prev.rest + (totalPhaseTime - timeLeft) })); }
    setTimerActive(false); setTimerState('idle'); setTimeLeft(0); setCurrentCycle(1);
  }, [timerState, totalPhaseTime, timeLeft]);

  const handleSettingChange = useCallback((field: 'workMinutes' | 'restMinutes' | 'cycles', value: string) => {
    const cleanValue = value.replace(/\D/g, '');
    if (cleanValue === '') { setTimerSettings(prev => ({ ...prev, [field]: '' })); return; }
    let num = parseInt(cleanValue, 10);
    if (num > 999) num = 999;
    if (field === 'cycles' && num === 0) num = 1;
    if (field === 'workMinutes' && num === 0) num = 1;
    setTimerSettings(prev => ({ ...prev, [field]: num }));
  }, []);

  const applySmartCalc = useCallback(() => {
    const workMins = Math.floor((smartCalc.totalWorkHours * 60) / (smartCalc.restCount + 1));
    const restMins = Math.floor(smartCalc.totalRestMinutes / smartCalc.restCount);
    setTimerSettings(prev => ({ ...prev, workMinutes: workMins, restMinutes: restMins, cycles: smartCalc.restCount + 1 }));
  }, [smartCalc]);

  const setAutoPreset = useCallback(() => {
    setTimerSettings(prev => ({ ...prev, workMinutes: 50, restMinutes: 10, cycles: 3 }));
  }, []);

  useEffect(() => {
    const handleFocus = () => {
      const now = Date.now();
      if (now - lastFetchTime.current < 10000) return;
      lastFetchTime.current = now; fetchData(true);
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

  const processedApps = useMemo(() => {
    return appsData
      .map(app => ({ name: app.name, duration: viewMode === 'active' ? app.active_duration : app.background_duration }))
      .filter(app => app.duration > 0)
      .sort((a, b) => b.duration - a.duration);
  }, [appsData, viewMode]);

  const pieChartData = useMemo(() => {
    if (processedApps.length <= chartLimit) return processedApps; 
    const topApps = processedApps.slice(0, chartLimit);
    const otherApps = processedApps.slice(chartLimit);
    const otherDuration = otherApps.reduce((sum, app) => sum + app.duration, 0);
    return [...topApps, { name: 'Остальное', duration: otherDuration, isOther: true }];
  }, [processedApps, chartLimit]);

  const sortedFocusApps = useMemo(() => {
    return Object.entries(displayFocusUsage)
      .map(([name, duration]) => ({ name, duration }))
      .filter(app => app.duration > 0)
      .sort((a, b) => b.duration - a.duration);
  }, [displayFocusUsage]);

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

  const barChartData = useMemo(() => Object.values(categorizedData)
    .filter(cat => cat.totalTime > 0)
    .map(cat => ({ name: cat.info.label, duration: cat.totalTime, color: cat.info.color }))
    .sort((a, b) => b.duration - a.duration), [categorizedData]);

  const changeMonth = useCallback((offset: number) => {
    setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
  }, []);

  const changeFocusMonth = useCallback((offset: number) => {
    setFocusCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
  }, []);

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
                <button onClick={() => setActiveTab('timer')} className={`whitespace-nowrap px-4 py-2.5 rounded-xl font-medium transition-all ${activeTab === 'timer' ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>⏱️ Таймер</button>
                <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1 self-center"></div>
                <button onClick={() => setIsSettingsOpen(true)} className="p-2.5 rounded-xl transition-all text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none" title="Настройки">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                </button>
              </div>
            </div>
          </header>

          {(activeTab === 'dashboard' || activeTab === 'categories') && (
            <div className="flex flex-col sm:flex-row justify-between items-center bg-transparent mb-6 gap-4">
              <div className="flex bg-slate-200/50 dark:bg-slate-800 p-1 rounded-xl w-full sm:w-fit">
                <button onClick={() => setViewMode('active')} className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${viewMode === 'active' ? 'bg-white dark:bg-slate-600 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>Активное время</button>
                <button onClick={() => setViewMode('background')} className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${viewMode === 'background' ? 'bg-white dark:bg-slate-600 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>Активность в фоне</button>
              </div>
              <button onClick={() => setIsDatePickerOpen(true)} className="flex items-center justify-center space-x-3 bg-white dark:bg-slate-800 px-5 py-2 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:bg-slate-50 dark:hover:bg-slate-700/80 transition-all w-full sm:w-auto outline-none group" title="Выбрать другой день">
                <span className="text-xl group-hover:scale-110 transition-transform">📅</span>
                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{selectedDate === getTodayString() ? 'Сегодня' : selectedDate.split('-').reverse().join('.')}</span>
                <svg className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
            </div>
          )}

          {activeTab === 'dashboard' && (
            <DashboardSection 
              processedApps={processedApps} showAllApps={showAllApps} setShowAllApps={setShowAllApps} 
              selectedDate={selectedDate} getTodayString={getTodayString} getAppColor={getAppColor} 
              fetchData={fetchData} isRefreshing={isRefreshing} chartLimit={chartLimit} setChartLimit={setChartLimit} 
              memoizedPieChart={<MemoizedPieChart refreshKey={refreshKey} pieChartData={pieChartData} OTHER_COLOR={OTHER_COLOR} getAppColor={getAppColor} isDarkMode={isDarkMode} setColorPanel={setColorPanel} />} 
            />
          )}

          {activeTab === 'categories' && (
            <CategoriesSection 
              barChartData={barChartData} fetchData={fetchData} isRefreshing={isRefreshing} 
              memoizedBarChart={<MemoizedBarChart refreshKey={refreshKey} barChartData={barChartData} isDarkMode={isDarkMode} getAppColor={getAppColor} OTHER_COLOR={OTHER_COLOR} />} 
              categorizedData={categorizedData} 
            />
          )}

          {activeTab === 'timer' && (
            <TimerSection 
              timerState={timerState} timeLeft={timeLeft} totalPhaseTime={totalPhaseTime} timerActive={timerActive} 
              currentCycle={currentCycle} timerSettings={timerSettings} toggleTimer={toggleTimer} stopTimer={stopTimer} 
              handleSettingChange={handleSettingChange} setTimerSettings={setTimerSettings} smartCalc={smartCalc} 
              setSmartCalc={setSmartCalc} applySmartCalc={applySmartCalc} setAutoPreset={setAutoPreset} 
              displayTimerStats={displayTimerStats} selectedFocusDate={selectedFocusDate} 
              setIsFocusDatePickerOpen={setIsFocusDatePickerOpen} setIsClearConfirmOpen={setIsClearConfirmOpen} 
              sortedFocusApps={sortedFocusApps} getAppColor={getAppColor} 
            />
          )}

          <SettingsModal 
            isOpen={isSettingsOpen} setIsOpen={setIsSettingsOpen} autoStartEnabled={autoStartEnabled} 
            toggleAutoStart={toggleAutoStart} bringToFrontEnabled={bringToFrontEnabled} setBringToFrontEnabled={setBringToFrontEnabled} 
          />

          <DatePickerModal 
            isOpen={isDatePickerOpen} setIsOpen={setIsDatePickerOpen} calendarMonth={calendarMonth} 
            changeMonth={changeMonth} monthStats={monthStats} selectedDate={selectedDate} 
            setSelectedDate={setSelectedDate} setActiveTab={setActiveTab} 
          />

          <DatePickerModal 
            isOpen={isFocusDatePickerOpen} setIsOpen={setIsFocusDatePickerOpen} calendarMonth={focusCalendarMonth} 
            changeMonth={changeFocusMonth} monthStats={focusMonthStats} selectedDate={selectedFocusDate} 
            setSelectedDate={setSelectedFocusDate} setActiveTab={setActiveTab} title="История фокуса"
          />

          {isClearConfirmOpen && (
            <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/30 dark:bg-slate-900/60 backdrop-blur-sm transition-all p-4" onClick={() => setIsClearConfirmOpen(false)}>
              <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 w-full max-w-sm animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-red-100 dark:bg-red-500/20 text-red-500 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">🗑️</div>
                  <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200 mb-2">Очистить историю?</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Вы собираетесь удалить всю историю фокуса и отдыха за сегодня. Это действие нельзя отменить.</p>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setIsClearConfirmOpen(false)} className="flex-1 py-3 rounded-xl font-bold text-slate-600 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 transition-colors">Отмена</button>
                  <button onClick={() => {
                    if (selectedFocusDate === getTodayString()) { setFocusUsage({}); setDailyTimerStats({ focus: 0, rest: 0 }); }
                    else { setHistoryFocusUsage({}); setHistoryTimerStats({ focus: 0, rest: 0 }); }
                    invoke('clear_focus_stats', { date: selectedFocusDate }).catch(console.error);
                    setIsClearConfirmOpen(false);
                  }} className="flex-1 py-3 rounded-xl font-bold text-white bg-red-500 hover:bg-red-600 drop-shadow-md transition-colors">Очистить</button>
                </div>
              </div>
            </div>
          )}

          {colorPanel && colorPanel.visible && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 dark:bg-slate-900/60 backdrop-blur-sm transition-all" onClick={() => setColorPanel(null)}>
              <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 w-75 animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-5">
                  <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 truncate pr-2">Цвет: {colorPanel.appName}</h3>
                  <button onClick={() => setColorPanel(null)} className="w-8 h-8 flex justify-center items-center rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors shrink-0" title="Закрыть">✕</button>
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
