import rules from './rules.json';

export const PALETTE = [ '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e' ];

export const OTHER_COLOR = '#cbd5e1';

export const getPaletteColor = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length];
};

export const getCategoryInfo = (appName: string) => {
  let catId = 'other';
  const siteMatch = (rules.sites as any[]).find(s => s.name === appName);
  const appMatch = (rules.apps as any[]).find(a => a.name === appName);
  
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

export const getTodayString = () => new Date().toISOString().split('T')[0];

export const formatTime = (totalSeconds: number) => {
  if (!totalSeconds) return '0с';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}ч ${m}м`;
  if (m > 0) return `${m}м ${s}с`;
  return `${s}с`;
};

const TIMER_SETTINGS_KEY = 'lastTimerSettings';

export const DEFAULT_TIMER_SETTINGS = {
  workMinutes: 50 as number | '',
  restMinutes: 10 as number | '',
  cycles: 3 as number | '',
  autoStartNextPhase: false,
};

const sanitizeMinutes = (value: any, fallback: number, min: number, max: number) => {
  if (value === '' || value === null || value === undefined) return fallback;
  if (typeof value === 'string' && value.trim() === '') return fallback;

  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  const rounded = Math.floor(num);
  if (rounded < min) return fallback;
  if (rounded > max) return max;
  return rounded;
};

export const loadTimerSettings = () => {
  try {
    const saved = localStorage.getItem(TIMER_SETTINGS_KEY);
    if (!saved) return { ...DEFAULT_TIMER_SETTINGS };
    const parsed = JSON.parse(saved);
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_TIMER_SETTINGS };
    return {
      workMinutes: sanitizeMinutes(parsed.workMinutes, 50, 1, 999),
      restMinutes: sanitizeMinutes(parsed.restMinutes, 10, 0, 999),
      cycles: sanitizeMinutes(parsed.cycles, 3, 1, 999),
      autoStartNextPhase: Boolean(parsed.autoStartNextPhase),
    };
  } catch (e) {
    console.error('Не удалось прочитать настройки таймера:', e);
    return { ...DEFAULT_TIMER_SETTINGS };
  }
};

export const saveTimerSettings = (settings: {
  workMinutes: number | '';
  restMinutes: number | '';
  cycles: number | '';
  autoStartNextPhase: boolean;
}) => {
  try {
    const payload = {
      workMinutes: sanitizeMinutes(settings.workMinutes, 50, 1, 999),
      restMinutes: sanitizeMinutes(settings.restMinutes, 10, 0, 999),
      cycles: sanitizeMinutes(settings.cycles, 3, 1, 999),
      autoStartNextPhase: Boolean(settings.autoStartNextPhase),
    };
    localStorage.setItem(TIMER_SETTINGS_KEY, JSON.stringify(payload));
  } catch (e) {
    console.error('Не удалось сохранить настройки таймера:', e);
  }
};

export const CATEGORY_LIST = [
  { id: 'study',         label: 'Учеба и Работа', icon: '🎓', color: '#3b82f6' },
  { id: 'entertainment', label: 'Развлечения',    icon: '▶️', color: '#f59e0b' },
  { id: 'games',         label: 'Игры',           icon: '🎮', color: '#10b981' },
  { id: 'social',        label: 'Общение',        icon: '💬', color: '#8b5cf6' },
  { id: 'other',         label: 'Прочее',         icon: '⚙️', color: '#94a3b8' },
];

export const normalizeSitePattern = (input: string) => {
  let value = input.trim().toLowerCase();
  if (!value) return '';

  value = value.replace(/^https?:\/\//, '');
  value = value.replace(/^www\./, '');
  value = value.split('/')[0].split('?')[0].split('#')[0];

  return value.trim();
};


