import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerUser, loginUser } from '../api/service';
import { prisma } from '@/utils/prisma';
import { hashPassword, verifyPassword } from '../utils/auth';

// Mock dependencies
vi.mock('@/utils/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock('../utils/auth', () => ({
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
  createToken: vi.fn(() => 'mock-token'),
}));

describe('Auth Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('registerUser', () => {
    it('should register a new user successfully', async () => {
      const mockUser = {
        id: '1',
        name: 'Test User',
        email: 'test@example.com',
        password: 'hashed-password',
        role: 'STUDENT',
      };

      (prisma.user.findUnique as any).mockResolvedValue(null);
      (hashPassword as any).mockResolvedValue('hashed-password');
      (prisma.user.create as any).mockResolvedValue(mockUser);

      const result = await registerUser({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      });

      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: 'test@example.com' } });
      expect(hashPassword).toHaveBeenCalledWith('password123');
      expect(prisma.user.create).toHaveBeenCalled();
      expect(result).toEqual({
        id: '1',
        name: 'Test User',
        email: 'test@example.com',
        role: 'STUDENT',
      });
    });

    it('should throw error if user already exists', async () => {
      (prisma.user.findUnique as any).mockResolvedValue({ id: '1', email: 'test@example.com' });

      await expect(registerUser({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      })).rejects.toThrow('User already exists');
    });
  });

  describe('loginUser', () => {
    it('should login user successfully', async () => {
      const mockUser = {
        id: '1',
        name: 'Test User',
        email: 'test@example.com',
        password: 'hashed-password',
        role: 'STUDENT',
      };

      (prisma.user.findUnique as any).mockResolvedValue(mockUser);
      (verifyPassword as any).mockResolvedValue(true);

      const result = await loginUser({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: 'test@example.com' } });
      expect(verifyPassword).toHaveBeenCalledWith('password123', 'hashed-password');
      expect(result).toHaveProperty('token');
      expect(result.user).toEqual({
        id: '1',
        name: 'Test User',
        email: 'test@example.com',
        role: 'STUDENT',
      });
    });

    it('should throw error for invalid credentials', async () => {
      (prisma.user.findUnique as any).mockResolvedValue(null);

      await expect(loginUser({
        email: 'wrong@example.com',
        password: 'password123',
      })).rejects.toThrow('Invalid credentials');
    });
  });
});
