import React, { useState } from 'react';
import { View, StyleSheet, Pressable, ScrollView } from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';

import {
  ScreenContainer,
  ThemedText,
  ThemedCard,
  ThemedButton,
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
} from '../../services/api/apiSlice';
import { formatCurrency } from '../../utils';

// ---------------------------------------------------------------------------
// Types & Mock Data (placeholders for chart endpoints not yet available)
// ---------------------------------------------------------------------------

type PeriodKey = 'week' | 'month' | 'quarter' | 'year';

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'quarter', label: 'This Quarter' },
  { key: 'year', label: 'This Year' },
];

const MOCK_TREND_BARS = [
  { month: 'Jan', value: 0.55 },
  { month: 'Feb', value: 0.68 },
  { month: 'Mar', value: 0.62 },
  { month: 'Apr', value: 0.78 },
  { month: 'May', value: 0.72 },
  { month: 'Jun', value: 0.88 },
];

const MOCK_AGENT_COLLECTIONS = [
  { name: 'Pierre K.', collected: 35, total: 45 },
  { name: 'Marie L.', collected: 30, total: 38 },
  { name: 'Joseph M.', collected: 15, total: 22 },
  { name: 'Claire B.', collected: 8, total: 15 },
];

const MOCK_PAYMENT_METHODS = [
  { method: 'Mobile Money', percentage: 55, color: '#4B49AC' },
  { method: 'Bank Transfer', percentage: 25, color: '#7DA0FA' },
  { method: 'Cash', percentage: 15, color: '#F3797E' },
  { method: 'Other', percentage: 5, color: '#D1D5DB' },
];

// ---------------------------------------------------------------------------
// PeriodChip
// ---------------------------------------------------------------------------

interface PeriodChipProps {
  label: string;
  active: boolean;
  onPress: () => void;
}

const PeriodChip: React.FC<PeriodChipProps> = ({ label, active, onPress }) => {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.periodChip,
        {
          backgroundColor: active ? theme.colors.primary : theme.colors.surface,
          borderColor: active ? theme.colors.primary : theme.colors.borderLight,
          borderRadius: theme.borderRadius.full,
        },
      ]}
    >
      <ThemedText
        variant="caption"
        color={active ? '#FFFFFF' : theme.colors.textSecondary}
        style={styles.periodTxt}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
};

// ---------------------------------------------------------------------------
// ReportsScreen
// ---------------------------------------------------------------------------

