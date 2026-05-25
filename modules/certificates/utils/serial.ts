
import { prisma } from '@/utils/prisma';

/**
 * Generates a unique certificate serial number.
 * Format: CERT-YYYYMMDD-XXXXXX
 * XXXXXX is a random 6-character alphanumeric string.
 */
export async function generateUniqueSerial(): Promise<string> {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const datePrefix = `CERT-${year}${month}${day}`;

  let serial = '';
  let isUnique = false;
  let attempts = 0;

  while (!isUnique && attempts < 10) {
    const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    serial = `${datePrefix}-${randomSuffix}`;

    const existing = await prisma.certificate.findUnique({
      where: { serial },
      select: { id: true }
    });

    if (!existing) {
      isUnique = true;
    }
    attempts++;
  }

  if (!isUnique) {
    throw new Error('Failed to generate unique certificate serial after multiple attempts.');
  }

  return serial;
}
