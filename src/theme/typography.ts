import { TextStyle } from 'react-native';

const fontFamily = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export interface TypographyVariant {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  fontWeight: TextStyle['fontWeight'];
}

export const typography = {
  display: {
    fontFamily: fontFamily.bold,
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: -0.5,
    fontWeight: '700' as const,
  },
  h1: {
    fontFamily: fontFamily.semiBold,
    fontSize: 28,
    lineHeight: 36,
    letterSpacing: -0.3,
    fontWeight: '600' as const,
  },
  h2: {
    fontFamily: fontFamily.semiBold,
    fontSize: 24,
    lineHeight: 32,
    letterSpacing: -0.2,
    fontWeight: '600' as const,
  },
  title: {
    fontFamily: fontFamily.semiBold,
    fontSize: 20,
    lineHeight: 28,
    letterSpacing: -0.1,
    fontWeight: '600' as const,
  },
  subtitle: {
    fontFamily: fontFamily.medium,
    fontSize: 18,
    lineHeight: 26,
    letterSpacing: 0,
    fontWeight: '500' as const,
  },
  body: {
    fontFamily: fontFamily.regular,
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0.1,
    fontWeight: '400' as const,
  },
  bodySmall: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.1,
    fontWeight: '400' as const,
  },
  caption: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.2,
    fontWeight: '400' as const,
  },
  button: {
    fontFamily: fontFamily.semiBold,
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0.3,
    fontWeight: '600' as const,
  },
  numeric: {
    fontFamily: fontFamily.bold,
    fontSize: 24,
    lineHeight: 32,
    letterSpacing: -0.2,
    fontWeight: '700' as const,
  },
  numericSmall: {
    fontFamily: fontFamily.semiBold,
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.1,
    fontWeight: '600' as const,
  },
} as const;

export type Typography = typeof typography;
export type TypographyVariantName = keyof Typography;
