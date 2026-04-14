import React from 'react';
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
  Avatar,
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
} from '../../services/api/apiSlice';
import { formatCurrency } from '../../utils';

// ---------------------------------------------------------------------------
// Mock Data (placeholders for endpoints not yet available)
// ---------------------------------------------------------------------------

const MOCK_REVENUE_BARS = [
  { month: 'Jan', value: 0.65 },
  { month: 'Feb', value: 0.72 },
  { month: 'Mar', value: 0.58 },
  { month: 'Apr', value: 0.85 },
  { month: 'May', value: 0.78 },
  { month: 'Jun', value: 0.91 },
];

const MOCK_ACTIVITIES = [
  { id: '1', icon: 'card-outline' as const, description: 'Payment received from Jean Mukendi', time: '2h ago' },
  { id: '2', icon: 'person-add-outline' as const, description: 'New child enrolled: Grace Lualaba', time: '5h ago' },
  { id: '3', icon: 'people-outline' as const, description: 'Agent Pierre Kabila assigned 8 new parents', time: '1d ago' },
  { id: '4', icon: 'card-outline' as const, description: 'Payment received from Marie Tshisekedi', time: '1d ago' },
];

const MOCK_QUICK_ACTIONS = [
  { label: 'Add Student', icon: 'person-add-outline' as const },
  { label: 'Manage Agents', icon: 'people-outline' as const },
  { label: 'View Reports', icon: 'bar-chart-outline' as const },
];

// ---------------------------------------------------------------------------
// DirectorDashboard
// ---------------------------------------------------------------------------

