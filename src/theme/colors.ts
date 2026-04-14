export const palette = {
  // Brand colors
  primary: '#4B49AC',
  primaryLight: '#6C6ACD',
  secondary: '#7DA0FA',
  accent: '#F3797E',
  lavender: '#7978E9',

  // Neutrals
  white: '#FFFFFF',
  black: '#000000',

  // Grays
  gray50: '#F8F9FC',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray800: '#1F2937',
  gray900: '#111827',

  // Dark mode surfaces
  darkBg: '#0F172A',
  darkSurface: '#1E293B',
  darkCard: '#263548',
  darkBorder: '#334155',
  darkBorderLight: '#475569',

  // Semantic colors
  success: '#22C55E',
  successLight: '#DCFCE7',
  successDark: '#1A7A3A',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  warningDark: '#B45309',
  error: '#EF4444',
  errorLight: '#FEE2E2',
  errorDark: '#B91C1C',
  info: '#3B82F6',
  infoLight: '#DBEAFE',
  infoDark: '#1E40AF',
} as const;

export const gradients = {
  primary: ['#4B49AC', '#7DA0FA'] as const,
  accent: ['#F3797E', '#FB7185'] as const,
} as const;

export type Palette = typeof palette;
export type Gradients = typeof gradients;
