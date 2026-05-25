import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AdminReports from './AdminReports';

describe('AdminReports Component', () => {
  it('renders report title correctly', () => {
    render(<AdminReports />);
    expect(screen.getByText('Laporan & Analitik')).toBeDefined();
  });

  it('renders summary cards', () => {
    render(<AdminReports />);
    expect(screen.getByText('Kursus Terlaris')).toBeDefined();
    expect(screen.getByText('Geologi Dasar')).toBeDefined();
    expect(screen.getByText('Rating Tertinggi')).toBeDefined();
    expect(screen.getByText('Pendapatan Tertinggi')).toBeDefined();
  });

  it('renders all chart sections', () => {
    render(<AdminReports />);
    expect(screen.getByText('Kursus Terpopuler (Siswa)')).toBeDefined();
    expect(screen.getByText('Pendapatan Kursus')).toBeDefined();
    expect(screen.getByText('Penjualan Produk (6 Bulan Terakhir)')).toBeDefined();
    expect(screen.getByText('Aktivitas Pengguna (Mingguan)')).toBeDefined();
    expect(screen.getByText('Status Komisi Afiliasi')).toBeDefined();
  });
});
