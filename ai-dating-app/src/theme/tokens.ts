export const colorTokens = {
  // GreenFlag Brand Colors (from Behance)
  neonGreen: '#ADFF1A',        // Grass green - primary CTA color
  deepBlack: '#101D13',        // Dark green-tinted black (new background)
  darkBlack: '#0A0A0A',        // Slightly lighter black
  charcoal: '#1A1A1A',         // Charcoal for cards
  darkGray: '#212121',         // Dark gray
  mediumGray: '#2A2A2A',       // Medium gray for elevated cards
  lightGray: '#3A3A3A',        // Light gray for borders
  peach: '#FDE2C9',            // Soft peach accent
  forestGreen: '#418B01',      // Deep green accent
  ivory: '#F6F6F6',            // Light background for inputs

  // Functional Colors
  primary: '#ADFF1A',          // Neon green for CTAs
  primaryDark: '#A8E02C',      // Darker green
  success: '#3BB273',
  successTint: 'rgba(188, 246, 65, 0.16)',
  accent: '#FDE2C9',           // Peach
  accentTint: 'rgba(253, 226, 201, 0.35)',
  info: '#ADFF1A',             // Neon green
  background: '#101D13',       // Dark green-tinted black
  surface: '#1A1A1A',          // Charcoal for cards
  surfaceLight: '#2A2A2A',     // Medium gray for elevated cards
  text: '#FFFFFF',             // White text
  textDark: '#E0E0E0',         // Slightly dimmed white
  muted: '#888888',            // Muted gray
  mutedLight: '#AAAAAA',       // Light muted
  border: '#333333',           // Dark border
  borderLight: '#444444',      // Lighter border
  error: '#FF6B6B',            // Bright error red
  pink: '#FF4D8A',             // Pink for hearts/likes
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
    // Background & Surface
    background: colorTokens.background,      // Dark green-tinted black
    surface: colorTokens.surface,           // Charcoal cards
    surfaceLight: colorTokens.surfaceLight, // Medium gray for elevated cards

    // Text
    text: colorTokens.text,                 // White
    textDark: colorTokens.textDark,         // Dimmed white
    muted: colorTokens.muted,               // Muted gray
    mutedLight: colorTokens.mutedLight,     // Light muted

    // Borders
    border: colorTokens.border,             // Dark border
    borderLight: colorTokens.borderLight,   // Lighter border

    // Brand & Actions
    primary: colorTokens.primary,           // Neon green
    primaryDark: colorTokens.primaryDark,   // Darker neon green
    brand: colorTokens.neonGreen,           // Neon green

    // Additional Colors
    success: colorTokens.success,
    successTint: colorTokens.successTint,
    accent: colorTokens.accent,             // Peach
    accentTint: colorTokens.accentTint,
    info: colorTokens.info,                 // Neon green
    error: colorTokens.error,               // Bright red
    pink: colorTokens.pink,                 // Pink for likes

    // Specific Brand Colors
    neonGreen: colorTokens.neonGreen,
    deepBlack: colorTokens.deepBlack,
    darkBlack: colorTokens.darkBlack,
    charcoal: colorTokens.charcoal,
    darkGray: colorTokens.darkGray,
    mediumGray: colorTokens.mediumGray,
    lightGray: colorTokens.lightGray,
    peach: colorTokens.peach,
    forestGreen: colorTokens.forestGreen,
    ivory: colorTokens.ivory,
  },
  radius: radiusTokens,
  spacing: spacingTokens,
  fonts: fontTokens,
});

export type Theme = ReturnType<typeof createTheme>;
