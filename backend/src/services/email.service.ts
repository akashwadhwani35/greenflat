/**
 * Transactional email via Resend.
 *
 * Used for verification codes. Email rather than SMS because sending an OTP to an
 * Indian mobile number requires TRAI DLT registration (entity, sender ID and
 * templates registered with the operators, using business documents), which no
 * "free SMS API" gets you around. Email has no such gate and Resend's free tier
 * covers 3,000 messages a month.
 */
const apiKey = () => (process.env.RESEND_API_KEY || '').trim();
const fromAddress = () =>
  (process.env.OTP_FROM_EMAIL || process.env.SUPPORT_FROM_EMAIL || '').trim();

export const isEmailConfigured = () => Boolean(apiKey() && fromAddress());

export const normalizeEmail = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  // Deliberately simple: the code is only delivered if the address is real.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)) return null;
  if (trimmed.length > 254) return null;
  return trimmed;
};

export const sendOtpEmail = async (to: string, code: string): Promise<void> => {
  if (!isEmailConfigured()) {
    throw new Error('Email provider is not configured');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromAddress(),
      to: [to],
      subject: `${code} is your GreenFlag code`,
      text: `Your GreenFlag verification code is ${code}. It expires in 5 minutes.\n\nIf you did not ask for this, you can ignore this email.`,
      html:
        `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:420px">` +
        `<p style="font-size:15px;color:#111">Your GreenFlag verification code is</p>` +
        `<p style="font-size:34px;letter-spacing:6px;font-weight:700;margin:12px 0;color:#111">${code}</p>` +
        `<p style="font-size:13px;color:#666">It expires in 5 minutes. If you did not ask for this, you can ignore this email.</p>` +
        `</div>`,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Email delivery failed: ${detail.slice(0, 200)}`);
  }
};
