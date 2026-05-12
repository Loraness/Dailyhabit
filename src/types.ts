export interface AppUsage {
  name: string;
  active_duration: number;
  background_duration: number;
}

export interface FocusApp {
  name: string;
  duration: number;
}

export interface DailyTimerStats {
  focus: number;
  rest: number;
}

export interface TimerSettings {
  workMinutes: number | '';
  restMinutes: number | '';
  cycles: number | '';
  autoStartNextPhase: boolean;
}
