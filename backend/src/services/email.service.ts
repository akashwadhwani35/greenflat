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

const DEFAULT_ASSET_BASE_URL = 'https://greenflag-api-480247350372.us-central1.run.app';

/** Public origin the email's images are loaded from (mail clients need absolute URLs). */
const assetBaseUrl = () =>
  (process.env.EMAIL_ASSET_BASE_URL || DEFAULT_ASSET_BASE_URL).trim().replace(/\/+$/, '');

/** "GreenFlag <verify@gflag.app>" unless the env already carries a display name. */
const fromHeader = () => {
  const address = fromAddress();
  return address.includes('<') ? address : `GreenFlag <${address}>`;
};

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

/**
 * Verification-code email in the app's own look: dark green card, neon accent,
 * Red Hat Display where the client allows web fonts (Apple Mail, iOS) and a
 * plain sans fallback everywhere else. Tables and inline styles on purpose —
 * Gmail and Outlook strip most of anything else.
 */
export const renderOtpEmail = (code: string): RenderedEmail => {
  const safeCode = escapeHtml(code);
  const logoUrl = `${assetBaseUrl()}/public/email/logo.png`;
  const year = new Date().getFullYear();

  const text =
    `Your GreenFlag verification code is ${code}.\n` +
    `It expires in 5 minutes.\n\n` +
    `If you did not ask for this, you can ignore this email — nothing changes on your account.\n\n` +
    `GreenFlag · gflag.app`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${safeCode} is your GreenFlag code</title>
<link href="https://fonts.googleapis.com/css2?family=Red+Hat+Display:wght@500;700;800&display=swap" rel="stylesheet">
<style>
  body { margin:0; padding:0; background:#0B140D; -webkit-text-size-adjust:100%; }
  table { border-collapse:separate; border-spacing:0; }
  .font { font-family:'Red Hat Display', -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif; }
  @media only screen and (max-width: 480px) {
    .card { padding:32px 22px !important; }
    .code { font-size:36px !important; letter-spacing:8px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#0B140D;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">Your GreenFlag code is ${safeCode}. It expires in 5 minutes.&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#0B140D" style="background:#0B140D;">
  <tr>
    <td align="center" bgcolor="#0B140D" style="padding:40px 16px 48px;background:#0B140D;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#0B140D" style="max-width:480px;background:#0B140D;">

        <tr>
          <td align="left" class="font" bgcolor="#0B140D" style="padding:0 4px 20px;background:#0B140D;">
            <table role="presentation" cellpadding="0" cellspacing="0" bgcolor="#0B140D" style="background:#0B140D;">
              <tr>
                <td bgcolor="#0B140D" style="vertical-align:middle;padding-right:12px;background:#0B140D;">
                  <img src="${logoUrl}" width="40" height="40" alt="GreenFlag" style="display:block;width:40px;height:40px;border-radius:10px;border:0;background:#101D13;">
                </td>
                <td class="font" style="vertical-align:middle;font-size:20px;font-weight:800;color:#F6F6F6;letter-spacing:-0.3px;">
                  GreenFlag
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td class="card" style="background:#101D13;border:1px solid #243830;border-radius:20px;padding:40px 36px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td class="font" style="font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#ADFF1A;padding-bottom:12px;">
                  Verification code
                </td>
              </tr>
              <tr>
                <td class="font" style="font-size:26px;line-height:32px;font-weight:800;color:#F6F6F6;padding-bottom:10px;letter-spacing:-0.4px;">
                  Confirm your email
                </td>
              </tr>
              <tr>
                <td class="font" style="font-size:15px;line-height:23px;color:#A8B3AB;padding-bottom:28px;">
                  Enter this code in the GreenFlag app to finish creating your account.
                </td>
              </tr>
              <tr>
                <td align="center" style="background:#1B2920;border:1px solid #2E4437;border-radius:14px;padding:26px 16px;">
                  <span class="font code" style="display:inline-block;font-size:42px;line-height:48px;font-weight:800;letter-spacing:12px;color:#ADFF1A;padding-left:12px;">${safeCode}</span>
                </td>
              </tr>
              <tr>
                <td class="font" align="center" style="font-size:13px;line-height:20px;color:#7F8C84;padding-top:14px;">
                  Expires in 5 minutes
                </td>
              </tr>
              <tr>
                <td style="padding:28px 0 24px;">
                  <div style="height:1px;background:#243830;line-height:1px;font-size:1px;">&nbsp;</div>
                </td>
              </tr>
              <tr>
                <td class="font" style="font-size:13px;line-height:21px;color:#7F8C84;">
                  Didn't request this? You can safely ignore this email. Nobody can access your account without the code, and it goes stale on its own.
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td class="font" align="center" style="padding:26px 12px 0;font-size:12px;line-height:19px;color:#5C6862;">
            Sent by GreenFlag because this address was used to sign up.<br>
            &copy; ${year} GreenFlag &middot; <a href="https://gflag.app" style="color:#7F8C84;text-decoration:none;">gflag.app</a>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  return { subject: `${code} is your GreenFlag code`, text, html };
};

export const sendOtpEmail = async (to: string, code: string): Promise<void> => {
  if (!isEmailConfigured()) {
    throw new Error('Email provider is not configured');
  }

  const email = renderOtpEmail(code);
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromHeader(),
      to: [to],
      subject: email.subject,
      text: email.text,
      html: email.html,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Email delivery failed: ${detail.slice(0, 200)}`);
  }
};
