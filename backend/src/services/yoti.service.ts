// Minimal Yoti facade. Replace with real SDK calls when credentials are provided.

const yotiConfig = {
  sdkId: process.env.YOTI_SDK_ID,
  privateKeyPath: process.env.YOTI_PRIVATE_KEY_PATH,
  scenarioId: process.env.YOTI_SCENARIO_ID,
  webhookSecret: process.env.YOTI_WEBHOOK_SECRET,
};

export const isYotiConfigured = () =>
  Boolean(yotiConfig.sdkId && yotiConfig.privateKeyPath && yotiConfig.scenarioId);

export const createYotiSession = async (_userId: number) => {
  if (!isYotiConfigured()) {
    throw new Error('Yoti not configured');
  }
  // TODO: integrate official Yoti Doc Scan/Identity SDK here.
  return {
    sessionId: 'demo-session-id',
    clientSessionToken: 'demo-client-token',
    sessionUrl: 'https://yoti.example/demo',
  };
};

export const getYotiSessionResult = async (_sessionId: string) => {
  if (!isYotiConfigured()) {
    return { error: 'Yoti not configured', success: false };
  }
  // TODO: fetch real results from Yoti API.
  return {
    success: true,
    ageVerified: true,
    livenessVerified: true,
    dateOfBirth: '1995-01-01',
    documentType: 'PASSPORT',
    issuingCountry: 'GBR',
  };
};

