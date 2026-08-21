import { sendEmail } from './email';

type ActivityEmailInput = {
  to: string;
  subject: string;
  title: string;
  intro: string;
  lines: string[];
  actionLabel?: string;
  actionUrl?: string;
};

type VerificationEmailInput = {
  to: string;
  verifyUrl: string;
  name?: string | null;
};

type OrderEmailInput = {
  to: string;
  name?: string | null;
  orderId: string;
  total: number;
  actionUrl?: string;
};

type ManualPaymentReviewEmailInput = OrderEmailInput & {
  approved: boolean;
  note?: string | null;
};

type ShipmentEmailInput = {
  to: string;
  name?: string | null;
  orderId: string;
  courier: string;
  trackingNumber: string;
  actionUrl?: string;
};

type StatusEmailInput = {
  to: string;
  name?: string | null;
  title: string;
  itemName: string;
  orderId?: string | null;
  note?: string | null;
  actionUrl?: string;
};

function escapeHtml(value: string) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatIdr(value: number) {
  return `IDR ${Number(value || 0).toLocaleString('id-ID')}`;
}

function greet(name?: string | null) {
  const raw = String(name || '').trim();
  return raw || 'Siswa';
}

async function sendActivityEmail(input: ActivityEmailInput) {
  const lines = input.lines.filter(Boolean);
  const htmlLines = lines.map((line) => `<li style="margin:0 0 8px;">${escapeHtml(line)}</li>`).join('');
  const actionHtml =
    input.actionLabel && input.actionUrl
      ? `<p style="margin:24px 0 0;"><a href="${escapeHtml(input.actionUrl)}" style="display:inline-block;padding:12px 18px;border-radius:12px;background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:700;">${escapeHtml(input.actionLabel)}</a></p>`
      : '';

  return sendEmail({
    to: input.to,
    subject: input.subject,
    text: [
      input.title,
      '',
      input.intro,
      '',
      ...lines.map((line) => `- ${line}`),
      input.actionLabel && input.actionUrl ? '' : null,
      input.actionLabel && input.actionUrl ? `${input.actionLabel}: ${input.actionUrl}` : null,
    ]
      .filter(Boolean)
      .join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#0f172a;">
        <div style="border:1px solid #e2e8f0;border-radius:20px;padding:24px;background:#ffffff;">
          <div style="font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#6366f1;">Geosains LMS</div>
          <h1 style="margin:12px 0 8px;font-size:24px;line-height:1.3;">${escapeHtml(input.title)}</h1>
          <p style="margin:0 0 16px;color:#475569;line-height:1.7;">${escapeHtml(input.intro)}</p>
          <ul style="padding-left:18px;margin:0;color:#0f172a;line-height:1.7;">
            ${htmlLines}
          </ul>
          ${actionHtml}
        </div>
      </div>
    `,
  });
}

export async function sendVerificationEmail(input: VerificationEmailInput) {
  const recipientName = greet(input.name);
  return sendActivityEmail({
    to: input.to,
    subject: 'Verifikasi Email - Geosains LMS',
    title: 'Verifikasi email Anda',
    intro: `Halo ${recipientName}, silakan verifikasi email Anda untuk mengaktifkan akun Geosains LMS.`,
    lines: [
      'Klik tombol verifikasi untuk menyelesaikan aktivasi akun.',
      'Jika Anda tidak merasa membuat akun ini, Anda dapat mengabaikan email ini.',
    ],
    actionLabel: 'Verifikasi Email',
    actionUrl: input.verifyUrl,
  });
}

export async function sendStudentOrderCreatedEmail(input: OrderEmailInput & { paymentUrl?: string | null; manualPayment?: boolean }) {
  return sendActivityEmail({
    to: input.to,
    subject: input.manualPayment ? 'Pesanan Dibuat - Menunggu Pembayaran' : 'Pembayaran Siap Dilanjutkan',
    title: input.manualPayment ? 'Pesanan berhasil dibuat' : 'Pembayaran Anda siap dilanjutkan',
    intro: `Halo ${greet(input.name)}, pesanan Anda sudah tercatat di sistem.`,
    lines: [
      `Order: ${input.orderId}`,
      `Total: ${formatIdr(input.total)}`,
      input.manualPayment ? 'Silakan lakukan pembayaran manual lalu unggah bukti transfer dari dashboard.' : 'Silakan lanjutkan ke halaman pembayaran untuk menyelesaikan transaksi.',
    ],
    actionLabel: input.manualPayment ? 'Buka Detail Order' : 'Lanjut Pembayaran',
    actionUrl: input.paymentUrl || input.actionUrl,
  });
}

export async function sendStudentPaymentConfirmedEmail(input: OrderEmailInput) {
  return sendActivityEmail({
    to: input.to,
    subject: 'Pembayaran Berhasil - Geosains LMS',
    title: 'Pembayaran berhasil dikonfirmasi',
    intro: `Halo ${greet(input.name)}, pembayaran Anda sudah diterima dan akses pembelajaran telah diaktifkan.`,
    lines: [
      `Order: ${input.orderId}`,
      `Total: ${formatIdr(input.total)}`,
      'Silakan buka dashboard siswa untuk mulai belajar atau melihat detail pesanan Anda.',
    ],
    actionLabel: 'Buka Dashboard Siswa',
    actionUrl: input.actionUrl,
  });
}

export async function sendStudentPaymentFailedEmail(input: OrderEmailInput) {
  return sendActivityEmail({
    to: input.to,
    subject: 'Pembayaran Gagal - Geosains LMS',
    title: 'Pembayaran belum berhasil',
    intro: `Halo ${greet(input.name)}, kami belum dapat menyelesaikan pembayaran Anda.`,
    lines: [
      `Order: ${input.orderId}`,
      `Total: ${formatIdr(input.total)}`,
      'Silakan cek kembali metode pembayaran Anda atau ulangi dari halaman pesanan.',
    ],
    actionLabel: 'Buka Detail Order',
    actionUrl: input.actionUrl,
  });
}

export async function sendStudentManualPaymentReviewEmail(input: ManualPaymentReviewEmailInput) {
  return sendActivityEmail({
    to: input.to,
    subject: input.approved ? 'Pembayaran Dikonfirmasi - Geosains LMS' : 'Pembayaran Ditolak - Geosains LMS',
    title: input.approved ? 'Pembayaran Anda telah dikonfirmasi' : 'Pembayaran Anda ditolak',
    intro: `Halo ${greet(input.name)}, status verifikasi pembayaran manual Anda telah diperbarui.`,
    lines: [
      `Order: ${input.orderId}`,
      `Total: ${formatIdr(input.total)}`,
      input.note ? `Catatan admin: ${input.note}` : input.approved ? 'Akses order sudah aktif.' : 'Silakan cek kembali instruksi pembayaran lalu unggah bukti yang benar.',
    ],
    actionLabel: 'Buka Detail Order',
    actionUrl: input.actionUrl,
  });
}

export async function sendStudentOrderShippedEmail(input: ShipmentEmailInput) {
  return sendActivityEmail({
    to: input.to,
    subject: 'Pesanan Dikirim - Geosains LMS',
    title: 'Pesanan Anda sedang dikirim',
    intro: `Halo ${greet(input.name)}, pesanan fisik Anda telah dikirim.`,
    lines: [
      `Order: ${input.orderId}`,
      `Kurir: ${input.courier}`,
      `Nomor resi: ${input.trackingNumber}`,
    ],
    actionLabel: 'Lihat Detail Order',
    actionUrl: input.actionUrl,
  });
}

export async function sendStudentStatusUpdateEmail(input: StatusEmailInput) {
  return sendActivityEmail({
    to: input.to,
    subject: `${input.title} - Geosains LMS`,
    title: input.title,
    intro: `Halo ${greet(input.name)}, ada pembaruan penting pada aktivitas Anda.`,
    lines: [
      `Item: ${input.itemName}`,
      input.orderId ? `Order: ${input.orderId}` : '',
      input.note ? `Catatan: ${input.note}` : '',
    ].filter(Boolean),
    actionLabel: input.actionUrl ? 'Lihat Detail' : undefined,
    actionUrl: input.actionUrl,
  });
}
