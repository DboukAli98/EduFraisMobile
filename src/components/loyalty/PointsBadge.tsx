import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import ThemedText from '../common/ThemedText';

/**
 * Pill-shaped chip that renders a points balance with an icon.
 *
 * - `pointsLabel` defaults to "Points" (the program-level field — directors
 *   can rebrand it). Pass through whatever the program returns so the chip
 *   says e.g. "350 Points", "350 Étoiles", "350 ★".
 * - `tone` switches between filled (default) and subtle (outlined) — use
 *   subtle when the chip is small / inline next to other UI.
 * - `size` controls horizontal padding + font; the icon scales with it.
 *
 * Designed to be cheap and uncoupled from the loyalty store — give it a
 * number and a label and it renders. Use the bigger PointsHeaderCard for
 * the dashboard hero.
 */
export interface PointsBadgeProps {
  points: number;
  pointsLabel?: string;
  size?: 'sm' | 'md' | 'lg';
  tone?: 'filled' | 'subtle';
  style?: StyleProp<ViewStyle>;
}

const PointsBadge: React.FC<PointsBadgeProps> = ({
  points,
  pointsLabel = 'Points',
  size = 'md',
  tone = 'filled',
  style,
}) => {
  const { theme } = useTheme();

  // Defensive — never render NaN. A zero balance is legitimate (new
  // member who hasn't earned the welcome bonus yet, or fully redeemed).
  const safePoints = Number.isFinite(points) ? Math.max(0, Math.round(points)) : 0;
  const formatted = safePoints.toLocaleString();

  const padX = size === 'sm' ? 8 : size === 'lg' ? 14 : 10;
  const padY = size === 'sm' ? 3 : size === 'lg' ? 7 : 5;
  const iconSize = size === 'sm' ? 12 : size === 'lg' ? 18 : 14;
  const textVariant = size === 'lg' ? 'subtitle' : 'caption';

  const filledStyle: ViewStyle = {
    backgroundColor: theme.colors.primary,
  };
  const subtleStyle: ViewStyle = {
    backgroundColor: theme.colors.primary + '15',
    borderWidth: 1,
    borderColor: theme.colors.primary + '40',
  };

  const fg = tone === 'filled' ? '#FFFFFF' : theme.colors.primary;

  return (
    <View
      style={[
        styles.badge,
        { paddingHorizontal: padX, paddingVertical: padY, borderRadius: theme.borderRadius.full },
        tone === 'filled' ? filledStyle : subtleStyle,
        style,
      ]}
    >
      <Ionicons name="star" size={iconSize} color={fg} style={styles.icon} />
      <ThemedText variant={textVariant} color={fg} style={styles.text}>
        {formatted} {pointsLabel}
      </ThemedText>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  icon: {
    marginRight: 4,
  },
  text: {
    fontWeight: '600',
  },
});

export default PointsBadge;
