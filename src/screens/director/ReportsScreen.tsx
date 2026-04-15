import React, { useMemo, useState } from 'react';
import { View, StyleSheet, Pressable, ScrollView, Share } from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

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
  useGetSchoolPaymentTrendQuery,
  useGetSchoolAgentCollectionSummaryQuery,
  useGetSchoolPaymentMethodBreakdownQuery,
} from '../../services/api/apiSlice';
import { formatCurrency } from '../../utils';
import type { ReportPeriod } from '../../types';

const PERIODS: { key: ReportPeriod; label: string }[] = [
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'quarter', label: 'This Quarter' },
  { key: 'year', label: 'This Year' },
];

const PeriodChip: React.FC<{
  label: string;
  active: boolean;
  onPress: () => void;
}> = ({ label, active, onPress }) => {
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

const ReportsScreen: React.FC = () => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { isTablet } = useResponsive();

  const user = useAppSelector((state) => state.auth.user);
  const schoolId = parseInt((user?.schoolId ?? '0').split(',')[0], 10);
  const [period, setPeriod] = useState<ReportPeriod>('month');

  const { data: studentCountRes, isLoading: studentCountLoading } =
    useGetStudentCountBySchoolQuery({ schoolId }, { skip: !schoolId });
  const { data: pendingRes, isLoading: pendingLoading } =
    useGetInstallmentsPendingPaymentsTotalQuery({ schoolId }, { skip: !schoolId });
  const { data: parentsRes, isLoading: parentsLoading } =
    useGetTotalActiveParentInSchoolQuery({ schoolId }, { skip: !schoolId });
  const { data: trendRes, isLoading: trendLoading } = useGetSchoolPaymentTrendQuery(
    { schoolId, period },
    { skip: !schoolId },
  );
  const { data: agentSummaryRes, isLoading: agentLoading } =
    useGetSchoolAgentCollectionSummaryQuery({ schoolId, period }, { skip: !schoolId });
  const { data: methodBreakdownRes, isLoading: methodLoading } =
    useGetSchoolPaymentMethodBreakdownQuery({ schoolId, period }, { skip: !schoolId });

  const isLoading =
    studentCountLoading ||
    pendingLoading ||
    parentsLoading ||
    trendLoading ||
    agentLoading ||
    methodLoading;

  const trendPoints = trendRes?.data ?? [];
  const agentCollections = (agentSummaryRes?.data ?? []).slice(0, 5);
  const paymentMethods = methodBreakdownRes?.data ?? [];

  const maxTrendAmount = useMemo(
    () => trendPoints.reduce((max, point) => Math.max(max, point.totalAmount), 0),
    [trendPoints],
  );

  const totalCollected = useMemo(
    () => trendPoints.reduce((sum, point) => sum + point.totalAmount, 0),
    [trendPoints],
  );

  const kpiData = [
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
      icon: 'wallet' as const,
      trend: 'up' as const,
      trendValue: '--',
    },
    {
      title: 'Total Students',
      value: (studentCountRes?.data?.totalStudents ?? 0).toLocaleString(),
      icon: 'people' as const,
      trend: 'up' as const,
      trendValue: '--',
    },
    {
      title: 'Pending Count',
      value: (pendingRes?.data?.totalPendingCount ?? 0).toLocaleString(),
      icon: 'alert-circle' as const,
      trend: 'down' as const,
      trendValue: '--',
    },
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

  const buildMethodColor = (paymentMethod: string, index: number) => {
    const normalized = paymentMethod.toLowerCase();

    if (normalized.includes('airtel') || normalized.includes('mobile')) {
      return theme.colors.primary;
    }

    if (normalized.includes('bank') || normalized.includes('transfer')) {
      return theme.colors.secondary;
    }

    if (normalized.includes('cash')) {
      return theme.colors.warning;
    }

    if (normalized.includes('card')) {
      return theme.colors.success;
    }

    const fallbackColors = [
      theme.colors.primary,
      theme.colors.secondary,
      theme.colors.warning,
      theme.colors.success,
    ];

    return fallbackColors[index % fallbackColors.length];
  };

  const handleDownloadReport = async () => {
    const selectedPeriod = t(`director.reports.period.${period}`, period);
    const summaryLines = [
      t('director.reports.export.title', 'EduFrais Report'),
      `${t('director.reports.export.period', 'Period')}: ${selectedPeriod}`,
      `${t('director.reports.export.students', 'Students')}: ${(studentCountRes?.data?.totalStudents ?? 0).toLocaleString()}`,
      `${t('director.reports.export.activeParents', 'Active parents')}: ${(parentsRes?.data?.totalActiveParents ?? 0).toLocaleString()}`,
      `${t('director.reports.export.pendingPayments', 'Pending payments')}: ${formatCurrency(pendingRes?.data?.totalPendingAmount ?? 0)}`,
      `${t('director.reports.export.pendingInstallments', 'Pending installments')}: ${(pendingRes?.data?.totalPendingCount ?? 0).toLocaleString()}`,
      `${t('director.reports.export.collectedInPeriod', 'Collected in period')}: ${formatCurrency(totalCollected)}`,
      '',
      `${t('director.reports.export.paymentTrend', 'Payment trend')}:`,
      ...(trendPoints.length > 0
        ? trendPoints.map(
          (point) =>
            `- ${point.label}: ${formatCurrency(point.totalAmount)} (${point.totalTransactions} ${t('director.reports.export.transactions', 'transactions')})`,
        )
        : [`- ${t('director.reports.export.noPayments', 'No processed payments recorded')}`]),
      '',
      `${t('director.reports.export.topAgents', 'Top agents')}:`,
      ...(agentCollections.length > 0
        ? agentCollections.map(
          (agent) =>
            `- ${agent.agentName}: ${formatCurrency(agent.totalCollectedAmount)} (${Math.round(agent.sharePercentage)}%)`,
        )
        : [`- ${t('director.reports.export.noAgentCollections', 'No agent collections recorded')}`]),
      '',
      `${t('director.reports.export.paymentMethods', 'Payment methods')}:`,
      ...(paymentMethods.length > 0
        ? paymentMethods.map(
          (method) =>
            `- ${method.paymentMethod}: ${formatCurrency(method.totalAmount)} (${Math.round(method.percentage)}%)`,
        )
        : [`- ${t('director.reports.export.noPaymentMethods', 'No payment method activity recorded')}`]),
    ];

    await Share.share({
      title: t('director.reports.title', 'Reports'),
      message: summaryLines.join('\n'),
    });
  };

  if (isLoading) {
    return (
      <ScreenContainer>
        <ScreenSkeleton />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Animated.View style={[styles.headerRow, headerAnim]}>
        <ThemedText variant="h1">{t('director.reports.title', 'Reports')}</ThemedText>
      </Animated.View>

      <Animated.View style={[styles.periodRow, periodAnim]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.periodScroll}
        >
          {PERIODS.map((item) => (
            <PeriodChip
              key={item.key}
              label={t(`director.reports.period.${item.key}`, item.label)}
              active={period === item.key}
              onPress={() => setPeriod(item.key)}
            />
          ))}
        </ScrollView>
      </Animated.View>

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

      <Animated.View style={trendAnim}>
        <SectionHeader title={t('director.reports.paymentTrends', 'Payment Trends')} />
        <ThemedCard variant="elevated" style={styles.chartCard}>
          {trendPoints.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="bar-chart-outline" size={28} color={theme.colors.textTertiary} />
              <ThemedText variant="bodySmall" color={theme.colors.textSecondary}>
                {t('director.reports.noTrendData', 'No payment trend data is available for this period.')}
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
                  </View>
                );
              })}
            </View>
          )}
        </ThemedCard>
      </Animated.View>

      <Animated.View style={agentAnim}>
        <SectionHeader
          title={t('director.reports.collectionByAgent', 'Collection by Agent')}
          style={styles.sectionTop}
        />
        <ThemedCard variant="elevated" style={styles.chartCard}>
          {agentCollections.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={28} color={theme.colors.textTertiary} />
              <ThemedText variant="bodySmall" color={theme.colors.textSecondary}>
                {t('director.reports.noAgentCollections', 'No agent collections were recorded for this period.')}
              </ThemedText>
            </View>
          ) : (
            agentCollections.map((agent) => {
              const pct = Math.max(agent.sharePercentage, 4);

              return (
                <View key={agent.collectingAgentId} style={styles.agentRow}>
                  <View style={styles.agentSummary}>
                    <ThemedText variant="bodySmall" style={styles.agentName}>
                      {agent.agentName}
                    </ThemedText>
                    <ThemedText variant="caption" color={theme.colors.textSecondary}>
                      {formatCurrency(agent.totalCollectedAmount)} - {agent.totalTransactions}{' '}
                      {t('director.reports.transactions', 'transactions')}
                    </ThemedText>
                  </View>
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
                  <ThemedText
                    variant="caption"
                    color={theme.colors.textSecondary}
                    style={styles.agentPct}
                  >
                    {Math.round(agent.sharePercentage)}%
                  </ThemedText>
                </View>
              );
            })
          )}
        </ThemedCard>
      </Animated.View>

      <Animated.View style={methodAnim}>
        <SectionHeader
          title={t('director.reports.paymentMethods', 'Payment Methods')}
          style={styles.sectionTop}
        />
        <ThemedCard variant="elevated" style={styles.chartCard}>
          {paymentMethods.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="wallet-outline" size={28} color={theme.colors.textTertiary} />
              <ThemedText variant="bodySmall" color={theme.colors.textSecondary}>
                {t('director.reports.noPaymentMethods', 'No payment method data is available for this period.')}
              </ThemedText>
            </View>
          ) : (
            <>
              <View
                style={[
                  styles.stackedBar,
                  { borderRadius: theme.borderRadius.sm, overflow: 'hidden' },
                ]}
              >
                {paymentMethods.map((method, index) => (
                  <View
                    key={`${method.paymentMethod}-${index}`}
                    style={[
                      styles.stackedSegment,
                      {
                        width: `${Math.max(method.percentage, 4)}%`,
                        backgroundColor: buildMethodColor(method.paymentMethod, index),
                      },
                    ]}
                  />
                ))}
              </View>

              <View style={styles.legend}>
                {paymentMethods.map((method, index) => (
                  <View key={`${method.paymentMethod}-legend-${index}`} style={styles.legendItem}>
                    <View
                      style={[
                        styles.legendDot,
                        { backgroundColor: buildMethodColor(method.paymentMethod, index) },
                      ]}
                    />
                    <ThemedText variant="caption" color={theme.colors.textSecondary}>
                      {method.paymentMethod} ({Math.round(method.percentage)}%)
                    </ThemedText>
                  </View>
                ))}
              </View>
            </>
          )}
        </ThemedCard>
      </Animated.View>

      <Animated.View style={[styles.exportRow, exportAnim]}>
        <ThemedButton
          title={t('director.reports.downloadReport', 'Download Report')}
          onPress={handleDownloadReport}
          variant="secondary"
          size="lg"
          fullWidth
          icon={<Ionicons name="download-outline" size={20} color={theme.colors.primary} />}
        />
      </Animated.View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  headerRow: {
    marginTop: 8,
    marginBottom: 8,
  },
  periodRow: {
    marginBottom: 16,
  },
  periodScroll: {
    gap: 8,
  },
  periodChip: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderWidth: 1,
  },
  periodTxt: {
    fontWeight: '600',
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
    marginBottom: 16,
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
  sectionTop: {
    marginTop: 8,
  },
  agentRow: {
    marginBottom: 14,
  },
  agentSummary: {
    marginBottom: 8,
  },
  agentName: {
    fontWeight: '600',
  },
  agentBarBg: {
    height: 8,
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  agentBarFill: {
    height: '100%',
  },
  agentPct: {
    textAlign: 'right',
  },
  stackedBar: {
    flexDirection: 'row',
    height: 24,
    marginBottom: 16,
  },
  stackedSegment: {
    height: '100%',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  exportRow: {
    marginTop: 8,
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 18,
  },
});

export default ReportsScreen;
