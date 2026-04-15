import React from 'react';
import { useAppSelector } from '../store/store';
import { ScreenContainer, ThemedText } from '../components';
import ParentPaymentsScreen from './parent/PaymentsScreen';
import ReportsScreen from './director/ReportsScreen';

export default function PaymentsRouter() {
  const role = useAppSelector((state) => state.auth.user?.role);

  if (role === 'director') {
    return <ReportsScreen />;
  }

  if (role === 'manager') {
    return (
      <ScreenContainer>
        <ThemedText variant="h1">Payments</ThemedText>
        <ThemedText variant="body">
          Payments is currently available for parent and director accounts.
        </ThemedText>
      </ScreenContainer>
    );
  }

  return <ParentPaymentsScreen />;
}
