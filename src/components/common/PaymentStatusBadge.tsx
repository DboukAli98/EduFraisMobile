import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
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

const statusTranslationKey: Record<PaymentStatusType, string> = {
  Paid: 'payments.paid',
  Pending: 'payments.pending',
  Overdue: 'payments.overdue',
  InProgress: 'payments.inProgress',
  Failed: 'payments.failed',
  Cancelled: 'payments.cancelled',
};

const PaymentStatusBadge: React.FC<PaymentStatusBadgeProps> = ({
  status,
  size = 'md',
}) => {
  const { theme } = useTheme();
  const { t } = useTranslation();

  const getStatusBg = (): string => {
    switch (status) {
      case 'Paid':
        return theme.colors.success;
      case 'Pending':
        return theme.colors.warning;
      case 'Overdue':
      case 'Failed':
        return theme.colors.error;
      case 'InProgress':
        return theme.colors.info;
      case 'Cancelled':
        return theme.colors.disabled;
      default:
        return theme.colors.disabled;
    }
  };

  const bg = getStatusBg();
  const isSmall = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: bg,
          paddingHorizontal: isSmall ? 8 : 12,
          paddingVertical: isSmall ? 2 : 4,
          borderRadius: theme.borderRadius.full,
        },
      ]}
    >
      <ThemedText
        variant="caption"
        color="#FFFFFF"
        style={isSmall ? styles.smallText : undefined}
      >
        {t(statusTranslationKey[status] ?? '', status)}
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
