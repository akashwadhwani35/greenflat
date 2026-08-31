/**
 * Sends one real verification email, to prove the Resend setup works.
 *
 * Email is the only step of the signup funnel that cannot be skipped — phone is
 * optional, email is not — so this is the check worth running before a deploy
 * that turns registration on.
 *
 *   npm run test:email -- you@example.com
 *
 * Reads RESEND_API_KEY and OTP_FROM_EMAIL from backend/.env and never prints
 * either. Put the key in .env yourself; do not paste it into a terminal that
 * gets logged, or into a chat.
 */
import dotenv from 'dotenv';
import { isEmailConfigured, normalizeEmail, sendOtpEmail } from '../services/email.service';

dotenv.config();

const fail = (message: string): never => {
  console.error(`\n❌ ${message}\n`);
  process.exit(1);
};

const main = async () => {
  const recipient = normalizeEmail(process.argv[2]);
  if (!recipient) {
    fail('Usage: npm run test:email -- you@example.com');
  }

  const from = (process.env.OTP_FROM_EMAIL || process.env.SUPPORT_FROM_EMAIL || '').trim();

  if (!process.env.RESEND_API_KEY) {
    fail('RESEND_API_KEY is not set in backend/.env');
  }
  if (!from) {
    fail('OTP_FROM_EMAIL is not set in backend/.env (e.g. "GreenFlag <verify@gflag.app>")');
  }
  if (!isEmailConfigured()) {
    fail('Email is still reported as unconfigured. Check both values are non-empty.');
  }

  // Not a real OTP, and never written to otp_codes. Nothing here can verify an account.
  const sample = '424242';

  console.log(`Sending from : ${from}`);
  console.log(`Sending to   : ${recipient}`);
  console.log('Sending...');

  try {
    await sendOtpEmail(recipient!, sample);
  } catch (error: any) {
    const detail = String(error?.message || error);

    // The two failures worth naming, because the API message alone is cryptic.
    if (/domain is not verified|not verified/i.test(detail)) {
      fail(
        `Resend rejected the sender domain.\n\n   ${detail}\n\n` +
          '   Verify the domain of OTP_FROM_EMAIL in the Resend dashboard\n' +
          '   (Domains -> Add domain, then add the DKIM/SPF DNS records).\n' +
          '   Until then you can only send from onboarding@resend.dev, and only\n' +
          '   to the address that owns the Resend account.'
      );
    }
    if (/403|401|api key/i.test(detail)) {
      fail(`Resend rejected the API key.\n\n   ${detail}`);
    }
    fail(detail);
  }

  console.log(`\n✅ Accepted by Resend. Check ${recipient} (including spam).`);
  console.log('   Delivery is not the same as acceptance — confirm it actually arrived.\n');
};

void main();
