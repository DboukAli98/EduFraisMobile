import React from 'react';
import { View, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { useAnimatedEntry, staggerDelay } from '../../hooks';
import ThemedText from '../common/ThemedText';
import ThemedCard from '../common/ThemedCard';

type TrendDirection = 'up' | 'down' | 'neutral';

interface KPIStatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  trend?: TrendDirection;
  trendValue?: string;
  color?: string;
  index?: number;
}

const KPIStatCard: React.FC<KPIStatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  trendValue,
  color,
  index = 0,
}) => {
  const { theme } = useTheme();
  const accentColor = color ?? theme.colors.primary;

  const animatedStyle = useAnimatedEntry({
    type: 'slideUp',
    delay: staggerDelay(index),
  });

  const getTrendIcon = (): keyof typeof Ionicons.glyphMap => {
    switch (trend) {
      case 'up':
        return 'trending-up';
      case 'down':
        return 'trending-down';
      default:
        return 'remove-outline';
    }
  };

  const getTrendColor = (): string => {
    switch (trend) {
      case 'up':
        return theme.colors.success;
      case 'down':
        return theme.colors.error;
      default:
        return theme.colors.textSecondary;
    }
  };

  return (
    <Animated.View style={animatedStyle}>
      <ThemedCard variant="elevated" style={styles.card}>
        <View style={styles.header}>
          <View
            style={[
              styles.iconContainer,
              {
                backgroundColor: accentColor + '15',
                borderRadius: theme.borderRadius.md,
              },
            ]}
          >
            <Ionicons name={icon} size={22} color={accentColor} />
          </View>
          {trend && trendValue && (
            <View style={styles.trendContainer}>
              <Ionicons
                name={getTrendIcon()}
                size={14}
                color={getTrendColor()}
              />
              <ThemedText
                variant="caption"
                color={getTrendColor()}
                style={styles.trendText}
              >
                {trendValue}
              </ThemedText>
            </View>
          )}
        </View>

        <ThemedText variant="numeric" style={styles.value}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </ThemedText>

        <ThemedText
          variant="caption"
          color={theme.colors.textSecondary}
        >
          {title}
        </ThemedText>

        {subtitle && (
          <ThemedText
            variant="caption"
            color={theme.colors.textTertiary}
            style={styles.subtitle}
          >
            {subtitle}
          </ThemedText>
        )}
      </ThemedCard>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    minWidth: 150,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  iconContainer: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trendText: {
    marginLeft: 2,
    fontWeight: '600',
  },
  value: {
    marginBottom: 4,
  },
  subtitle: {
    marginTop: 2,
  },
});

export default KPIStatCard;
