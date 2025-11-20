export const colorTokens = {
  primary: '#3BB273',
  primaryDark: '#2A7A56',
  success: '#3BB273',
  successTint: 'rgba(59,178,115,0.16)',
  accent: '#F6D6D1',
  accentTint: 'rgba(246,214,209,0.35)',
  info: '#91C9B7',
  background: '#FAFAF2',
  surface: '#FFFFFF',
  text: '#121614',
  muted: '#6E6E6E',
  mutedLight: '#9E9E9E',
  border: '#E0E0E0',
  error: '#E87C74',
};

export const radiusTokens = {
  pill: 999,
  lg: 32,
  md: 24,
  sm: 16,
};

export const spacingTokens = {
  xs: 8,
  sm: 12,
  md: 20,
  lg: 28,
  xl: 36,
  xxl: 48,
};

export const fontTokens = {
  display: {
    family: 'RedHatDisplay_700Bold',
    weight: '700' as const,
    size: 32,
    lineHeight: 40,
  },
  h1: {
    family: 'RedHatDisplay_600SemiBold',
    weight: '600' as const,
    size: 26,
    lineHeight: 34,
  },
  h2: {
    family: 'RedHatDisplay_500Medium',
    weight: '500' as const,
    size: 20,
    lineHeight: 28,
  },
  body: {
    family: 'RedHatDisplay_400Regular',
    weight: '400' as const,
    size: 16,
    lineHeight: 24,
  },
  bodyStrong: {
    family: 'RedHatDisplay_600SemiBold',
    weight: '600' as const,
    size: 16,
    lineHeight: 24,
  },
  small: {
    family: 'RedHatDisplay_400Regular',
    weight: '400' as const,
    size: 15,
    lineHeight: 22,
  },
  tiny: {
    family: 'RedHatDisplay_400Regular',
    weight: '400' as const,
    size: 13,
    lineHeight: 18,
  },
};

export const createTheme = () => ({
  colors: {
    background: colorTokens.background,
    surface: colorTokens.surface,
    text: colorTokens.text,
    muted: colorTokens.muted,
    mutedLight: colorTokens.mutedLight,
    border: colorTokens.border,
    primary: colorTokens.primary,
    primaryDark: colorTokens.primaryDark,
    brand: colorTokens.primary,
    success: colorTokens.success,
    successTint: colorTokens.successTint,
    accent: colorTokens.accent,
    accentTint: colorTokens.accentTint,
    info: colorTokens.info,
    error: colorTokens.error,
  },
  radius: radiusTokens,
  spacing: spacingTokens,
  fonts: fontTokens,
});

export type Theme = ReturnType<typeof createTheme>;
