import React, { useMemo } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';

import {
  ScreenContainer,
  ThemedText,
  ThemedCard,
  SectionHeader,
  KPIStatCard,
  ScreenSkeleton,
} from '../../components';
import { useTheme } from '../../theme';
import { useAnimatedEntry, staggerDelay, useResponsive } from '../../hooks';
import { useAppSelector } from '../../store/store';
import {
  useGetStudentCountBySchoolQuery,
  useGetInstallmentsPendingPaymentsTotalQuery,
  useGetTotalActiveParentInSchoolQuery,
  useGetSchoolDetailsQuery,
  useGetSchoolPaymentTrendQuery,
  useGetPendingChildrenQuery,
} from '../../services/api/apiSlice';
import { formatCurrency, formatDate } from '../../utils';

const QUICK_ACTIONS = [
  {
    key: 'students',
    label: 'Review Students',
    icon: 'school-outline' as const,
    route: '/(app)/students',
  },
  {
    key: 'agents',
    label: 'Manage Agents',
    icon: 'people-outline' as const,
    route: '/(app)/agents',
  },
  {
    key: 'reports',
    label: 'Open Reports',
    icon: 'bar-chart-outline' as const,
    route: '/(app)/reports',
  },
];

const DirectorDashboard: React.FC = () => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { isTablet } = useResponsive();

  const user = useAppSelector((state) => state.auth.user);
  const schoolId = parseInt((user?.schoolId ?? '0').split(',')[0], 10);

  const { data: schoolRes, isLoading: schoolLoading } = useGetSchoolDetailsQuery(
    { schoolId },
    { skip: !schoolId },
  );
  const { data: studentCountRes, isLoading: studentCountLoading } =
    useGetStudentCountBySchoolQuery({ schoolId }, { skip: !schoolId });
  const { data: pendingRes, isLoading: pendingLoading } =
    useGetInstallmentsPendingPaymentsTotalQuery({ schoolId }, { skip: !schoolId });
  const { data: parentsRes, isLoading: parentsLoading } =
    useGetTotalActiveParentInSchoolQuery({ schoolId }, { skip: !schoolId });
  const { data: trendRes, isLoading: trendLoading } = useGetSchoolPaymentTrendQuery(
    { schoolId, period: 'month' },
    { skip: !schoolId },
  );
  const { data: pendingChildrenRes, isLoading: pendingChildrenLoading } =
    useGetPendingChildrenQuery({ schoolId, pageNumber: 1, pageSize: 4 }, { skip: !schoolId });

  const isLoading =
    schoolLoading ||
    studentCountLoading ||
    pendingLoading ||
    parentsLoading ||
    trendLoading ||
    pendingChildrenLoading;

  const schoolName = schoolRes?.data?.schoolName || '';
  const schoolInitial = schoolName
    ? schoolName
        .split(' ')
        .map((word: string) => word[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : '';

  const kpiData = [
    {
      title: 'Total Students',
      value: (studentCountRes?.data?.totalStudents ?? 0).toLocaleString(),
      icon: 'people' as const,
      trend: 'up' as const,
      trendValue: '--',
    },
    {
      title: 'Active Parents',
      value: (parentsRes?.data?.totalActiveParents ?? 0).toLocaleString(),
      icon: 'trending-up' as const,
      trend: 'up' as const,
      trendValue: '--',
    },
    {
      title: 'Pending Payments',
      value: formatCurrency(pendingRes?.data?.totalPendingAmount ?? 0),
      icon: 'alert-circle' as const,
      trend: 'down' as const,
      trendValue: '--',
    },
    {
      title: 'Pending Count',
      value: (pendingRes?.data?.totalPendingCount ?? 0).toLocaleString(),
      icon: 'wallet' as const,
      trend: 'up' as const,
      trendValue: '--',
    },
  ];

  const trendPoints = trendRes?.data ?? [];
  const maxTrendAmount = useMemo(
    () => trendPoints.reduce((max, point) => Math.max(max, point.totalAmount), 0),
    [trendPoints],
  );
  const pendingChildren = pendingChildrenRes?.data ?? [];

  const headerAnim = useAnimatedEntry({ type: 'slideUp', delay: staggerDelay(0) });
  const chartAnim = useAnimatedEntry({ type: 'slideUp', delay: staggerDelay(5) });
  const activityAnim = useAnimatedEntry({ type: 'slideUp', delay: staggerDelay(7) });
  const qaAnim = useAnimatedEntry({ type: 'fadeIn', delay: staggerDelay(9) });

  const kpiColors = [
    theme.colors.primary,
    theme.colors.success,
    theme.colors.secondary,
    theme.colors.error,
  ];

  if (isLoading) {
    return (
      <ScreenContainer>
        <ScreenSkeleton />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Animated.View style={[styles.header, headerAnim]}>
        <View style={styles.headerLeft}>
          <View
            style={[
              styles.schoolLogo,
              {
                backgroundColor: theme.colors.primary + '15',
                borderRadius: theme.borderRadius.lg,
              },
            ]}
          >
            <ThemedText variant="subtitle" color={theme.colors.primary}>
              {schoolInitial}
            </ThemedText>
          </View>
          <View style={styles.headerTextWrap}>
            <ThemedText variant="caption" color={theme.colors.textSecondary}>
              {t('director.dashboard.welcome', 'Welcome back,')}
            </ThemedText>
            <ThemedText variant="h2">{schoolName}</ThemedText>
          </View>
        </View>

        <Pressable
          onPress={() => router.push('/(app)/notifications')}
          style={[
            styles.headerAction,
            {
              backgroundColor: theme.colors.surface,
              borderRadius: theme.borderRadius.full,
            },
          ]}
        >
          <Ionicons name="notifications-outline" size={22} color={theme.colors.text} />
        </Pressable>
      </Animated.View>

      <View style={styles.kpiGrid}>
        {kpiData.map((kpi, index) => (
          <View key={kpi.title} style={[styles.kpiCell, isTablet && styles.kpiCellTablet]}>
            <KPIStatCard
              title={t(
                `director.dashboard.kpi.${kpi.title.toLowerCase().replace(/ /g, '')}`,
                kpi.title,
              )}
              value={kpi.value}
              icon={kpi.icon}
              trend={kpi.trend}
              trendValue={kpi.trendValue}
              color={kpiColors[index]}
              index={index}
            />
          </View>
        ))}
      </View>

      <Animated.View style={chartAnim}>
        <SectionHeader
          title={t('director.dashboard.monthlyRevenue', 'Monthly Revenue')}
          action={t('common.viewAll', 'View All')}
          onAction={() => router.push('/(app)/reports')}
        />
        <ThemedCard variant="elevated" style={styles.chartCard}>
          {trendPoints.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons
                name="bar-chart-outline"
                size={28}
                color={theme.colors.textTertiary}
              />
              <ThemedText variant="bodySmall" color={theme.colors.textSecondary}>
                {t('director.dashboard.noRevenueData', 'No processed payment data yet for this period.')}
              </ThemedText>
            </View>
          ) : (
            <View style={styles.barsContainer}>
              {trendPoints.map((bar) => {
                const fillHeight =
                  maxTrendAmount > 0 ? Math.max((bar.totalAmount / maxTrendAmount) * 100, 12) : 0;

                return (
                  <View key={bar.label} style={styles.barCol}>
                    <ThemedText
                      variant="caption"
                      color={theme.colors.textSecondary}
                      style={styles.barAmount}
                    >
                      {formatCurrency(bar.totalAmount)}
                    </ThemedText>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          {
                            height: `${fillHeight}%`,
                            backgroundColor: theme.colors.primary,
                            borderRadius: theme.borderRadius.xs,
                          },
                        ]}
                      />
                    </View>
                    <ThemedText
                      variant="caption"
                      color={theme.colors.textTertiary}
                      style={styles.barLabel}
                    >
                      {bar.label}
                    </ThemedText>
                    <ThemedText variant="caption" color={theme.colors.textTertiary}>
                      {bar.totalTransactions}
                    </ThemedText>
                  </View>
                );
              })}
            </View>
          )}
        </ThemedCard>
      </Animated.View>

      <Animated.View style={activityAnim}>
        <SectionHeader
          title={t('director.dashboard.pendingApprovals', 'Pending Approvals')}
          action={t('common.viewAll', 'View All')}
          onAction={() => router.push('/(app)/students')}
          style={styles.activitySection}
        />
        {pendingChildren.length === 0 ? (
          <ThemedCard variant="outlined" style={styles.activityCard}>
            <View style={styles.emptyState}>
              <Ionicons
                name="checkmark-circle-outline"
                size={28}
                color={theme.colors.success}
              />
              <ThemedText variant="bodySmall" color={theme.colors.textSecondary}>
                {t('director.dashboard.noPendingApprovals', 'No child approvals are waiting right now.')}
              </ThemedText>
            </View>
          </ThemedCard>
        ) : (
          pendingChildren.map((child) => (
            <ThemedCard
              key={child.childId}
              variant="outlined"
              style={styles.activityCard}
              onPress={() => router.push('/(app)/students')}
            >
              <View style={styles.activityRow}>
                <View
                  style={[
                    styles.activityIcon,
                    {
                      backgroundColor: theme.colors.primaryLight + '15',
                      borderRadius: theme.borderRadius.md,
                    },
                  ]}
                >
                  <Ionicons name="time-outline" size={18} color={theme.colors.primary} />
                </View>
                <View style={styles.activityContent}>
                  <ThemedText variant="bodySmall" numberOfLines={2}>
                    {child.firstName} {child.lastName}
                  </ThemedText>
                  <ThemedText variant="caption" color={theme.colors.textSecondary}>
                    {child.fatherName
                      ? t('director.dashboard.parentName', 'Parent/Father') + `: ${child.fatherName}`
                      : t('director.dashboard.approvalRequested', 'Awaiting director approval')}
                  </ThemedText>
                  <ThemedText variant="caption" color={theme.colors.textTertiary}>
                    {child.createdOn
                      ? formatDate(child.createdOn)
                      : t('director.dashboard.reviewSoon', 'Review needed')}
                  </ThemedText>
                </View>
              </View>
            </ThemedCard>
          ))
        )}
      </Animated.View>

      <Animated.View style={qaAnim}>
        <SectionHeader
          title={t('director.dashboard.quickActions', 'Quick Actions')}
          style={styles.qaSection}
        />
        <View style={styles.qaRow}>
          {QUICK_ACTIONS.map((action, index) => (
            <ThemedCard
              key={action.key}
              variant="elevated"
              onPress={() => router.push(action.route)}
              style={styles.qaCard}
            >
              <View
                style={[
                  styles.qaIcon,
                  {
                    backgroundColor: theme.colors.primary + '15',
                    borderRadius: theme.borderRadius.md,
                  },
                ]}
              >
                <Ionicons name={action.icon} size={22} color={theme.colors.primary} />
              </View>
              <ThemedText variant="caption" align="center" style={styles.qaLabel}>
                {t(`director.dashboard.qa.${index}`, action.label)}
              </ThemedText>
            </ThemedCard>
          ))}
        </View>
      </Animated.View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    marginTop: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerAction: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 16,
  },
  schoolLogo: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextWrap: {
    marginLeft: 12,
    flex: 1,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
    marginBottom: 24,
  },
  kpiCell: {
    width: '50%',
    paddingHorizontal: 6,
    marginBottom: 12,
  },
  kpiCellTablet: {
    width: '25%',
  },
  chartCard: {
    marginBottom: 24,
  },
  barsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    minHeight: 182,
    gap: 8,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
  },
  barAmount: {
    marginBottom: 8,
    textAlign: 'center',
  },
  barTrack: {
    width: 28,
    height: 92,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 999,
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
  },
  barLabel: {
    marginTop: 8,
  },
  activitySection: {
    marginTop: 8,
  },
  activityCard: {
    marginBottom: 8,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  qaSection: {
    marginTop: 16,
  },
  qaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  qaCard: {
    flex: 1,
    marginHorizontal: 4,
    alignItems: 'center',
    paddingVertical: 16,
  },
  qaIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  qaLabel: {
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 18,
  },
});

export default DirectorDashboard;
