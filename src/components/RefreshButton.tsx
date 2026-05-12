const RefreshButton = ({ onRefresh, isRefreshing }: { onRefresh: () => void, isRefreshing: boolean }) => (
  <button onClick={onRefresh} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-none" title="Обновить">
    <svg className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  </button>
);

export default RefreshButton;
