import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdminReports from './AdminReports';

const analyticsResponse = {
  range: '30d',
  from: '2026-06-01T00:00:00.000Z',
  to: '2026-06-30T00:00:00.000Z',
  totals: {
    pageviews: 1200,
    uniqueSessions: 640,
    newUsers: 80,
    newStudents: 24,
    pagesPerSession: 1.9,
  },
  previousTotals: {
    pageviews: 900,
    uniqueSessions: 500,
    newUsers: 50,
    newStudents: 15,
    pagesPerSession: 1.6,
  },
  daily: [
    { day: '2026-06-01', pageviews: 100, sessions: 40 },
    { day: '2026-06-02', pageviews: 120, sessions: 45 },
  ],
  topCourses: [{ id: 'c1', title: 'Geologi Dasar', slug: 'geologi-dasar', views: 320 }],
  topCategories: [{ id: 'cat1', name: 'Mineral', slug: 'mineral', views: 250 }],
  topReferrers: [{ host: 'google.com', views: 200 }],
  topPages: [{ path: '/courses/geologi-dasar', views: 320 }],
  landingPages: [{ path: '/courses', sessions: 140 }],
  utmSources: [{ value: 'google', views: 120 }],
  utmMediums: [{ value: 'organic', views: 90 }],
  utmCampaigns: [{ value: 'launch', views: 60 }],
  topProducts: [
    { id: 'p1', name: 'Atlas Geologi', slug: 'atlas-geologi', views: 80, vendor: null },
  ],
  topVendors: [{ id: 'v1', name: 'Geo Store', slug: 'geo-store', views: 60 }],
  topMentors: [
    {
      id: 'm1',
      name: 'Dr. Budi',
      email: 'budi@example.com',
      avatarUrl: null,
      courseViews: 210,
      vendorViews: 0,
      totalViews: 210,
      students: 42,
    },
  ],
};

describe('AdminReports Component', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => analyticsResponse,
    }) as any;
  });

  it('renders analytics title and metric cards', async () => {
    render(<AdminReports />);

    expect(await screen.findByText('Analytics')).toBeDefined();
    expect(screen.getByText('Pantau traffic, pertumbuhan user baru, dan konten yang paling banyak dilihat.')).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText('Pageviews')).toBeDefined();
      expect(screen.getByText('Sesi Unik')).toBeDefined();
      expect(screen.getByText('User Baru')).toBeDefined();
      expect(screen.getByText('Siswa Baru')).toBeDefined();
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/analytics/pageview?range=30d', { cache: 'no-store' });
  });

  it('renders analytics sections with loaded data', async () => {
    render(<AdminReports />);

    expect(await screen.findByText('Top Kursus (Views)')).toBeDefined();
    expect(screen.getByText('Top Kategori (Views)')).toBeDefined();
    expect(screen.getByText('Top Referrer')).toBeDefined();
    expect(screen.getByText('Top Halaman')).toBeDefined();
    expect(screen.getByText('google.com')).toBeDefined();
    expect(screen.getByText('/courses/geologi-dasar')).toBeDefined();
    expect(screen.getByText('Dr. Budi')).toBeDefined();
  });

  it('reloads analytics when range is changed', async () => {
    render(<AdminReports />);

    await screen.findByText('Analytics');

    fireEvent.change(screen.getByRole('combobox'), { target: { value: '7d' } });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/analytics/pageview?range=7d', { cache: 'no-store' });
    });
  });
});
