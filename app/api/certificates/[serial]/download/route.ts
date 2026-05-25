
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { jsPDF } from 'jspdf';
import { verifyToken } from '@/modules/auth/utils/auth';
import QRCode from 'qrcode';

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

function toAbsoluteUrl(origin: string, url: string) {
  const t = url.trim();
  if (!t) return '';
  if (t.startsWith('data:')) return t;
  if (t.startsWith('http://') || t.startsWith('https://')) return t;
  if (t.startsWith('/')) return `${origin}${t}`;
  return `${origin}/${t}`;
}

async function fetchImageAsDataUrl(url: string, origin?: string) {
  const absoluteUrl = origin ? toAbsoluteUrl(origin, url) : url;
  const res = await fetch(absoluteUrl);
  if (!res.ok) throw new Error('Gagal memuat gambar');
  const contentType = res.headers.get('content-type') || '';
  const buffer = Buffer.from(await res.arrayBuffer());
  const base64 = buffer.toString('base64');
  const dataUrl = `data:${contentType || 'image/png'};base64,${base64}`;
  const format = contentType.includes('png') ? 'PNG' : 'JPEG';
  return { dataUrl, format };
}

async function authorize(req: NextRequest, certificate: { userId: string; courseId: string; course: { instructorId: string } }) {
  const settingsPage = await prisma.page.findUnique({ where: { slug: '__course_settings__' }, select: { content: true } });
  const settings = safeParse(settingsPage?.content);
  const certificatesEnabled = settings['certificatesEnabled'] !== false;
  if (!certificatesEnabled) return { ok: false as const, status: 403 as const, error: 'Sertifikat dinonaktifkan' };

  const policy = settings['certificateDownloadPolicy'] === 'PUBLIC' ? 'PUBLIC' : 'OWNER_ONLY';
  if (policy === 'PUBLIC') return { ok: true as const, status: 200 as const };

  const token = req.cookies.get('token')?.value;
  if (!token) return { ok: false as const, status: 401 as const, error: 'Unauthorized' };
  const user = await verifyToken(token);
  if (!user) return { ok: false as const, status: 401 as const, error: 'Unauthorized' };

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

  return { ok: false as const, status: 403 as const, error: 'Forbidden' };
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
      course: { select: { title: true, instructorId: true } },
    },
  });
  return certificate;
}

