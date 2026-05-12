import React from 'react';
import { formatTime, getTodayString } from '../utils';

interface DatePickerModalProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  calendarMonth: Date;
  changeMonth: (offset: number) => void;
  monthStats: Record<string, number>;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  setActiveTab: (tab: 'dashboard' | 'categories' | 'timer') => void;
  title?: string;
}

const DatePickerModal: React.FC<DatePickerModalProps> = ({
  isOpen, setIsOpen, calendarMonth, changeMonth, monthStats,
  selectedDate, setSelectedDate, setActiveTab, title = "Выберите день"
}) => {
  if (!isOpen) return null;

  const renderCalendarDays = () => {
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
      
      daysArray.push(
        <button key={i} onClick={() => { setSelectedDate(dateStr); setActiveTab('dashboard'); setIsOpen(false); }} className={`relative w-full min-h-[56px] sm:min-h-[64px] rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all border-2 ${isSelected ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30' : 'border-transparent hover:border-slate-200 dark:hover:border-slate-600 bg-slate-50 dark:bg-slate-800/50'}`}>
          <span className={`text-base font-bold z-10 ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300'}`}>{i}</span>
          {totalSecs > 0 && ( <span className="font-semibold text-indigo-500 dark:text-indigo-400 mt-1 text-[9px]">{formatTime(totalSecs)}</span> )}
          {isToday && <div className="absolute top-2 right-2 w-1.5 h-1.5 sm:w-2 sm:h-2 bg-emerald-500 rounded-full"></div>}
        </button>
      );
    }
    return daysArray;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 dark:bg-slate-900/60 backdrop-blur-sm transition-all p-4" onClick={() => setIsOpen(false)}>
      <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 w-full max-w-xl animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200">{title}</h3>
          <button onClick={() => setIsOpen(false)} className="w-8 h-8 flex justify-center items-center rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors shrink-0" title="Закрыть">✕</button>
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
          {renderCalendarDays()}
        </div>
      </div>
    </div>
  );
};

export default DatePickerModal;