const DirectorDashboard: React.FC = () => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { isSmallDevice, isTablet } = useResponsive();

  const user = useAppSelector((state) => state.auth.user);
  const schoolId = parseInt(user?.schoolId || '0');

  // API queries
  const { data: schoolRes, isLoading: schoolLoading } = useGetSchoolDetailsQuery({ schoolId }, { skip: !schoolId });
  const { data: studentCountRes, isLoading: studentCountLoading } = useGetStudentCountBySchoolQuery({ schoolId }, { skip: !schoolId });
  const { data: pendingRes, isLoading: pendingLoading } = useGetInstallmentsPendingPaymentsTotalQuery({ schoolId }, { skip: !schoolId });
  const { data: parentsRes, isLoading: parentsLoading } = useGetTotalActiveParentInSchoolQuery({ schoolId }, { skip: !schoolId });

  const isKpiLoading = studentCountLoading || pendingLoading || parentsLoading;

  const schoolName = schoolRes?.data?.schoolName || '';
  const schoolInitial = schoolName ? schoolName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() : '';

  const kpiData = [
    { title: 'Total Students', value: (studentCountRes?.data?.totalStudents ?? 0).toLocaleString(), icon: 'people' as const, trend: 'up' as const, trendValue: '--' },
    { title: 'Active Parents', value: (parentsRes?.data?.totalActiveParents ?? 0).toLocaleString(), icon: 'trending-up' as const, trend: 'up' as const, trendValue: '--' },
    { title: 'Pending Payments', value: formatCurrency(pendingRes?.data?.totalPendingAmount ?? 0), icon: 'alert-circle' as const, trend: 'down' as const, trendValue: '--' },
    { title: 'Pending Count', value: (pendingRes?.data?.totalPendingCount ?? 0).toLocaleString(), icon: 'wallet' as const, trend: 'up' as const, trendValue: '--' },
  ];

  const headerAnim = useAnimatedEntry({ type: 'slideUp', delay: staggerDelay(0) });
  const chartAnim = useAnimatedEntry({ type: 'slideUp', delay: staggerDelay(5) });
  const activityAnim = useAnimatedEntry({ type: 'slideUp', delay: staggerDelay(7) });
  const qaAnim = useAnimatedEntry({ type: 'fadeIn', delay: staggerDelay(9) });

  // Assign semantic colors to KPIs
  const kpiColors = [
    theme.colors.primary,
    theme.colors.success,
    theme.colors.secondary,
    theme.colors.error,
  ];

  if (schoolLoading || isKpiLoading) {
    return (
      <ScreenContainer>
        <ScreenSkeleton />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      {/* Welcome Header */}
      <Animated.View style={[styles.header, headerAnim]}>
        <View style={styles.headerLeft}>
          <View
            style={[
              styles.schoolLogo,
              { backgroundColor: theme.colors.primary + '15', borderRadius: theme.borderRadius.lg },
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
      </Animated.View>

      {/* KPI Grid */}
      <View style={styles.kpiGrid}>
        {kpiData.map((kpi, index) => (
          <View key={kpi.title} style={[styles.kpiCell, isTablet && styles.kpiCellTablet]}>
            <KPIStatCard
              title={t(`director.dashboard.kpi.${kpi.title.toLowerCase().replace(/ /g, '')}`, kpi.title)}
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

      {/* Revenue Chart Placeholder */}
      <Animated.View style={chartAnim}>
        <SectionHeader title={t('director.dashboard.monthlyRevenue', 'Monthly Revenue')} />
        <ThemedCard variant="elevated" style={styles.chartCard}>
          <View style={styles.barsContainer}>
            {MOCK_REVENUE_BARS.map((bar) => (
              <View key={bar.month} style={styles.barCol}>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        height: `${bar.value * 100}%`,
                        backgroundColor: theme.colors.primary,
                        borderRadius: theme.borderRadius.xs,
                      },
                    ]}
                  />
                </View>
                <ThemedText variant="caption" color={theme.colors.textTertiary} style={styles.barLabel}>
                  {bar.month}
                </ThemedText>
              </View>
            ))}
          </View>
        </ThemedCard>
      </Animated.View>

      {/* Recent Activity */}
      <Animated.View style={activityAnim}>
        <SectionHeader
          title={t('director.dashboard.recentActivity', 'Recent Activity')}
          style={styles.activitySection}
        />
        {MOCK_ACTIVITIES.map((activity) => (
          <ThemedCard key={activity.id} variant="outlined" style={styles.activityCard}>
            <View style={styles.activityRow}>
              <View
                style={[
                  styles.activityIcon,
                  { backgroundColor: theme.colors.primaryLight + '15', borderRadius: theme.borderRadius.md },
                ]}
              >
                <Ionicons name={activity.icon} size={18} color={theme.colors.primary} />
              </View>
              <View style={styles.activityContent}>
                <ThemedText variant="bodySmall" numberOfLines={2}>
                  {activity.description}
                </ThemedText>
                <ThemedText variant="caption" color={theme.colors.textTertiary}>
                  {activity.time}
                </ThemedText>
              </View>
            </View>
          </ThemedCard>
        ))}
      </Animated.View>

      {/* Quick Actions */}
      <Animated.View style={qaAnim}>
        <SectionHeader
          title={t('director.dashboard.quickActions', 'Quick Actions')}
          style={styles.qaSection}
        />
        <View style={styles.qaRow}>
          {MOCK_QUICK_ACTIONS.map((qa, idx) => (
            <ThemedCard key={qa.label} variant="elevated" onPress={() => {}} style={styles.qaCard}>
              <View
                style={[
                  styles.qaIcon,
                  { backgroundColor: theme.colors.primary + '15', borderRadius: theme.borderRadius.md },
                ]}
              >
                <Ionicons name={qa.icon} size={22} color={theme.colors.primary} />
              </View>
              <ThemedText variant="caption" align="center" style={styles.qaLabel}>
                {t(`director.dashboard.qa.${idx}`, qa.label)}
              </ThemedText>
            </ThemedCard>
          ))}
        </View>
      </Animated.View>
    </ScreenContainer>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 8,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  schoolLogo: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextWrap: { marginLeft: 12, flex: 1 },

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

  chartCard: { marginBottom: 24 },
  barsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 140,
  },
  barCol: { flex: 1, alignItems: 'center' },
  barTrack: {
    width: 24,
    height: '100%',
    justifyContent: 'flex-end',
  },
  barFill: {
    width: '100%',
  },
  barLabel: { marginTop: 8 },

  activitySection: { marginTop: 8 },
  activityCard: { marginBottom: 8 },
  activityRow: { flexDirection: 'row', alignItems: 'center' },
  activityIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityContent: { flex: 1 },

  qaSection: { marginTop: 16 },
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
  qaLabel: { fontWeight: '600' },
});

export default DirectorDashboard;
