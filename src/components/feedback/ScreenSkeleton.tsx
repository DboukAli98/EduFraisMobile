import React from 'react';
import { View, StyleSheet } from 'react-native';
import LoadingSkeleton from './LoadingSkeleton';
import { useTheme } from '../../theme';

interface ScreenSkeletonProps {
  count?: number;
}

const ScreenSkeleton: React.FC<ScreenSkeletonProps> = ({ count = 4 }) => {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{ marginBottom: theme.spacing.lg }}>
          <LoadingSkeleton
            width="100%"
            height={100}
            borderRadius={theme.borderRadius.xl}
          />
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
});

export default ScreenSkeleton;
