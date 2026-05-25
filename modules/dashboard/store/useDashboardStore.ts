import { create } from 'zustand';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'MENTOR' | 'STUDENT' | 'VENDOR';
  isSuperAdmin?: boolean;
}

interface DashboardState {
  sidebarOpen: boolean; // Mobile toggle
  sidebarCollapsed: boolean; // Desktop collapse (icon-only)
  toggleSidebar: () => void; // Toggle mobile sidebar
  toggleSidebarCollapse: () => void; // Toggle desktop collapse
  setSidebarOpen: (open: boolean) => void;
  isNavigating: boolean;
  startNavigation: () => void;
  stopNavigation: () => void;
  user: User | null;
  setUser: (user: User) => void;
  clearUser: () => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  sidebarOpen: false, // Default closed on mobile
  sidebarCollapsed: false, // Default expanded on desktop
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  toggleSidebarCollapse: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  isNavigating: false,
  startNavigation: () => set({ isNavigating: true }),
  stopNavigation: () => set({ isNavigating: false }),
  user: null,
  setUser: (user) => set({ user }),
  clearUser: () => set({ user: null }),
}));
