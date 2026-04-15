import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useTheme } from '../../theme';
import { useAnimatedEntry, staggerDelay, useAppSelector } from '../../hooks';
import {
  ScreenContainer,
  ThemedText,
  ThemedCard,
  ThemedButton,
  Avatar,
  SectionHeader,
  KPIStatCard,
  LoadingSkeleton,
} from '../../components';
import {
  useGetTotalActiveParentInSchoolQuery,
  useGetInstallmentsPendingPaymentsTotalQuery,
  useGetAllAgentsQuery,
} from '../../services/api/apiSlice';
import { formatCurrency } from '../../utils';

// --- Animated Section Wrapper ---
const AnimatedSection: React.FC<{
  index: number;
  children: React.ReactNode;
}> = ({ index, children }) => {
  const animatedStyle = useAnimatedEntry({
    type: 'slideUp',
    delay: staggerDelay(index, 80),
  });
  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
};

export default function ManagerDashboard() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const user = useAppSelector((state) => state.auth.user);
  const schoolId = parseInt((user?.schoolId ?? '0').split(',')[0], 10);

  // Real API calls - same report endpoints as Director
  const { data: activeParentsData, isLoading: loadingParents } = useGetTotalActiveParentInSchoolQuery({ schoolId }, { skip: !schoolId });
  const { data: pendingPaymentsData, isLoading: loadingPending } = useGetInstallmentsPendingPaymentsTotalQuery({ schoolId }, { skip: !schoolId });
  const { data: agentsData, isLoading: loadingAgents } = useGetAllAgentsQuery({ schoolId, pageNumber: 1, pageSize: 100 }, { skip: !schoolId });

  const activeParentsCount = activeParentsData?.data?.totalActiveParents ?? 0;
  const pendingPaymentsTotal = pendingPaymentsData?.data?.totalPendingAmount ?? 0;
  const agents = agentsData?.data ?? [];

  const isLoading = loadingParents || loadingPending || loadingAgents;

  // Extract user name parts from the full name
  const nameParts = (user?.name || '').split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  return (
    <ScreenContainer>
      {/* Welcome Header */}
      <AnimatedSection index={0}>
        <View style={styles.welcomeRow}>
          <View style={styles.welcomeTextBlock}>
            <ThemedText variant="bodySmall" color={theme.colors.textSecondary}>
              {t('common.welcome', 'Welcome back')}
            </ThemedText>
            <ThemedText variant="h2">
              {user?.name || ''}
            </ThemedText>
            <ThemedText variant="caption" color={theme.colors.textTertiary}>
              {user?.role || ''}
            </ThemedText>
          </View>
          <Avatar
            firstName={firstName}
            lastName={lastName}
            size="lg"
          />
        </View>
      </AnimatedSection>

      {/* KPI Row */}
      <AnimatedSection index={1}>
        {isLoading ? (
          <View style={styles.kpiRow}>
            <LoadingSkeleton width={160} height={100} borderRadius={16} />
            <View style={{ width: theme.spacing.md }} />
            <LoadingSkeleton width={160} height={100} borderRadius={16} />
            <View style={{ width: theme.spacing.md }} />
            <LoadingSkeleton width={160} height={100} borderRadius={16} />
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.kpiRow}
          >
            <KPIStatCard
              title={t('manager.activeParents', 'Active Parents')}
              value={String(activeParentsCount)}
              icon="people"
              color={theme.colors.primary}
              index={0}
            />
            <View style={{ width: theme.spacing.md }} />
            <KPIStatCard
              title={t('manager.pendingPayments', 'Pending Payments')}
              value={formatCurrency(pendingPaymentsTotal)}
              icon="time"
              color={theme.colors.warning}
              index={1}
            />
            <View style={{ width: theme.spacing.md }} />
            <KPIStatCard
              title={t('manager.totalAgents', 'Active Agents')}
              value={String(agents.length)}
              icon="people"
              color={theme.colors.success}
              index={2}
            />
          </ScrollView>
        )}
      </AnimatedSection>

      {/* Agents Overview */}
      <AnimatedSection index={2}>
        <SectionHeader
          title={t('manager.agentsOverview', 'Agents Overview')}
          action={t('common.viewAll', 'View All')}
          onAction={() => router.push('/(app)/agents')}
          style={styles.sectionSpacing}
        />
        {loadingAgents ? (
          <>
            <LoadingSkeleton width="100%" height={64} borderRadius={12} style={{ marginBottom: 8 }} />
            <LoadingSkeleton width="100%" height={64} borderRadius={12} style={{ marginBottom: 8 }} />
            <LoadingSkeleton width="100%" height={64} borderRadius={12} style={{ marginBottom: 8 }} />
          </>
        ) : (
          agents.slice(0, 3).map((agent) => (
            <ThemedCard
              key={agent.collectingAgentId}
              variant="elevated"
              style={styles.agentCard}
            >
              <View style={styles.agentRow}>
                <Avatar
                  firstName={agent.firstName}
                  lastName={agent.lastName}
                  size="md"
                />
                <View style={styles.agentInfo}>
                  <ThemedText
                    variant="bodySmall"
                    style={{ fontWeight: '600' }}
                  >
                    {agent.firstName} {agent.lastName}
                  </ThemedText>
                  <ThemedText
                    variant="caption"
                    color={theme.colors.textSecondary}
                  >
                    {agent.commissionPercentage}%{' '}
                    {t('agent.commission', 'commission')}
                  </ThemedText>
                </View>
                <View style={styles.agentRate}>
                  <ThemedText
                    variant="caption"
                    color={theme.colors.textSecondary}
                  >
                    {agent.phoneNumber}
                  </ThemedText>
                </View>
              </View>
            </ThemedCard>
          ))
        )}
      </AnimatedSection>

      {/* Quick Actions */}
      <AnimatedSection index={4}>
        <SectionHeader
          title={t('manager.quickActions', 'Quick Actions')}
          style={styles.sectionSpacing}
        />
        <View style={styles.quickActionsRow}>
          <ThemedButton
            title={t('manager.addParent', 'Add Parent')}
            onPress={() => router.push('/(app)/parents')}
            variant="primary"
            size="md"
            icon={<Ionicons name="person-add" size={18} color="#FFFFFF" />}
            style={styles.quickActionBtn}
          />
          <ThemedButton
            title={t('manager.reviewPayments', 'Review Payments')}
            onPress={() => router.push('/(app)/reports')}
            variant="secondary"
            size="md"
            icon={
              <Ionicons
                name="card"
                size={18}
                color={theme.colors.primary}
              />
            }
            style={styles.quickActionBtn}
          />
        </View>
        <ThemedButton
          title={t('manager.viewAgents', 'View Agents')}
          onPress={() => router.push('/(app)/agents')}
          variant="ghost"
          size="md"
          fullWidth
          icon={
            <Ionicons
              name="people"
              size={18}
              color={theme.colors.primary}
            />
          }
        />
      </AnimatedSection>

      <View style={{ height: 32 }} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  welcomeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 8,
  },
  welcomeTextBlock: {
    flex: 1,
    marginRight: 16,
  },
  kpiRow: {
    paddingVertical: 4,
    paddingRight: 16,
  },
  sectionSpacing: {
    marginTop: 24,
  },
  agentCard: {
    marginBottom: 8,
  },
  agentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  agentInfo: {
    flex: 1,
    marginLeft: 12,
  },
  agentRate: {
    alignItems: 'flex-end',
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  quickActionBtn: {
    flex: 1,
  },
});
