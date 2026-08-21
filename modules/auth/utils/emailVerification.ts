import { prisma } from '@/utils/prisma';
import { generateOpaqueToken, sha256Hex } from './security';
import { sendVerificationEmail } from '@/utils/email-notifications';

type IssueVerificationEmailInput = {
  userId: string;
  email: string;
  origin: string;
  name?: string | null;
};

export async function issueVerificationEmail(input: IssueVerificationEmailInput) {
  const rawToken = generateOpaqueToken(32);
  const tokenHash = sha256Hex(rawToken);

  await prisma.$transaction(async (tx: any) => {
    await tx.emailVerificationToken.deleteMany({
      where: { userId: input.userId, usedAt: null },
    });
    await tx.emailVerificationToken.create({
      data: {
        userId: input.userId,
        tokenHash,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
  });

  const verifyUrl = `${String(input.origin || '').replace(/\/+$/, '')}/verify-email?token=${encodeURIComponent(rawToken)}`;

  await sendVerificationEmail({
    to: input.email,
    verifyUrl,
    name: input.name,
  });

  return { verifyUrl };
}
