import { cookies } from 'next/headers';
import { verifyToken } from '@/modules/auth/utils/auth';
import { getDashboardSiteLogoUrl, getDashboardUnreadCounts, getDashboardUserSnapshot, getVendorMenuState } from '@/modules/dashboard/api/performance';
// Import client layout component
import DashboardLayoutClient from '../../modules/dashboard/components/DashboardLayoutClient';

type DashboardUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: 'ADMIN' | 'MENTOR' | 'STUDENT' | 'VENDOR';
  isSuperAdmin: boolean;
};

type VendorMenuState = {
  mode: 'NONE' | 'PENDING' | 'ACTIVE';
  isOwner: boolean;
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  
  let role = 'ADMIN';
  let userId: string | null = null;
  let initialUser: DashboardUser | null = null;
  let initialVendorMenu: VendorMenuState = { mode: 'NONE', isOwner: false };
  let initialSiteLogoUrl = '';
  
  if (token) {
    const payload = await verifyToken(token);
    if (payload?.role) {
      const allowed = new Set(['ADMIN', 'MENTOR', 'STUDENT', 'VENDOR']);
      role = allowed.has(String(payload.role)) ? String(payload.role) : 'STUDENT';
    }
    if (payload?.id) userId = String(payload.id);
  }

  if (userId) {
    try {
      const user = await getDashboardUserSnapshot(userId);

      if (user?.id && user?.email && user?.role) {
        const normalizedRole = String(user.role).toUpperCase();
        const allowed = new Set(['ADMIN', 'MENTOR', 'STUDENT', 'VENDOR']);
        const safeRole = (allowed.has(normalizedRole) ? normalizedRole : role) as DashboardUser['role'];
        role = safeRole;
        initialUser = {
          id: String(user.id),
          name:
            typeof user.name === 'string' && user.name.trim()
              ? user.name.trim()
              : String(user.email).split('@')[0],
          email: String(user.email),
          avatarUrl: typeof user.avatarUrl === 'string' ? user.avatarUrl : null,
          role: safeRole,
          isSuperAdmin: Boolean((user as any).isSuperAdmin),
        };
      }
    } catch {
      initialUser = null;
    }
  }

  if (userId && role !== 'ADMIN' && role !== 'VENDOR') {
    try {
      initialVendorMenu = await getVendorMenuState(userId);
    } catch {
      initialVendorMenu = { mode: 'NONE', isOwner: false };
    }
  }

  try {
    initialSiteLogoUrl = await getDashboardSiteLogoUrl();
  } catch {
    initialSiteLogoUrl = '';
  }

  let qaUnansweredCount = 0;
  let notificationUnreadCount = 0;
  let dmUnreadCount = 0;
  if (userId) {
    try {
      const counts = await getDashboardUnreadCounts(userId);
      dmUnreadCount = Number(counts.dmUnreadCount || 0);
      qaUnansweredCount = Number(counts.qaUnansweredCount || 0);
      notificationUnreadCount = Number(counts.notificationUnreadCount || 0);
    } catch {
      qaUnansweredCount = 0;
      notificationUnreadCount = 0;
      dmUnreadCount = 0;
    }
  }

  return (
    <DashboardLayoutClient
      role={role as any}
      initialUser={initialUser}
      initialVendorMenu={initialVendorMenu}
      initialSiteLogoUrl={initialSiteLogoUrl}
      qaUnansweredCount={qaUnansweredCount}
      notificationUnreadCount={notificationUnreadCount}
    >
      {children}
    </DashboardLayoutClient>
  );
}
