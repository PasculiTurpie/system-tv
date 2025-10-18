import { create } from 'zustand';

export const useAuthStore = create((set) => ({
  user: null,
  isAuthenticated: false,
  permissions: { canEdit: true },
  bootstrap: () => {
    set({
      user: { id: 'user-1', name: 'Admin' },
      isAuthenticated: true,
    });
  },
  logout: () => {
    set({ user: null, isAuthenticated: false });
  },
}));
