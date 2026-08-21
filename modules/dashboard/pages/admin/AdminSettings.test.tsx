import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AdminSettings from './AdminSettings';

describe('AdminSettings Component', () => {
  it('renders settings title correctly', () => {
    render(<AdminSettings isSuperAdmin={false} />);
    expect(screen.getByText('Pengaturan')).toBeDefined();
  });

  it('switches tabs correctly', async () => {
    render(<AdminSettings isSuperAdmin={false} />);
    
    // Default tab is General
    expect(await screen.findByText('Nama Situs')).toBeDefined();
    
    // Switch to Payment tab
    fireEvent.click(screen.getByText('Pembayaran'));
    expect(screen.getByText('Midtrans')).toBeDefined();
    
    // Switch to Roles tab
    fireEvent.click(screen.getByText('Role & Izin'));
    expect(screen.getByText('Kelola izin akses untuk setiap role pengguna.')).toBeDefined();
    
    // Switch to Notifications tab
    fireEvent.click(screen.getByText('Notifikasi'));
    expect(screen.getByText('Notifikasi Email')).toBeDefined();
  });
});