const ReportsScreen: React.FC = () => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { isSmallDevice, isTablet } = useResponsive();

  const user = useAppSelector((state) => state.auth.user);
  const schoolId = parseInt(user?.schoolId || '0');

  const [period, setPeriod] = useState<PeriodKey>('month');

  // API queries for KPIs
  const { data: studentCountRes, isLoading: studentCountLoading } = useGetStudentCountBySchoolQuery({ schoolId }, { skip: !schoolId });
  const { data: pendingRes, isLoading: pendingLoading } = useGetInstallmentsPendingPaymentsTotalQuery({ schoolId }, { skip: !schoolId });
  const { data: parentsRes, isLoading: parentsLoading } = useGetTotalActiveParentInSchoolQuery({ schoolId }, { skip: !schoolId });

  const isKpiLoading = studentCountLoading || pendingLoading || parentsLoading;

  const kpiData = [
    { title: 'Active Parents', value: (parentsRes?.data?.totalActiveParents ?? 0).toLocaleString(), icon: 'trending-up' as const, trend: 'up' as const, trendValue: '--' },
    { title: 'Pending Payments', value: formatCurrency(pendingRes?.data?.totalPendingAmount ?? 0), icon: 'wallet' as const, trend: 'up' as const, trendValue: '--' },
    { title: 'Total Students', value: (studentCountRes?.data?.totalStudents ?? 0).toLocaleString(), icon: 'people' as const, trend: 'up' as const, trendValue: '--' },
    { title: 'Pending Count', value: (pendingRes?.data?.totalPendingCount ?? 0).toLocaleString(), icon: 'alert-circle' as const, trend: 'down' as const, trendValue: '--' },
  ];

  const headerAnim = useAnimatedEntry({ type: 'slideUp', delay: staggerDelay(0) });
  const periodAnim = useAnimatedEntry({ type: 'fadeIn', delay: staggerDelay(1) });
  const trendAnim = useAnimatedEntry({ type: 'slideUp', delay: staggerDelay(5) });
  const agentAnim = useAnimatedEntry({ type: 'slideUp', delay: staggerDelay(6) });
  const methodAnim = useAnimatedEntry({ type: 'slideUp', delay: staggerDelay(7) });
  const exportAnim = useAnimatedEntry({ type: 'fadeIn', delay: staggerDelay(8) });

  const kpiColors = [
    theme.colors.success,
    theme.colors.secondary,
    theme.colors.primary,
    theme.colors.error,
  ];

  return (
    <ScreenContainer>
      {/* Header */}
      <Animated.View style={[styles.headerRow, headerAnim]}>
        <ThemedText variant="h1">{t('director.reports.title', 'Reports')}</ThemedText>
      </Animated.View>

      {/* Period selector */}
      <Animated.View style={[styles.periodRow, periodAnim]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.periodScroll}>
          {PERIODS.map((p) => (
            <PeriodChip
              key={p.key}
              label={t(`director.reports.period.${p.key}`, p.label)}
              active={period === p.key}
              onPress={() => setPeriod(p.key)}
            />
          ))}
        </ScrollView>
      </Animated.View>

      {/* KPI summary */}
      {isKpiLoading ? (
        <ScreenSkeleton />
      ) : (
      <View style={styles.kpiGrid}>
        {kpiData.map((kpi, index) => (
          <View key={kpi.title} style={[styles.kpiCell, isTablet && styles.kpiCellTablet]}>
            <KPIStatCard
              title={t(`director.reports.kpi.${index}`, kpi.title)}
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
      )}

      {/* Payment Trends - Bar chart */}
      <Animated.View style={trendAnim}>
        <SectionHeader title={t('director.reports.paymentTrends', 'Payment Trends')} />
        <ThemedCard variant="elevated" style={styles.chartCard}>
          <View style={styles.barsContainer}>
            {MOCK_TREND_BARS.map((bar) => (
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

      {/* Collection by Agent - Horizontal progress bars */}
      <Animated.View style={agentAnim}>
        <SectionHeader
          title={t('director.reports.collectionByAgent', 'Collection by Agent')}
          style={styles.sectionTop}
        />
        <ThemedCard variant="elevated" style={styles.chartCard}>
          {MOCK_AGENT_COLLECTIONS.map((agent) => {
            const pct = (agent.collected / agent.total) * 100;
            return (
              <View key={agent.name} style={styles.agentRow}>
                <ThemedText variant="bodySmall" style={styles.agentName}>
                  {agent.name}
                </ThemedText>
                <View style={styles.agentBarBg}>
                  <View
                    style={[
                      styles.agentBarFill,
                      {
                        width: `${pct}%`,
                        backgroundColor: theme.colors.primary,
                        borderRadius: theme.borderRadius.xs,
                      },
                    ]}
                  />
                </View>
                <ThemedText variant="caption" color={theme.colors.textSecondary} style={styles.agentPct}>
                  {Math.round(pct)}%
                </ThemedText>
              </View>
            );
          })}
        </ThemedCard>
      </Animated.View>

      {/* Payment Methods - Stacked bar */}
      <Animated.View style={methodAnim}>
        <SectionHeader
          title={t('director.reports.paymentMethods', 'Payment Methods')}
          style={styles.sectionTop}
        />
        <ThemedCard variant="elevated" style={styles.chartCard}>
          {/* Stacked horizontal bar */}
          <View style={[styles.stackedBar, { borderRadius: theme.borderRadius.sm, overflow: 'hidden' }]}>
            {MOCK_PAYMENT_METHODS.map((pm) => (
              <View
                key={pm.method}
                style={[styles.stackedSegment, { width: `${pm.percentage}%`, backgroundColor: pm.color }]}
              />
            ))}
          </View>
          {/* Legend */}
          <View style={styles.legend}>
            {MOCK_PAYMENT_METHODS.map((pm) => (
              <View key={pm.method} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: pm.color }]} />
                <ThemedText variant="caption" color={theme.colors.textSecondary}>
                  {pm.method} ({pm.percentage}%)
                </ThemedText>
              </View>
            ))}
          </View>
        </ThemedCard>
      </Animated.View>

      {/* Export button */}
      <Animated.View style={[styles.exportRow, exportAnim]}>
        <ThemedButton
          title={t('director.reports.downloadReport', 'Download Report')}
          onPress={() => {}}
          variant="secondary"
          size="lg"
          fullWidth
          icon={<Ionicons name="download-outline" size={20} color={theme.colors.primary} />}
        />
      </Animated.View>
    </ScreenContainer>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  headerRow: { marginTop: 8, marginBottom: 8 },

  periodRow: { marginBottom: 16 },
  periodScroll: { gap: 8 },
  periodChip: { paddingHorizontal: 16, paddingVertical: 6, borderWidth: 1 },
  periodTxt: { fontWeight: '600' },

  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
    marginBottom: 24,
  },
  kpiCell: { width: '50%', paddingHorizontal: 6, marginBottom: 12 },
  kpiCellTablet: { width: '25%' },

  chartCard: { marginBottom: 16 },
  barsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 120,
  },
  barCol: { flex: 1, alignItems: 'center' },
  barTrack: { width: 20, height: '100%', justifyContent: 'flex-end' },
  barFill: { width: '100%' },
  barLabel: { marginTop: 8 },

  sectionTop: { marginTop: 8 },

  agentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  agentName: { width: 80 },
  agentBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 4,
    overflow: 'hidden',
    marginHorizontal: 8,
  },
  agentBarFill: { height: '100%' },
  agentPct: { width: 36, textAlign: 'right' },

  stackedBar: {
    flexDirection: 'row',
    height: 24,
    marginBottom: 16,
  },
  stackedSegment: { height: '100%' },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },

  exportRow: { marginTop: 8, marginBottom: 16 },
});

export default ReportsScreen;
