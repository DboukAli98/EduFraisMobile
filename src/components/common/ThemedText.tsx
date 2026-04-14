import React from 'react';
import { Text, TextProps, TextStyle, StyleSheet } from 'react-native';
import { useTheme } from '../../theme';

type TypographyVariant =
  | 'display'
  | 'h1'
  | 'h2'
  | 'title'
  | 'subtitle'
  | 'body'
  | 'bodySmall'
  | 'caption'
  | 'button'
  | 'numeric'
  | 'numericSmall';

interface ThemedTextProps extends TextProps {
  variant?: TypographyVariant;
  color?: string;
  align?: TextStyle['textAlign'];
}

const ThemedText: React.FC<ThemedTextProps> = ({
  variant = 'body',
  color,
  align,
  style,
  children,
  ...rest
}) => {
  const { theme } = useTheme();
  const typographyStyle = theme.typography[variant];

  const composedStyle: TextStyle = {
    ...typographyStyle,
    color: color ?? theme.colors.text,
    ...(align ? { textAlign: align } : undefined),
  };

  return (
    <Text style={[composedStyle, style]} {...rest}>
      {children}
    </Text>
  );
};

export default ThemedText;