export async function HEAD(req: NextRequest, { params }: { params: Promise<{ serial: string }> }) {
  const { serial } = await params;
  const certificate = await loadCertificate(serial);
  if (!certificate) return NextResponse.json({ error: 'Certificate not found' }, { status: 404 });

  const auth = await authorize(req, { userId: certificate.userId, courseId: certificate.courseId, course: certificate.course });
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  return new NextResponse(null, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Certificate-${serial}.pdf"`,
    },
  });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ serial: string }> }) {
  const { serial } = await params;
  const certificate = await loadCertificate(serial);

  if (!certificate) {
    return NextResponse.json({ error: 'Certificate not found' }, { status: 404 });
  }

  const auth = await authorize(req, { userId: certificate.userId, courseId: certificate.courseId, course: certificate.course });
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

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

  // Create PDF
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
      const bg = await fetchImageAsDataUrl(backgroundUrl, req.nextUrl.origin);
      doc.addImage(bg.dataUrl, bg.format as any, 0, 0, pageWidth, pageHeight);
    } else {
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');
    }

    const elements = Array.isArray(settings['elements']) ? settings['elements'] as any[] : [];
    
    if (elements.length > 0) {
      for (const el of elements) {
        const x = el.x ?? 0;
        const y = el.y ?? 0;
        const fontSize = el.fontSize ?? 16;
        const color = parseHexColorToRgb(el.color, [0, 0, 0]);
        const fontFamily = el.fontFamily === 'sans-serif' ? 'helvetica' : el.fontFamily === 'monospace' ? 'courier' : 'times';
        
        doc.setTextColor(color[0], color[1], color[2]);
        doc.setFont(fontFamily, el.bold ? 'bold' : 'normal');
        doc.setFontSize(fontSize);

        let text = '';
        switch (el.type) {
          case 'TEXT': text = el.content || ''; break;
          case 'NAME': text = certificate.user.name || 'Peserta'; break;
          case 'COURSE': text = certificate.course.title; break;
          case 'SERIAL': text = certificate.serial; break;
          case 'DATE': text = certificate.issuedAt.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }); break;
          case 'QR':
            const verifyUrl = `${req.nextUrl.origin}/certificate/verify/${certificate.serial}`;
            const qrColor = typeof el.qrColor === 'string' && el.qrColor.trim() ? el.qrColor.trim() : '#000000';
            const qrBgColor = typeof el.qrBgColor === 'string' && el.qrBgColor.trim() ? el.qrBgColor.trim() : '#FFFFFF';
            const qrBgRadius = typeof el.qrBgRadius === 'number' && Number.isFinite(el.qrBgRadius) ? Math.max(0, el.qrBgRadius) : 6;
            const qrPadding = typeof el.qrPadding === 'number' && Number.isFinite(el.qrPadding) ? Math.max(0, el.qrPadding) : 2;
            const w = el.width || 30;
            const h = el.height || 30;
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
              const img = await fetchImageAsDataUrl(imageUrl, req.nextUrl.origin);
              doc.addImage(img.dataUrl, img.format as any, x, y, el.width || 80, el.height || 60);
            }
            continue;
          case 'SIGNATURE':
            if (instructorSignatureUrl) {
              const sig = await fetchImageAsDataUrl(instructorSignatureUrl, req.nextUrl.origin);
              doc.addImage(sig.dataUrl, sig.format as any, x, y, el.width || 40, el.height || 20);
            } else {
              doc.setLineWidth(0.5);
              doc.line(x, y, x + (el.width || 40), y);
            }
            continue;
          default: text = `[ ${el.type} ]`;
        }

        if (text) {
          doc.text(text, x, y, { align: el.align || 'left', baseline: 'middle' });
        }
      }
    } else {
      // Fallback to old individual properties if no elements array
      const logoUrl = typeof settings['certificateLogoUrl'] === 'string' ? settings['certificateLogoUrl'].trim() : '';
      if (logoUrl) {
        const logo = await fetchImageAsDataUrl(logoUrl, req.nextUrl.origin);
        const x = getNumber(settings, 'certificateLogoX', 22);
        const y = getNumber(settings, 'certificateLogoY', 22);
        const w = getNumber(settings, 'certificateLogoW', 30);
        const h = getNumber(settings, 'certificateLogoH', 30);
        doc.addImage(logo.dataUrl, logo.format as any, x, y, w, h);
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
        const sig = await fetchImageAsDataUrl(instructorSignatureUrl, req.nextUrl.origin);
        doc.addImage(sig.dataUrl, sig.format as any, signatureX, signatureY - 18, signatureW, 18);
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
        const verifyUrl = `${req.nextUrl.origin}/certificate/verify/${certificate.serial}`;
        const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 0, scale: 8 });
        doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
      }
    }

    const pdfBuffer = doc.output('arraybuffer');
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Certificate-${serial}.pdf"`,
      },
    });
  }

  // Background
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

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(template === 'MODERN' ? 34 : 36);
  doc.setTextColor(template === 'MODERN' ? accentR : 30, template === 'MODERN' ? accentG : 41, template === 'MODERN' ? accentB : 59);
  doc.text(titleText, 148.5, 50, { align: 'center' });

  // Subheader
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(16);
  doc.setTextColor(100, 116, 133); // Slate 500
  doc.text(subtitleText, 148.5, 70, { align: 'center' });

  // Student Name
  doc.setFont('times', 'bolditalic');
  doc.setFontSize(32);
  doc.setTextColor(accentR, accentG, accentB);
  doc.text(certificate.user.name || 'Student', 148.5, 90, { align: 'center' });

  // Course Text
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(16);
  doc.setTextColor(100, 116, 133);
  doc.text(bodyText, 148.5, 110, { align: 'center' });

  // Course Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(30, 41, 59);
  doc.text(certificate.course.title, 148.5, 130, { align: 'center' });

  // Issuer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(100, 116, 133);
  doc.text(issuerName, 148.5, 26, { align: 'center' });

  // Date & Serial
  const dateStr = certificate.issuedAt.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(100, 116, 133);
  if (showDate) doc.text(`Diterbitkan: ${dateStr}`, 148.5, 160, { align: 'center' });
  if (showSerial) doc.text(`No. Seri: ${certificate.serial}`, 148.5, 170, { align: 'center' });

  // Signature Line (Mock)
  doc.setLineWidth(0.5);
  doc.setDrawColor(30, 41, 59);
  doc.line(100, 185, 197, 185);
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text(signatoryName || 'Instruktur', 148.5, 192, { align: 'center' });
  doc.setTextColor(100, 116, 133);
  doc.text(signatoryTitle, 148.5, 197, { align: 'center' });

  if (showQr) {
    const verifyUrl = `${req.nextUrl.origin}/certificate/verify/${certificate.serial}`;
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 0, scale: 8 });
    doc.addImage(qrDataUrl, 'PNG', 22, 160, 28, 28);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 133);
    doc.text('Verifikasi', 36, 194, { align: 'center' });
  }

  // Output as buffer
  const pdfBuffer = doc.output('arraybuffer');

  return new NextResponse(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Certificate-${serial}.pdf"`,
    },
  });
}
