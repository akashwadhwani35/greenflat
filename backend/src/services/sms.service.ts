const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER || '';

export const isSmsConfigured = () =>
  Boolean(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_FROM_NUMBER);

export const canUseDevOtpBypass = () =>
  process.env.NODE_ENV !== 'production' && process.env.ALLOW_DEV_OTP_BYPASS !== 'false';

export const sendOtpSms = async (to: string, code: string): Promise<void> => {
  if (!isSmsConfigured()) {
    throw new Error('SMS provider is not configured');
  }

  const body = new URLSearchParams({
    To: to,
    From: TWILIO_FROM_NUMBER,
    Body: `Your GreenFlag verification code is ${code}. It expires in 5 minutes.`,
  });

  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    }
  );

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`SMS delivery failed: ${details}`);
  }
};
