import React, { useMemo } from 'react';
import { View, Image, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { useTheme } from '../../theme';
import ThemedText from './ThemedText';

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
  firstName: string;
  lastName: string;
  size?: AvatarSize;
  imageUrl?: string;
  style?: ViewStyle;
}

const SIZE_MAP: Record<AvatarSize, number> = {
  sm: 32,
  md: 40,
  lg: 56,
  xl: 80,
};

const FONT_SIZE_MAP: Record<AvatarSize, number> = {
  sm: 12,
  md: 14,
  lg: 20,
  xl: 28,
};

const AVATAR_COLORS = [
  '#4B49AC',
  '#7DA0FA',
  '#F3797E',
  '#7978E9',
  '#22C55E',
  '#F59E0B',
  '#3B82F6',
  '#8B5CF6',
  '#EC4899',
  '#14B8A6',
];

const getColorFromName = (firstName: string, lastName: string): string => {
  const str = `${firstName}${lastName}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

const Avatar: React.FC<AvatarProps> = ({
  firstName,
  lastName,
  size = 'md',
  imageUrl,
  style,
}) => {
  const dimension = SIZE_MAP[size];
  const fontSize = FONT_SIZE_MAP[size];

  const initials = useMemo(
    () =>
      `${(firstName?.[0] ?? '').toUpperCase()}${(lastName?.[0] ?? '').toUpperCase()}`,
    [firstName, lastName],
  );

  const bgColor = useMemo(
    () => getColorFromName(firstName, lastName),
    [firstName, lastName],
  );

  const containerStyle: ViewStyle = {
    width: dimension,
    height: dimension,
    borderRadius: dimension / 2,
    backgroundColor: bgColor,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  };

  if (imageUrl) {
    return (
      <View style={[containerStyle, style]}>
        <Image
          source={{ uri: imageUrl }}
          style={{ width: dimension, height: dimension }}
          resizeMode="cover"
        />
      </View>
    );
  }

  return (
    <View style={[containerStyle, style]}>
      <ThemedText
        color="#FFFFFF"
        style={{
          fontSize,
          fontWeight: '600',
          lineHeight: fontSize * 1.2,
        }}
      >
        {initials}
      </ThemedText>
    </View>
  );
};

export default Avatar;
