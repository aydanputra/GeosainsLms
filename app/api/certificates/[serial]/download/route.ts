
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { jsPDF } from 'jspdf';
import { verifyToken } from '@/modules/auth/utils/auth';
import QRCode from 'qrcode';
import { getCourseAggregates } from '@/utils/courseAggregates';
import { writeAccessDeniedAuditLog } from '@/utils/audit';

function safeParse(content: string | null | undefined) {
  if (!content) return {};
  try {
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

function parseHexColorToRgb(input: unknown, fallback: [number, number, number] = [79, 70, 229]) {
  if (typeof input !== 'string') return fallback;
  const raw = input.trim();
  const hex = raw.startsWith('#') ? raw.slice(1) : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return fallback;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return [r, g, b] as [number, number, number];
}

function getString(settings: Record<string, unknown>, key: string, fallback: string) {
  const v = settings[key];
  if (typeof v !== 'string') return fallback;
  const t = v.trim();
  return t ? t : fallback;
}

function getNumber(settings: Record<string, unknown>, key: string, fallback: number) {
  const v = settings[key];
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback;
  return v;
}

function resolvePdfFontFamily(input: unknown) {
  const raw = typeof input === 'string' ? input.toLowerCase() : '';
  if (!raw) return 'times';
  if (raw.includes('mono') || raw.includes('courier')) return 'courier';
  if (raw.includes('sans') || raw.includes('inter') || raw.includes('helvetica') || raw.includes('arial') || raw.includes('roboto')) {
    return 'helvetica';
  }
  return 'times';
}

function resolvePdfFontStyle(bold: unknown, italic: unknown) {
  const isBold = bold === true;
  const isItalic = italic === true;
  if (isBold && isItalic) return 'bolditalic';
  if (isBold) return 'bold';
  if (isItalic) return 'italic';
  return 'normal';
}

function formatDurationMinutes(totalMinutes: unknown) {
  const minutes = typeof totalMinutes === 'number' && Number.isFinite(totalMinutes) ? Math.max(0, Math.round(totalMinutes)) : 0;
  if (minutes <= 0) return '-';
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  if (hours <= 0) return `${minutes} menit`;
  if (restMinutes <= 0) return `${hours} jam`;
  return `${hours} jam ${restMinutes} menit`;
}

function toAbsoluteUrl(origin: string, url: string) {
  const t = url.trim();
  if (!t) return '';
  if (t.startsWith('data:')) return t;
  if (t.startsWith('http://') || t.startsWith('https://')) return t;
  if (t.startsWith('/')) return `${origin}${t}`;
  return `${origin}/${t}`;
}

function getPublicOrigin(req: NextRequest) {
  const appUrl = String(process.env.APP_URL || '').trim();
  if (appUrl) return appUrl.replace(/\/+$/, '');

  const forwardedProto = req.headers.get('x-forwarded-proto');
  const forwardedHost = req.headers.get('x-forwarded-host') || req.headers.get('host');
  if (forwardedHost) {
    const proto = forwardedProto || (req.nextUrl.protocol ? req.nextUrl.protocol.replace(':', '') : 'https');
    return `${proto}://${forwardedHost}`.replace(/\/+$/, '');
  }

  return req.nextUrl.origin.replace(/\/+$/, '');
}

async function fetchImageAsDataUrl(url: string, origin?: string) {
  const absoluteUrl = origin ? toAbsoluteUrl(origin, url) : url;
  const res = await fetch(absoluteUrl);
  if (!res.ok) throw new Error('Gagal memuat gambar');
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('svg')) {
    throw new Error('Format SVG belum didukung untuk generator PDF');
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  const base64 = buffer.toString('base64');
  const dataUrl = `data:${contentType || 'image/png'};base64,${base64}`;
  const format = contentType.includes('png')
    ? 'PNG'
    : contentType.includes('webp')
      ? 'WEBP'
      : 'JPEG';
  return { dataUrl, format };
}

async function loadOptionalImage(
  url: string,
  origin: string,
  label: string
): Promise<{ dataUrl: string; format: string } | null> {
  try {
    return await fetchImageAsDataUrl(url, origin);
  } catch (error) {
    console.error(`[certificate-download] Gagal memuat ${label}:`, error);
    return null;
  }
}

async function authorize(req: NextRequest, certificate: { userId: string; courseId: string; course: { instructorId: string } }) {
  const settingsPage = await prisma.page.findUnique({ where: { slug: '__course_settings__' }, select: { content: true } });
  const settings = safeParse(settingsPage?.content);
  const certificatesEnabled = settings['certificatesEnabled'] !== false;
  if (!certificatesEnabled) return { ok: false as const, status: 403 as const, error: 'Sertifikat dinonaktifkan', actor: null };

  const policy = settings['certificateDownloadPolicy'] === 'PUBLIC' ? 'PUBLIC' : 'OWNER_ONLY';
  if (policy === 'PUBLIC') return { ok: true as const, status: 200 as const };

  const token = req.cookies.get('token')?.value;
  if (!token) return { ok: false as const, status: 401 as const, error: 'Unauthorized', actor: null };
  const user = await verifyToken(token);
  if (!user) return { ok: false as const, status: 401 as const, error: 'Unauthorized', actor: null };

  if (user.role === 'ADMIN') return { ok: true as const, status: 200 as const };
  if (String(user.id) === certificate.userId) return { ok: true as const, status: 200 as const };
  if (user.role === 'MENTOR' && String(user.id) === certificate.course.instructorId) return { ok: true as const, status: 200 as const };

  if (user.role === 'MENTOR') {
    const isCoInstructor = Boolean(
      await prisma.courseCoInstructor.findUnique({
        where: { courseId_userId: { courseId: certificate.courseId, userId: String(user.id) } } as any,
        select: { id: true },
      })
    );
    if (isCoInstructor) return { ok: true as const, status: 200 as const };
  }

  return {
    ok: false as const,
    status: 403 as const,
    error: 'Forbidden',
    actor: { id: String(user.id), role: user.role },
  };
}

async function loadCertificate(serial: string) {
  const certificate = await prisma.certificate.findUnique({
    where: { serial },
    select: {
      serial: true,
      userId: true,
      issuedAt: true,
      user: { select: { name: true } },
      courseId: true,
      course: { select: { title: true, instructorId: true, totalDuration: true } },
    },
  });
  return certificate;
}

export async function HEAD(req: NextRequest, { params }: { params: Promise<{ serial: string }> }) {
  const { serial } = await params;
  const certificate = await loadCertificate(serial);
  if (!certificate) return NextResponse.json({ error: 'Certificate not found' }, { status: 404 });

  const auth = await authorize(req, { userId: certificate.userId, courseId: certificate.courseId, course: certificate.course });
  if (!auth.ok) {
    await writeAccessDeniedAuditLog({
      req,
      actor: auth.actor || null,
      action: 'CERTIFICATE_DOWNLOAD_DENIED',
      status: auth.status,
      entityType: 'Certificate',
      entityId: serial,
      reason: auth.error === 'Unauthorized' ? 'unauthorized' : auth.error === 'Sertifikat dinonaktifkan' ? 'disabled' : 'forbidden',
    });
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  return new NextResponse(null, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Certificate-${serial}.pdf"`,
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ serial: string }> }) {
  try {
    const { serial } = await params;
    const certificate = await loadCertificate(serial);
    const publicOrigin = getPublicOrigin(req);

    if (!certificate) {
      return NextResponse.json({ error: 'Certificate not found' }, { status: 404 });
    }

    const auth = await authorize(req, { userId: certificate.userId, courseId: certificate.courseId, course: certificate.course });
    if (!auth.ok) {
      await writeAccessDeniedAuditLog({
        req,
        actor: auth.actor || null,
        action: 'CERTIFICATE_DOWNLOAD_DENIED',
        status: auth.status,
        entityType: 'Certificate',
        entityId: serial,
        reason: auth.error === 'Unauthorized' ? 'unauthorized' : auth.error === 'Sertifikat dinonaktifkan' ? 'disabled' : 'forbidden',
      });
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const aggregates = await getCourseAggregates(prisma, certificate.courseId);

    const instructor = await prisma.user.findUnique({
      where: { id: certificate.course.instructorId },
      select: { signatureUrl: true, name: true } as any,
    });
    const instructorSignatureUrl =
      typeof (instructor as any)?.signatureUrl === 'string' ? String((instructor as any).signatureUrl).trim() : '';

    const settingsPage = await prisma.page.findUnique({ where: { slug: '__course_settings__' }, select: { content: true } });
    const globalSettings = safeParse(settingsPage?.content);

    const courseDesignPage = await prisma.page.findUnique({
      where: { slug: `__course_certificate__${certificate.courseId}` },
      select: { content: true },
    });
    const courseDesign = safeParse(courseDesignPage?.content);

    const settings = { ...globalSettings, ...courseDesign };
    const template = settings['certificateTemplate'] === 'CUSTOM' ? 'CUSTOM' : settings['certificateTemplate'] === 'MODERN' ? 'MODERN' : 'CLASSIC';
    const pageOrientation =
      template === 'CUSTOM' && settings['certificatePageOrientation'] === 'PORTRAIT' ? 'portrait' : 'landscape';
    const pageFormat =
      template === 'CUSTOM' && settings['certificatePageSize'] === 'LETTER' ? ('letter' as const) : ('a4' as const);
    const [accentR, accentG, accentB] = parseHexColorToRgb(settings['certificateAccentColor'], [79, 70, 229]);
    const titleText = getString(settings, 'certificateTitle', 'Sertifikat Penyelesaian');
    const subtitleText = getString(settings, 'certificateSubtitle', 'Dengan ini diberikan kepada');
    const bodyText = getString(settings, 'certificateBody', 'Telah menyelesaikan kursus');
    const issuerName = getString(settings, 'certificateIssuerName', 'GeoSains LMS');
    const signatoryName = getString(settings, 'certificateSignatoryName', '');
    const signatoryTitle = getString(settings, 'certificateSignatoryTitle', 'Instruktur');
    const showQr = settings['certificateShowQr'] !== false;
    const showSerial = settings['certificateShowSerial'] !== false;
    const showDate = settings['certificateShowDate'] !== false;

    const doc = new jsPDF({
      orientation: pageOrientation,
      unit: 'mm',
      format: pageFormat,
    });

    const dims =
      pageFormat === 'letter'
        ? {
            portrait: { w: 215.9, h: 279.4 },
            landscape: { w: 279.4, h: 215.9 },
          }
        : {
            portrait: { w: 210, h: 297 },
            landscape: { w: 297, h: 210 },
          };
    const pageWidth = pageOrientation === 'portrait' ? dims.portrait.w : dims.landscape.w;
    const pageHeight = pageOrientation === 'portrait' ? dims.portrait.h : dims.landscape.h;

    if (template === 'CUSTOM') {
      const backgroundUrl = typeof settings['certificateBackgroundImageUrl'] === 'string' ? settings['certificateBackgroundImageUrl'].trim() : '';
      if (backgroundUrl) {
        const bg = await loadOptionalImage(backgroundUrl, publicOrigin, 'background sertifikat');
        if (bg) {
          doc.addImage(bg.dataUrl, bg.format as any, 0, 0, pageWidth, pageHeight);
        } else {
          doc.setFillColor(255, 255, 255);
          doc.rect(0, 0, pageWidth, pageHeight, 'F');
        }
      } else {
        doc.setFillColor(255, 255, 255);
        doc.rect(0, 0, pageWidth, pageHeight, 'F');
      }

      const elements = Array.isArray(settings['elements']) ? settings['elements'] as any[] : [];
      const sortedElements = [...elements].sort((a, b) => Number(a?.zIndex || 0) - Number(b?.zIndex || 0));
      const bundleNames = await prisma.courseBundle.findMany({
        where: { published: true, courseIds: { has: certificate.courseId } },
        select: { name: true },
        orderBy: { updatedAt: 'desc' },
        take: 5,
      });
      const dynamicTextMap: Record<string, string> = {
        NAME: certificate.user.name || 'Peserta',
        COURSE: certificate.course.title,
        INSTRUCTOR: (instructor as any)?.name || 'Instruktur',
        SERIAL: certificate.serial,
        DATE: certificate.issuedAt.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
        DURATION: formatDurationMinutes(aggregates.totalDuration),
        POINT: '-',
        GRADE: '-',
        BUNDLE: bundleNames.map((row) => row.name).filter(Boolean).join(', ') || '-',
      };

      if (sortedElements.length > 0) {
        for (const el of sortedElements) {
          const x = Number(el?.x ?? 0);
          const y = Number(el?.y ?? 0);
          const width = Math.max(1, Number(el?.width ?? 1));
          const height = Math.max(1, Number(el?.height ?? 1));
          const fontSize = Number(el?.fontSize ?? 16);
          const color = parseHexColorToRgb(el?.color, [0, 0, 0]);
          const fontFamily = resolvePdfFontFamily(el?.fontFamily);
          const fontStyle = resolvePdfFontStyle(el?.bold, el?.italic);
          const textAlign = el?.align === 'left' ? 'left' : el?.align === 'right' ? 'right' : 'center';
          const textX = textAlign === 'left' ? x : textAlign === 'right' ? x + width : x + width / 2;
          const textY = y + height / 2;

          doc.setTextColor(color[0], color[1], color[2]);
          doc.setFont(fontFamily, fontStyle as any);
          doc.setFontSize(fontSize);

          let text = '';
          switch (el.type) {
            case 'TEXT': text = el.content || ''; break;
            case 'NAME':
            case 'COURSE':
            case 'INSTRUCTOR':
            case 'SERIAL':
            case 'DATE':
            case 'DURATION':
            case 'POINT':
            case 'GRADE':
            case 'BUNDLE':
              text = dynamicTextMap[String(el.type)] || '';
              break;
            case 'QR':
              const verifyUrl = `${publicOrigin}/certificate/verify/${certificate.serial}`;
              const qrColor = typeof el.qrColor === 'string' && el.qrColor.trim() ? el.qrColor.trim() : '#000000';
              const qrBgColor = typeof el.qrBgColor === 'string' && el.qrBgColor.trim() ? el.qrBgColor.trim() : '#FFFFFF';
              const qrBgRadius = typeof el.qrBgRadius === 'number' && Number.isFinite(el.qrBgRadius) ? Math.max(0, el.qrBgRadius) : 6;
              const qrPadding = typeof el.qrPadding === 'number' && Number.isFinite(el.qrPadding) ? Math.max(0, el.qrPadding) : 2;
              const w = width || 30;
              const h = height || 30;
              const [bgR, bgG, bgB] = parseHexColorToRgb(qrBgColor, [255, 255, 255]);
              doc.setFillColor(bgR, bgG, bgB);
              try {
                (doc as any).roundedRect(x, y, w, h, Math.min(qrBgRadius, Math.min(w, h) / 2), Math.min(qrBgRadius, Math.min(w, h) / 2), 'F');
              } catch {
                doc.rect(x, y, w, h, 'F');
              }

              const innerW = Math.max(1, w - 2 * qrPadding);
              const innerH = Math.max(1, h - 2 * qrPadding);
              const size = Math.min(innerW, innerH);
              const ix = x + (w - size) / 2;
              const iy = y + (h - size) / 2;
              const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
                margin: 0,
                scale: 8,
                color: { dark: qrColor, light: '#0000' },
              });
              doc.addImage(qrDataUrl, 'PNG', ix, iy, size, size);
              continue;
            case 'IMAGE':
              const imageUrl = typeof el.src === 'string' ? el.src : typeof el.url === 'string' ? el.url : '';
              if (imageUrl) {
                const img = await loadOptionalImage(imageUrl, publicOrigin, `elemen gambar ${el.id || 'custom'}`);
                if (img) doc.addImage(img.dataUrl, img.format as any, x, y, width || 80, height || 60);
              }
              continue;
            case 'SIGNATURE':
              if (instructorSignatureUrl) {
                const sig = await loadOptionalImage(instructorSignatureUrl, publicOrigin, 'tanda tangan instruktur');
                if (sig) {
                  doc.addImage(sig.dataUrl, sig.format as any, x, y, width || 40, height || 20);
                } else {
                  doc.setLineWidth(0.5);
                  doc.line(x, y + height / 2, x + (width || 40), y + height / 2);
                }
              } else {
                doc.setLineWidth(0.5);
                doc.line(x, y + height / 2, x + (width || 40), y + height / 2);
              }
              continue;
            default: text = `[ ${el.type} ]`;
          }

          if (text) {
            doc.text(text, textX, textY, {
              align: textAlign,
              baseline: 'middle',
              maxWidth: width,
            });
          }
        }
      } else {
        const logoUrl = typeof settings['certificateLogoUrl'] === 'string' ? settings['certificateLogoUrl'].trim() : '';
        if (logoUrl) {
          const logo = await loadOptionalImage(logoUrl, publicOrigin, 'logo sertifikat');
          if (logo) {
            const x = getNumber(settings, 'certificateLogoX', 22);
            const y = getNumber(settings, 'certificateLogoY', 22);
            const w = getNumber(settings, 'certificateLogoW', 30);
            const h = getNumber(settings, 'certificateLogoH', 30);
            doc.addImage(logo.dataUrl, logo.format as any, x, y, w, h);
          }
        }

        const nameX = getNumber(settings, 'certificateNameX', pageWidth / 2);
        const nameY = getNumber(settings, 'certificateNameY', pageHeight * 0.45);
        const nameFont = getNumber(settings, 'certificateNameFontSize', 32);
        const [nameR, nameG, nameB] = parseHexColorToRgb(settings['certificateNameColor'], [accentR, accentG, accentB]);
        const nameFontFamily = getString(settings, 'certificateNameFontFamily', 'serif');

        const courseX = getNumber(settings, 'certificateCourseX', pageWidth / 2);
        const courseY = getNumber(settings, 'certificateCourseY', pageHeight * 0.62);
        const courseFont = getNumber(settings, 'certificateCourseFontSize', 24);
        const [courseR, courseG, courseB] = parseHexColorToRgb(settings['certificateCourseColor'], [30, 41, 59]);

        const extraText = getString(settings, 'certificateExtraText', '');
        const extraX = getNumber(settings, 'certificateExtraTextX', pageWidth / 2);
        const extraY = getNumber(settings, 'certificateExtraTextY', pageHeight * 0.33);
        const extraFont = getNumber(settings, 'certificateExtraTextFontSize', 16);
        const extraBold = settings['certificateExtraTextBold'] === true;
        const [extraR, extraG, extraB] = parseHexColorToRgb(settings['certificateExtraTextColor'], [100, 116, 133]);

        const metaFont = getNumber(settings, 'certificateMetaFontSize', 12);
        const dateX = getNumber(settings, 'certificateDateX', pageWidth / 2);
        const dateY = getNumber(settings, 'certificateDateY', pageHeight * 0.76);
        const serialX = getNumber(settings, 'certificateSerialX', pageWidth / 2);
        const serialY = getNumber(settings, 'certificateSerialY', pageHeight * 0.81);

        const signatureX = getNumber(settings, 'certificateSignatureX', pageWidth * 0.35);
        const signatureY = getNumber(settings, 'certificateSignatureY', pageHeight * 0.88);
        const signatureW = getNumber(settings, 'certificateSignatureW', 97);
        if (instructorSignatureUrl) {
          const sig = await loadOptionalImage(instructorSignatureUrl, publicOrigin, 'tanda tangan instruktur');
          if (sig) doc.addImage(sig.dataUrl, sig.format as any, signatureX, signatureY - 18, signatureW, 18);
        }

        if (extraText) {
          doc.setFont('helvetica', extraBold ? 'bold' : 'normal');
          doc.setFontSize(extraFont);
          doc.setTextColor(extraR, extraG, extraB);
          doc.text(extraText, extraX, extraY, { align: 'center', baseline: 'middle' });
        }

        const jspdfFont = nameFontFamily === 'sans-serif' ? 'helvetica' : nameFontFamily === 'monospace' ? 'courier' : 'times';
        doc.setFont(jspdfFont, 'bold');
        doc.setFontSize(nameFont);
        doc.setTextColor(nameR, nameG, nameB);
        doc.text(certificate.user.name || 'Peserta', nameX, nameY, { align: 'center', baseline: 'middle' });

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(courseFont);
        doc.setTextColor(courseR, courseG, courseB);
        doc.text(certificate.course.title, courseX, courseY, { align: 'center', baseline: 'middle' });

        const dateStr = certificate.issuedAt.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(metaFont);
        doc.setTextColor(100, 116, 133);
        if (showDate) doc.text(`Diterbitkan: ${dateStr}`, dateX, dateY, { align: 'center', baseline: 'middle' });
        if (showSerial) doc.text(`No. Seri: ${certificate.serial}`, serialX, serialY, { align: 'center', baseline: 'middle' });

        doc.setLineWidth(0.5);
        doc.setDrawColor(30, 41, 59);
        doc.line(signatureX, signatureY, signatureX + signatureW, signatureY);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(Math.max(10, metaFont));
        doc.setTextColor(30, 41, 59);
        doc.text(signatoryName || 'Instruktur', signatureX + signatureW / 2, signatureY + 7, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(Math.max(9, metaFont - 2));
        doc.setTextColor(100, 116, 133);
        doc.text(signatoryTitle, signatureX + signatureW / 2, signatureY + 12, { align: 'center' });

        if (showQr) {
          const qrX = getNumber(settings, 'certificateQrX', 22);
          const qrY = getNumber(settings, 'certificateQrY', pageHeight - 50);
          const qrSize = getNumber(settings, 'certificateQrSize', 28);
          const verifyUrl = `${publicOrigin}/certificate/verify/${certificate.serial}`;
          const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 0, scale: 8 });
          doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
        }
      }

      const pdfBuffer = doc.output('arraybuffer');
      return new NextResponse(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="Certificate-${serial}.pdf"`,
          'Cache-Control': 'private, no-store',
          'X-Robots-Tag': 'noindex, nofollow',
        },
      });
    }

    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    if (template === 'CLASSIC') {
      doc.setFillColor(250, 250, 255);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');

      doc.setLineWidth(2);
      doc.setDrawColor(accentR, accentG, accentB);
      doc.rect(10, 10, 277, 190);
    } else {
      doc.setFillColor(accentR, accentG, accentB);
      doc.rect(0, 0, 12, pageHeight, 'F');

      doc.setLineWidth(0.8);
      doc.setDrawColor(226, 232, 240);
      doc.rect(12, 12, 273, 186);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(template === 'MODERN' ? 34 : 36);
    doc.setTextColor(template === 'MODERN' ? accentR : 30, template === 'MODERN' ? accentG : 41, template === 'MODERN' ? accentB : 59);
    doc.text(titleText, 148.5, 50, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(16);
    doc.setTextColor(100, 116, 133);
    doc.text(subtitleText, 148.5, 70, { align: 'center' });

    doc.setFont('times', 'bolditalic');
    doc.setFontSize(32);
    doc.setTextColor(accentR, accentG, accentB);
    doc.text(certificate.user.name || 'Student', 148.5, 90, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(16);
    doc.setTextColor(100, 116, 133);
    doc.text(bodyText, 148.5, 110, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);
    doc.setTextColor(30, 41, 59);
    doc.text(certificate.course.title, 148.5, 130, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(100, 116, 133);
    doc.text(issuerName, 148.5, 26, { align: 'center' });

    const dateStr = certificate.issuedAt.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(100, 116, 133);
    if (showDate) doc.text(`Diterbitkan: ${dateStr}`, 148.5, 160, { align: 'center' });
    if (showSerial) doc.text(`No. Seri: ${certificate.serial}`, 148.5, 170, { align: 'center' });

    doc.setLineWidth(0.5);
    doc.setDrawColor(30, 41, 59);
    doc.line(100, 185, 197, 185);
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text(signatoryName || 'Instruktur', 148.5, 192, { align: 'center' });
    doc.setTextColor(100, 116, 133);
    doc.text(signatoryTitle, 148.5, 197, { align: 'center' });

    if (showQr) {
      const verifyUrl = `${publicOrigin}/certificate/verify/${certificate.serial}`;
      const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 0, scale: 8 });
      doc.addImage(qrDataUrl, 'PNG', 22, 160, 28, 28);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 133);
      doc.text('Verifikasi', 36, 194, { align: 'center' });
    }

    const pdfBuffer = doc.output('arraybuffer');

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Certificate-${serial}.pdf"`,
        'Cache-Control': 'private, no-store',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  } catch (error) {
    console.error('[certificate-download] GET failed:', error);
    return NextResponse.json({ error: 'Gagal membuat sertifikat PDF' }, { status: 500 });
  }
}
