import { useState, useEffect } from 'react';
import { Dimensions, ScaledSize } from 'react-native';

interface ResponsiveInfo {
  width: number;
  height: number;
  isSmallDevice: boolean;
  isTablet: boolean;
  isLandscape: boolean;
}

export const useResponsive = (): ResponsiveInfo => {
  const [dimensions, setDimensions] = useState(() => Dimensions.get('window'));

  useEffect(() => {
    const handler = ({ window }: { window: ScaledSize }) => {
      setDimensions(window);
    };
    const subscription = Dimensions.addEventListener('change', handler);
    return () => subscription.remove();
  }, []);

  return {
    width: dimensions.width,
    height: dimensions.height,
    isSmallDevice: dimensions.width < 375,
    isTablet: dimensions.width >= 768,
    isLandscape: dimensions.width > dimensions.height,
  };
};
