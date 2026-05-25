type SendEmailInput = {
  to: string;
  subject: string;
  text?: string;
  html?: string;
};

function getEnv(name: string) {
  const v = process.env[name];
  return typeof v === 'string' ? v.trim() : '';
}

export async function sendEmail(input: SendEmailInput) {
  const provider = getEnv('EMAIL_PROVIDER').toLowerCase() || 'log';
  const to = (input.to || '').trim();
  if (!to) return { ok: false as const };

  if (provider === 'resend') {
    const apiKey = getEnv('RESEND_API_KEY');
    const from = getEnv('EMAIL_FROM') || 'no-reply@localhost';
    if (!apiKey) return { ok: false as const };

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: input.subject,
        ...(typeof input.html === 'string' && input.html.trim() ? { html: input.html } : {}),
        ...(typeof input.text === 'string' && input.text.trim() ? { text: input.text } : {}),
      }),
    });

    return { ok: res.ok as boolean };
  }

  return { ok: true as const };
}
