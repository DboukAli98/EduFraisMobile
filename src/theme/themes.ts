import { palette, gradients } from './colors';
import { typography, Typography } from './typography';
import { spacing, Spacing } from './spacing';
import { borderRadius, BorderRadius } from './borderRadius';
import { lightShadows, darkShadows, ShadowSet } from './shadows';

export interface ThemeColors {
  primary: string;
  primaryLight: string;
  secondary: string;
  accent: string;
  lavender: string;
  background: string;
  surface: string;
  card: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  border: string;
  borderLight: string;
  notification: string;
  success: string;
  successLight: string;
  warning: string;
  warningLight: string;
  error: string;
  errorLight: string;
  info: string;
  infoLight: string;
  disabled: string;
  disabledText: string;
  overlay: string;
  shadow: string;
  skeleton: string;
  skeletonHighlight: string;
  inputBackground: string;
  tabBar: string;
  tabBarInactive: string;
  statusBar: 'light' | 'dark';
  gradient: {
    primary: readonly [string, string];
    accent: readonly [string, string];
  };
}

export interface Theme {
  dark: boolean;
  colors: ThemeColors;
  typography: Typography;
  spacing: Spacing;
  borderRadius: BorderRadius;
  shadows: ShadowSet;
}

export const lightTheme: Theme = {
  dark: false,
  colors: {
    primary: palette.primary,
    primaryLight: palette.primaryLight,
    secondary: palette.secondary,
    accent: palette.accent,
    lavender: palette.lavender,
    background: palette.gray50,
    surface: palette.white,
    card: palette.white,
    text: palette.gray800,
    textSecondary: palette.gray500,
    textTertiary: palette.gray400,
    border: palette.gray300,
    borderLight: palette.gray200,
    notification: palette.accent,
    success: palette.success,
    successLight: palette.successLight,
    warning: palette.warning,
    warningLight: palette.warningLight,
    error: palette.error,
    errorLight: palette.errorLight,
    info: palette.info,
    infoLight: palette.infoLight,
    disabled: palette.gray200,
    disabledText: palette.gray400,
    overlay: 'rgba(0, 0, 0, 0.5)',
    shadow: palette.black,
    skeleton: palette.gray200,
    skeletonHighlight: palette.gray100,
    inputBackground: palette.gray100,
    tabBar: palette.white,
    tabBarInactive: palette.gray400,
    statusBar: 'dark',
    gradient: {
      primary: gradients.primary,
      accent: gradients.accent,
    },
  },
  typography,
  spacing,
  borderRadius,
  shadows: lightShadows,
};

export const darkTheme: Theme = {
  dark: true,
  colors: {
    primary: palette.primary,
    primaryLight: palette.primaryLight,
    secondary: palette.secondary,
    accent: palette.accent,
    lavender: palette.lavender,
    background: palette.darkBg,
    surface: palette.darkSurface,
    card: palette.darkCard,
    text: palette.gray200,
    textSecondary: palette.gray400,
    textTertiary: palette.gray500,
    border: palette.darkBorder,
    borderLight: palette.darkBorderLight,
    notification: palette.accent,
    success: palette.success,
    successLight: palette.successDark,
    warning: palette.warning,
    warningLight: palette.warningDark,
    error: palette.error,
    errorLight: palette.errorDark,
    info: palette.info,
    infoLight: palette.infoDark,
    disabled: palette.darkBorder,
    disabledText: palette.gray500,
    overlay: 'rgba(0, 0, 0, 0.7)',
    shadow: palette.black,
    skeleton: palette.darkBorder,
    skeletonHighlight: palette.darkCard,
    inputBackground: palette.darkSurface,
    tabBar: palette.darkSurface,
    tabBarInactive: palette.gray500,
    statusBar: 'light',
    gradient: {
      primary: gradients.primary,
      accent: gradients.accent,
    },
  },
  typography,
  spacing,
  borderRadius,
  shadows: darkShadows,
};
