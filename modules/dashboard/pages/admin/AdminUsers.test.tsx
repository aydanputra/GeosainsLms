import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AdminUsers from './AdminUsers';

describe('AdminUsers Component', () => {
  const mockUsers = [
    { id: '1', name: 'Admin User', email: 'admin@test.com', role: 'ADMIN', status: 'ACTIVE' },
    { id: '2', name: 'Mentor User', email: 'mentor@test.com', role: 'MENTOR', status: 'ACTIVE' },
    { id: '3', name: 'Student User', email: 'student@test.com', role: 'STUDENT', status: 'ACTIVE' },
  ];

  it('renders user list correctly', () => {
    render(<AdminUsers users={mockUsers} />);
    expect(screen.getByText('Admin User')).toBeDefined();
    expect(screen.getByText('mentor@test.com')).toBeDefined();
    expect(screen.getByText('STUDENT')).toBeDefined();
  });

  it('filters users by role', () => {
    render(<AdminUsers users={mockUsers} />);
    const filterSelect = screen.getByRole('combobox');
    
    fireEvent.change(filterSelect, { target: { value: 'MENTOR' } });
    expect(screen.queryByText('Admin User')).toBeNull();
    expect(screen.getByText('Mentor User')).toBeDefined();
    expect(screen.queryByText('Student User')).toBeNull();
  });

  it('searches users by name or email', () => {
    render(<AdminUsers users={mockUsers} />);
    const searchInput = screen.getByPlaceholderText('Cari pengguna...');
    
    fireEvent.change(searchInput, { target: { value: 'student' } });
    expect(screen.getByText('Student User')).toBeDefined();
    expect(screen.queryByText('Admin User')).toBeNull();
  });

  it('handles delete action', () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    confirmSpy.mockImplementation(() => true);
    const alertSpy = vi.spyOn(window, 'alert');
    alertSpy.mockImplementation(() => {});

    render(<AdminUsers users={mockUsers} />);
    const deleteButtons = screen.getAllByText('Hapus');
    fireEvent.click(deleteButtons[0]);

    expect(confirmSpy).toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith('Pengguna berhasil dihapus (simulasi)');
  });
});
