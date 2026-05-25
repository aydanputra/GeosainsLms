import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }

function resolveDatabaseUrl() {
  const fromDatabaseUrl = (process.env.DATABASE_URL || '').trim()
  const fromDirectUrl = (process.env.DIRECT_URL || '').trim()

  const looksLikePrismaProxy = (v: string) => v.startsWith('prisma://') || v.startsWith('prisma+postgres://')
  const looksLikePostgres = (v: string) => v.startsWith('postgresql://') || v.startsWith('postgres://')

  if (looksLikePrismaProxy(fromDatabaseUrl) || looksLikePostgres(fromDatabaseUrl)) return fromDatabaseUrl
  if (looksLikePostgres(fromDirectUrl)) return fromDirectUrl

  if (!fromDatabaseUrl && !fromDirectUrl) {
    throw new Error('DATABASE_URL belum di-set. Pastikan file .env sudah ada dan benar.')
  }

  throw new Error(
    'DATABASE_URL tidak valid. Gunakan postgresql:// (lokal) atau prisma:// / prisma+postgres:// (Prisma Accelerate). ' +
      'Jika memakai Accelerate, set DIRECT_URL ke postgresql:// untuk koneksi langsung.'
  )
}

const databaseUrl = resolveDatabaseUrl()

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  })

globalForPrisma.prisma = prisma
