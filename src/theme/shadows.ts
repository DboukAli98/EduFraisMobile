import { Platform, ViewStyle } from 'react-native';

export interface Shadow {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
}

export interface ShadowSet {
  none: Shadow;
  sm: Shadow;
  md: Shadow;
  lg: Shadow;
  xl: Shadow;
}

const createShadow = (
  color: string,
  offsetY: number,
  opacity: number,
  radius: number,
  elevation: number,
): Shadow => ({
  shadowColor: color,
  shadowOffset: { width: 0, height: offsetY },
  shadowOpacity: Platform.OS === 'ios' ? opacity : 0,
  shadowRadius: Platform.OS === 'ios' ? radius : 0,
  elevation: Platform.OS === 'android' ? elevation : 0,
});

export const lightShadows: ShadowSet = {
  none: createShadow('#000000', 0, 0, 0, 0),
  sm: createShadow('#000000', 1, 0.05, 2, 1),
  md: createShadow('#000000', 2, 0.08, 4, 3),
  lg: createShadow('#000000', 4, 0.1, 8, 6),
  xl: createShadow('#000000', 8, 0.12, 16, 10),
};

export const darkShadows: ShadowSet = {
  none: createShadow('#000000', 0, 0, 0, 0),
  sm: createShadow('#000000', 1, 0.2, 2, 1),
  md: createShadow('#000000', 2, 0.25, 4, 3),
  lg: createShadow('#000000', 4, 0.3, 8, 6),
  xl: createShadow('#000000', 8, 0.35, 16, 10),
};
