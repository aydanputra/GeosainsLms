import { useQuery } from '@tanstack/react-query';

export interface DashboardStats {
  totalUsers: number;
  totalCourses: number;
  totalOrders: number;
  revenue: number;
  netSalesTotal?: number;
  marketplaceFeeTotal?: number;
  activeStudents: number;
  pendingWithdrawals: number;
  affiliateClicks?: number;
  affiliateConversions?: number;
}

export const fetchDashboardStats = async (): Promise<DashboardStats> => {
  const res = await fetch('/api/dashboard/stats/admin');
  if (!res.ok) {
    throw new Error('Failed to fetch dashboard stats');
  }
  return res.json();
};

export const useDashboardStats = () => {
  return useQuery({
    queryKey: ['dashboardStats'],
    queryFn: fetchDashboardStats,
  });
};

export const useAdminStats = () => {
  return useQuery({
    queryKey: ['adminStats'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard/stats/admin');
      if (!res.ok) throw new Error('Failed to fetch admin stats');
      return res.json();
    },
  });
};

export const useAdminOrders = () => {
  return useQuery({
    queryKey: ['adminOrders'],
    queryFn: async () => {
      const res = await fetch('/api/shop/orders');
      if (!res.ok) throw new Error('Failed to fetch orders');
      return res.json();
    },
  });
};

export const useMentorStats = () => {
  return useQuery({
    queryKey: ['mentorStats'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard/stats/mentor');
      if (!res.ok) throw new Error('Failed to fetch mentor stats');
      return res.json();
    },
  });
};

export const useMentorCourses = () => {
  return useQuery({
    queryKey: ['mentorCourses'],
    queryFn: async () => {
      // Assuming logged in user is mentor, we can filter by instructorId=me or handle in backend
      // But api/courses doesn't support "me" yet, but we updated it to take instructorId
      // However, frontend doesn't know ID easily without store.
      // Let's assume we use a new endpoint or the component passes the ID.
      // Actually, for simplicity, let's create a dedicated endpoint /api/dashboard/mentor/courses 
      // OR just rely on the component to pass data (Server Component).
      // BUT if we MUST provide a hook:
      // We can use /api/courses?instructorId={userId} if we have userId.
      // Since we don't have userId here easily, let's create a dedicated endpoint:
      // /api/dashboard/mentor/courses that uses the token.
      
      // Let's use a new endpoint for simplicity and security (token based)
      const res = await fetch('/api/dashboard/mentor/courses'); 
      if (!res.ok) throw new Error('Failed to fetch mentor courses');
      return res.json();
    },
  });
};

export const useStudentStats = () => {
  return useQuery({
    queryKey: ['studentStats'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard/stats/student');
      if (!res.ok) throw new Error('Failed to fetch student stats');
      return res.json();
    },
  });
};

export const useStudentCourses = () => {
  return useQuery({
    queryKey: ['studentCourses'],
    queryFn: async () => {
      const res = await fetch('/api/courses/enrolled');
      if (!res.ok) throw new Error('Failed to fetch student courses');
      return res.json();
    },
  });
};
