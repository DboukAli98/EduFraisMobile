import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../../theme';
import ThemedText from './ThemedText';

type PaymentStatusType =
  | 'Paid'
  | 'Pending'
  | 'Overdue'
  | 'InProgress'
  | 'Failed'
  | 'Cancelled';

interface PaymentStatusBadgeProps {
  status: PaymentStatusType;
  size?: 'sm' | 'md';
}

const PaymentStatusBadge: React.FC<PaymentStatusBadgeProps> = ({
  status,
  size = 'md',
}) => {
  const { theme } = useTheme();

  const getStatusColors = (): { bg: string; text: string } => {
    switch (status) {
      case 'Paid':
        return { bg: theme.colors.successLight, text: theme.colors.success };
      case 'Pending':
        return { bg: theme.colors.warningLight, text: theme.colors.warning };
      case 'Overdue':
      case 'Failed':
        return { bg: theme.colors.errorLight, text: theme.colors.error };
      case 'InProgress':
        return { bg: theme.colors.infoLight, text: theme.colors.info };
      case 'Cancelled':
        return {
          bg: theme.colors.disabled,
          text: theme.colors.disabledText,
        };
      default:
        return { bg: theme.colors.disabled, text: theme.colors.disabledText };
    }
  };

  const colors = getStatusColors();
  const isSmall = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: colors.bg,
          paddingHorizontal: isSmall ? 8 : 12,
          paddingVertical: isSmall ? 2 : 4,
          borderRadius: theme.borderRadius.full,
        },
      ]}
    >
      <ThemedText
        variant="caption"
        color={colors.text}
        style={isSmall ? styles.smallText : undefined}
      >
        {status}
      </ThemedText>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
  },
  smallText: {
    fontSize: 10,
    lineHeight: 14,
  },
});

export default PaymentStatusBadge;
