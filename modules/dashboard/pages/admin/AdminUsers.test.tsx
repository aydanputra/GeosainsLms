import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdminUsers from './AdminUsers';

describe('AdminUsers Component', () => {
  const mockUsers = [
    { id: '1', name: 'Admin User', email: 'admin@test.com', role: 'ADMIN', status: 'ACTIVE' },
    { id: '2', name: 'Mentor User', email: 'mentor@test.com', role: 'MENTOR', status: 'ACTIVE' },
    { id: '3', name: 'Student User', email: 'student@test.com', role: 'STUDENT', status: 'ACTIVE' },
  ];

  beforeEach(() => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ deletedIds: ['1'], user: null }),
    });
  });

  it('renders user list correctly', () => {
    render(<AdminUsers users={mockUsers} />);
    expect(screen.getAllByText('Admin User').length).toBeGreaterThan(0);
    expect(screen.getAllByText('mentor@test.com').length).toBeGreaterThan(0);
    expect(screen.getAllByText('STUDENT').length).toBeGreaterThan(0);
  });

  it('filters users by role', () => {
    render(<AdminUsers users={mockUsers} />);
    const filterSelect = screen.getByRole('combobox');
    
    fireEvent.change(filterSelect, { target: { value: 'MENTOR' } });
    expect(screen.queryAllByText('Admin User')).toHaveLength(0);
    expect(screen.getAllByText('Mentor User').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('Student User')).toHaveLength(0);
  });

  it('searches users by name or email', () => {
    render(<AdminUsers users={mockUsers} />);
    const searchInput = screen.getByPlaceholderText('Cari nama atau email...');
    
    fireEvent.change(searchInput, { target: { value: 'student' } });
    expect(screen.getAllByText('Student User').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('Admin User')).toHaveLength(0);
  });

  it('handles delete action', async () => {
    render(<AdminUsers users={mockUsers} />);
    const deleteButtons = screen.getAllByTitle('Hapus User');
    fireEvent.click(deleteButtons[0]);
    fireEvent.click(screen.getAllByText('Hapus').at(-1)!);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/users', expect.objectContaining({
        method: 'DELETE',
      }));
    });
    await waitFor(() => {
      expect(screen.queryAllByText('Admin User')).toHaveLength(0);
    });
  });
});
