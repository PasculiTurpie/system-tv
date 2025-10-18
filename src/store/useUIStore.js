import { create } from 'zustand';

const prefersDark = () => (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);

export const useUIStore = create((set, get) => {
  const initialTheme = prefersDark() ? 'dark' : 'light';
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', initialTheme === 'dark');
  }

  return {
    theme: initialTheme,
    permissions: { canEdit: true },
    toggleTheme: () => {
      const next = get().theme === 'dark' ? 'light' : 'dark';
      if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle('dark', next === 'dark');
      }
      set({ theme: next });
    },
  };
});
