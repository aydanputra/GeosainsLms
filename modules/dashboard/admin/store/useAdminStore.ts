import { create } from 'zustand';

interface AdminState {
  isSidebarOpen: boolean;
  activeMenu: string;
  toggleSidebar: () => void;
  setActiveMenu: (menu: string) => void;
}

export const useAdminStore = create<AdminState>((set) => ({
  isSidebarOpen: true,
  activeMenu: 'beranda',
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setActiveMenu: (menu) => set({ activeMenu: menu }),
}));
