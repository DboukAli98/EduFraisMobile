import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  FlatList,
  Modal,
  ScrollView,
  RefreshControl,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Alert,
  ScreenContainer,
  ThemedText,
  ThemedCard,
  ThemedInput,
  ThemedButton,
  EmptyState,
  ScreenSkeleton,
  CommissionBreakdownCard,
} from '../../components';
import { useTheme } from '../../theme';
import { useAnimatedEntry, staggerDelay, useAppSelector } from '../../hooks';
import {
  useGetSchoolGradesSectionsQuery,
  useGetPaymentCyclesQuery,
  useAddPaymentCycleMutation,
  useAddSchoolSectionMutation,
} from '../../services/api/apiSlice';
import { CURRENCY_SYMBOL } from '../../constants';
import type { SchoolGradeSection, PaymentCycle, PaymentCycleType, IntervalUnitName } from '../../types';

const formatCurrency = (amount: number) =>
  `${amount.toLocaleString()} ${CURRENCY_SYMBOL}`;

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
};

const CYCLE_TYPES: { key: PaymentCycleType; icon: string; count: number | null }[] = [
  { key: 'Full', icon: 'cash-outline', count: 1 },
  { key: 'Monthly', icon: 'calendar-outline', count: 12 },
  { key: 'Quarterly', icon: 'albums-outline', count: 4 },
  { key: 'Weekly', icon: 'time-outline', count: 52 },
  { key: 'Custom', icon: 'settings-outline', count: null },
];

const INTERVAL_UNITS = ['Day', 'Week', 'Month', 'Year'] as const;
const PAYMENT_CYCLE_TYPE_BY_INDEX: PaymentCycleType[] = [
  'Full',
  'Monthly',
  'Weekly',
  'Quarterly',
  'Custom',
];
const INTERVAL_UNIT_BY_INDEX: IntervalUnitName[] = ['Day', 'Week', 'Month', 'Year'];

const resolveCycleTypeName = (raw: PaymentCycleType | number | undefined): PaymentCycleType => {
  if (typeof raw === 'number') return PAYMENT_CYCLE_TYPE_BY_INDEX[raw] ?? 'Custom';
  if (typeof raw === 'string' && (PAYMENT_CYCLE_TYPE_BY_INDEX as string[]).includes(raw)) {
    return raw as PaymentCycleType;
  }
  return 'Custom';
};

const resolveIntervalUnitName = (
  raw: IntervalUnitName | number | null | undefined,
): IntervalUnitName | null => {
  if (raw == null) return null;
  if (typeof raw === 'number') return INTERVAL_UNIT_BY_INDEX[raw] ?? null;
  if ((INTERVAL_UNIT_BY_INDEX as string[]).includes(raw as string)) return raw as IntervalUnitName;
  return null;
};

// ─── Cycle Card ─────────────────────────────────────────────────
const CycleCard: React.FC<{ cycle: PaymentCycle; index: number; gradeFee: number }> = ({
  cycle,
  index,
  gradeFee,
}) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const anim = useAnimatedEntry({ type: 'slideUp', delay: staggerDelay(index, 50) });

  const cycleTypeName = resolveCycleTypeName(cycle.paymentCycleType);
  const intervalUnitName = resolveIntervalUnitName(cycle.intervalUnit);
  const cycleConfig = CYCLE_TYPES.find((c) => c.key === cycleTypeName) ?? CYCLE_TYPES[4];
  const installments = cycle.installmentAmounts
    ? cycle.installmentAmounts
      .split(',')
      .map((amount) => Number(amount.trim()))
      .filter((amount) => !Number.isNaN(amount) && amount > 0)
    : [];

  const typeLabels: Record<string, string> = {
    Full: t('cycles.typeFull', 'Full Payment'),
    Monthly: t('cycles.typeMonthly', 'Monthly'),
    Quarterly: t('cycles.typeQuarterly', 'Quarterly'),
    Weekly: t('cycles.typeWeekly', 'Weekly'),
    Custom: t('cycles.typeCustom', 'Custom'),
  };

  const defaultCount = cycleConfig.count;
  const customCount = cycleTypeName === 'Custom' && cycle.intervalCount && intervalUnitName
    ? intervalUnitName === 'Day'
      ? Math.ceil(365 / cycle.intervalCount)
      : intervalUnitName === 'Week'
        ? Math.ceil(52 / cycle.intervalCount)
        : intervalUnitName === 'Month'
          ? Math.ceil(12 / cycle.intervalCount)
          : 1
    : null;
  const installmentCount = installments.length || defaultCount || customCount || 0;
  const totalAmount = installments.length
    ? installments.reduce((sum, amount) => sum + amount, 0)
    : gradeFee;
  const perInstallment = installmentCount > 0
    ? Math.round((totalAmount / installmentCount) * 100) / 100
    : 0;
  const installmentLabel = installmentCount > 0
    ? `${installmentCount} ${t(installmentCount === 1 ? 'cycles.installment' : 'cycles.installments')}`
    : t('cycles.customSchedule', 'Custom schedule');
  const intervalLabel = cycleTypeName === 'Custom' && cycle.intervalCount && intervalUnitName
    ? `${t('cycles.every', 'Every')} ${cycle.intervalCount} ${t(`cycles.unit${intervalUnitName}`, intervalUnitName)}`
    : null;
  const summaryParts = [typeLabels[cycleTypeName] ?? cycleTypeName, installmentLabel, intervalLabel].filter(Boolean);

  return (
    <Animated.View style={anim}>
      <ThemedCard style={styles.cycleCard}>
        <View style={styles.cycleHeader}>
          <View style={[styles.cycleIcon, { backgroundColor: theme.colors.primaryLight + '20' }]}>
            <Ionicons
              name={cycleConfig.icon as any}
              size={20}
              color={theme.colors.primary}
            />
          </View>
          <View style={styles.cycleInfo}>
            <ThemedText variant="subtitle" numberOfLines={1}>
              {cycle.paymentCycleName}
            </ThemedText>
            <View style={styles.cycleMetaRow}>
              <View style={[styles.typeBadge, { backgroundColor: theme.colors.primary, borderRadius: theme.borderRadius.sm }]}>
                <ThemedText variant="caption" color="#FFFFFF" style={{ fontWeight: '600' }}>
                  {typeLabels[cycleTypeName] ?? cycleTypeName}
                </ThemedText>
              </View>
              <ThemedText variant="caption" color={theme.colors.textTertiary} numberOfLines={1} style={styles.cycleMetaText}>
                {summaryParts.slice(1).join(' • ')}
              </ThemedText>
            </View>
          </View>
        </View>

        {cycle.paymentCycleDescription ? (
          <ThemedText variant="caption" color={theme.colors.textSecondary} style={{ marginTop: 6 }}>
            {cycle.paymentCycleDescription}
          </ThemedText>
        ) : null}

        <View style={styles.cycleInsightGrid}>
          <View style={[styles.cycleInsight, { backgroundColor: theme.colors.primary + '10', borderRadius: theme.borderRadius.md }]}>
            <ThemedText variant="caption" color={theme.colors.textTertiary} numberOfLines={1}>
              {t('cycles.installments', 'Installments')}
            </ThemedText>
            <ThemedText variant="body" color={theme.colors.primary} style={styles.cycleInsightValue} numberOfLines={1}>
              {installmentCount || '—'}
            </ThemedText>
          </View>
          <View style={[styles.cycleInsight, { backgroundColor: theme.colors.primary + '10', borderRadius: theme.borderRadius.md }]}>
            <ThemedText variant="caption" color={theme.colors.textTertiary} numberOfLines={1}>
              {t('cycles.perInstallment', 'Per installment')}
            </ThemedText>
            <ThemedText variant="body" color={theme.colors.primary} style={styles.cycleInsightValue} numberOfLines={1}>
              {perInstallment ? `~${formatCurrency(perInstallment)}` : '—'}
            </ThemedText>
          </View>
        </View>

        <View style={[styles.cycleFeeRow, { borderTopColor: theme.colors.border }]}>
          <View style={styles.cycleDateInfo}>
            <ThemedText variant="caption" color={theme.colors.textTertiary}>
              {t('cycles.startsOn', 'Starts')}
            </ThemedText>
            <ThemedText variant="bodySmall" color={theme.colors.text} numberOfLines={1}>
              {formatDate(cycle.planStartDate)}
            </ThemedText>
          </View>
          <View style={styles.cycleTotalInfo}>
            <ThemedText variant="caption" color={theme.colors.textTertiary} align="right">
              {t('cycles.total', 'Total')}
            </ThemedText>
            <ThemedText variant="body" color={theme.colors.primary} style={{ fontWeight: '700' }} numberOfLines={1}>
              {formatCurrency(totalAmount)}
            </ThemedText>
          </View>
        </View>

        {installments.length > 1 && (
          <View style={styles.installmentPreview}>
            {installments.slice(0, 4).map((amt, i) => (
              <View key={i} style={styles.installmentDot}>
                <ThemedText variant="caption" color={theme.colors.textSecondary}>
                  #{i + 1}
                </ThemedText>
                <ThemedText variant="caption" color={theme.colors.text} style={{ fontWeight: '600' }}>
                  {formatCurrency(amt)}
                </ThemedText>
              </View>
            ))}
            {installments.length > 4 && (
              <ThemedText variant="caption" color={theme.colors.textTertiary}>
                +{installments.length - 4} {t('cycles.more', 'more')}
              </ThemedText>
            )}
          </View>
        )}
      </ThemedCard>
    </Animated.View>
  );
};

// ─── Main Screen ────────────────────────────────────────────────
export default function PaymentCyclesScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const user = useAppSelector((state) => state.auth.user);
  const schoolId = parseInt(user?.schoolId || '0');

  // Selected grade
  const [selectedGradeId, setSelectedGradeId] = useState<number | null>(null);

  // Add grade modal
  const [showGradeModal, setShowGradeModal] = useState(false);
  const [gradeName, setGradeName] = useState('');
  const [gradeDesc, setGradeDesc] = useState('');
  const [gradeFee, setGradeFee] = useState('');
  const [gradeStartDate, setGradeStartDate] = useState<Date | null>(null);
  const [gradeEndDate, setGradeEndDate] = useState<Date | null>(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  // Add cycle modal
  const [showCycleModal, setShowCycleModal] = useState(false);
  const [cycleName, setCycleName] = useState('');
  const [cycleDesc, setCycleDesc] = useState('');
  const [cycleType, setCycleType] = useState<PaymentCycleType>('Monthly');
  const [intervalCount, setIntervalCount] = useState('');
  const [intervalUnit, setIntervalUnit] = useState<string>('Month');
  const [customAmounts, setCustomAmounts] = useState('');

  // Queries
  const {
    data: gradesData,
    isLoading: gradesLoading,
    refetch: refetchGrades,
  } = useGetSchoolGradesSectionsQuery(
    { schoolId, onlyEnabled: true, pageNumber: 1, pageSize: 50 },
    { skip: !schoolId },
  );

  const {
    data: cyclesData,
    isLoading: cyclesLoading,
    refetch: refetchCycles,
  } = useGetPaymentCyclesQuery(
    { schoolGradeSectionId: selectedGradeId!, pageNumber: 1, pageSize: 50 },
    { skip: !selectedGradeId },
  );

  const [addCycle, { isLoading: isAddingCycle }] = useAddPaymentCycleMutation();
  const [addGrade, { isLoading: isAddingGrade }] = useAddSchoolSectionMutation();

  const grades = gradesData?.data ?? [];
  const cycles = cyclesData?.data ?? [];

  // Auto-select first grade
  const activeGrade = useMemo(
    () => grades.find((g) => g.schoolGradeSectionId === selectedGradeId),
    [grades, selectedGradeId],
  );

  // Auto-select first grade when data loads
  React.useEffect(() => {
    if (grades.length > 0 && selectedGradeId === null) {
      setSelectedGradeId(grades[0].schoolGradeSectionId);
    }
  }, [grades, selectedGradeId]);

  const headerAnim = useAnimatedEntry({ type: 'slideUp', delay: staggerDelay(0) });

  // ─── Add Grade ────────────────────────────────────────────
  const handleAddGrade = useCallback(async () => {
    if (!gradeName.trim()) {
      Alert.alert(t('common.error'), t('cycles.gradeNameRequired', 'Grade name is required'));
      return;
    }
    const fee = parseFloat(gradeFee);
    if (isNaN(fee) || fee <= 0) {
      Alert.alert(t('common.error'), t('cycles.gradeFeeRequired', 'Please enter a valid fee'));
      return;
    }
    if (!gradeStartDate || !gradeEndDate) {
      Alert.alert(t('common.error'), t('cycles.gradeDatesRequired', 'Start and end dates are required'));
      return;
    }
    try {
      await addGrade({
        schoolGradeName: gradeName.trim(),
        schoolGradeDescription: gradeDesc.trim() || undefined,
        schoolGradeFee: fee,
        schoolId,
        termStartDate: gradeStartDate.toISOString().split('T')[0],
        termEndDate: gradeEndDate.toISOString().split('T')[0],
      }).unwrap();
      setShowGradeModal(false);
      Alert.alert(t('common.success'), t('cycles.gradeAdded', 'Grade added successfully'));
      refetchGrades();
    } catch (err: any) {
      Alert.alert(t('common.error'), err?.data?.message || err?.data?.error || t('cycles.gradeAddFailed', 'Failed to add grade'));
    }
  }, [gradeName, gradeDesc, gradeFee, gradeStartDate, gradeEndDate, schoolId, addGrade, refetchGrades, t]);

  // ─── Add Cycle ────────────────────────────────────────────
  const openAddCycle = useCallback(() => {
    setCycleName('');
    setCycleDesc('');
    setCycleType('Monthly');
    setIntervalCount('');
    setIntervalUnit('Month');
    setCustomAmounts('');
    setShowCycleModal(true);
  }, []);

  const handleAddCycle = useCallback(async () => {
    if (!cycleName.trim()) {
      Alert.alert(t('common.error'), t('cycles.cycleNameRequired', 'Cycle name is required'));
      return;
    }
    if (!selectedGradeId) return;

    const payload: any = {
      paymentCycleName: cycleName.trim(),
      paymentCycleDescription: cycleDesc.trim() || undefined,
      fk_SchoolGradeSectionId: selectedGradeId,
      paymentCycleType: cycleType,
    };

    if (cycleType === 'Custom') {
      const ic = parseInt(intervalCount);
      if (isNaN(ic) || ic <= 0) {
        Alert.alert(t('common.error'), t('cycles.intervalRequired', 'Please enter a valid interval count'));
        return;
      }
      payload.intervalCount = ic;
      payload.intervalUnit = intervalUnit;
    }

    if (customAmounts.trim()) {
      payload.installmentAmounts = customAmounts.trim();
      if (cycleType === 'Custom') {
        // already set above
      } else {
        // installmentAmounts requires intervalCount + intervalUnit even for non-custom
        // Backend validates this — so we skip custom amounts for non-custom types
        Alert.alert(t('common.error'), t('cycles.customAmountsOnlyForCustom', 'Custom installment amounts can only be used with Custom type'));
        return;
      }
    }

    try {
      await addCycle(payload).unwrap();
      setShowCycleModal(false);
      Alert.alert(t('common.success'), t('cycles.cycleAdded', 'Payment cycle added successfully'));
      refetchCycles();
    } catch (err: any) {
      Alert.alert(t('common.error'), err?.data?.message || err?.data?.error || t('cycles.cycleAddFailed', 'Failed to add payment cycle'));
    }
  }, [cycleName, cycleDesc, cycleType, selectedGradeId, intervalCount, intervalUnit, customAmounts, addCycle, refetchCycles, t]);

  // Computed expected installment count for preview
  const expectedCount = useMemo(() => {
    if (cycleType === 'Full') return 1;
    if (cycleType === 'Monthly') return 12;
    if (cycleType === 'Quarterly') return 4;
    if (cycleType === 'Weekly') return 52;
    if (cycleType === 'Custom') {
      const ic = parseInt(intervalCount);
      if (isNaN(ic) || ic <= 0) return 0;
      if (intervalUnit === 'Day') return Math.ceil(365 / ic);
      if (intervalUnit === 'Week') return Math.ceil(52 / ic);
      if (intervalUnit === 'Month') return Math.ceil(12 / ic);
      if (intervalUnit === 'Year') return 1;
    }
    return 0;
  }, [cycleType, intervalCount, intervalUnit]);

  const perInstallment = useMemo(() => {
    if (!activeGrade || expectedCount <= 0) return 0;
    return Math.round((activeGrade.schoolGradeFee / expectedCount) * 100) / 100;
  }, [activeGrade, expectedCount]);

  const selectedCycleConfig = useMemo(
    () => CYCLE_TYPES.find((ct) => ct.key === cycleType) ?? CYCLE_TYPES[1],
    [cycleType],
  );

  const selectedCycleLabel = t(`cycles.type${cycleType}`, cycleType);

  if (gradesLoading) {
    return (
      <ScreenContainer scrollable={false}>
        <ScreenSkeleton />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scrollable={false}>
      {/* Header */}
      <Animated.View style={[styles.headerRow, headerAnim]}>
        <ThemedText variant="h1" numberOfLines={1} style={styles.headerTitle}>
          {t('cycles.title', 'Payment Plans')}
        </ThemedText>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => {
              setGradeName(''); setGradeDesc(''); setGradeFee('');
              setGradeStartDate(null); setGradeEndDate(null);
              setShowGradeModal(true);
            }}
            style={[
              styles.headerActionPill,
              {
                backgroundColor: theme.colors.surface,
                borderRadius: theme.borderRadius.full,
                borderWidth: 1,
                borderColor: theme.colors.primary,
              },
            ]}
          >
            <Ionicons name="school-outline" size={18} color={theme.colors.primary} />
            <ThemedText
              variant="button"
              color={theme.colors.primary}
              numberOfLines={1}
              style={styles.headerActionText}
            >
              {t('cycles.addGrade', 'Add Grade')}
            </ThemedText>
          </Pressable>
          {selectedGradeId && (
            <Pressable
              onPress={openAddCycle}
              style={[
                styles.headerActionPill,
                {
                  backgroundColor: theme.colors.primary,
                  borderRadius: theme.borderRadius.full,
                },
              ]}
            >
              <Ionicons name="add" size={18} color="#fff" />
              <ThemedText variant="button" color="#fff" numberOfLines={1} style={styles.headerActionText}>
                {t('cycles.addCycle', 'Add Plan')}
              </ThemedText>
            </Pressable>
          )}
        </View>
      </Animated.View>

      {/* Grade Selector Chips */}
      {grades.length > 0 && (
        <View style={styles.gradeChipWrapper}>
          <FlatList
            horizontal
            data={grades}
            keyExtractor={(g) => String(g.schoolGradeSectionId)}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.gradeChipList}
            renderItem={({ item: grade }) => {
              const isActive = selectedGradeId === grade.schoolGradeSectionId;
              return (
                <Pressable
                  onPress={() => setSelectedGradeId(grade.schoolGradeSectionId)}
                  style={[
                    styles.gradeChip,
                    {
                      backgroundColor: isActive ? theme.colors.primary : theme.colors.surface,
                      borderRadius: theme.borderRadius.md,
                      borderWidth: 1,
                      borderColor: isActive ? theme.colors.primary : theme.colors.border,
                    },
                  ]}
                >
                  <ThemedText
                    variant="caption"
                    color={isActive ? '#fff' : theme.colors.text}
                    style={{ fontWeight: isActive ? '700' : '400' }}
                    numberOfLines={1}
                  >
                    {grade.schoolGradeName}
                  </ThemedText>
                  <ThemedText
                    variant="caption"
                    color={isActive ? 'rgba(255,255,255,0.7)' : theme.colors.textTertiary}
                    style={{ fontSize: 10 }}
                  >
                    {formatCurrency(grade.schoolGradeFee)}
                  </ThemedText>
                </Pressable>
              );
            }}
          />
        </View>
      )}

      {/* Grade Info Bar */}
      {activeGrade && (
        <View style={[styles.gradeInfoBar, { backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.md }]}>
          <View style={styles.gradeInfoTopRow}>
            <View style={styles.gradeInfoItem}>
              <ThemedText variant="caption" color={theme.colors.textTertiary}>{t('cycles.fee', 'Fee')}</ThemedText>
              <ThemedText variant="body" color={theme.colors.primary} style={{ fontWeight: '700' }} numberOfLines={1}>
                {formatCurrency(activeGrade.schoolGradeFee)}
              </ThemedText>
            </View>
            <View style={[styles.gradeInfoDivider, { backgroundColor: theme.colors.border }]} />
            <View style={styles.gradeInfoItem}>
              <ThemedText variant="caption" color={theme.colors.textTertiary}>{t('cycles.plans', 'Plans')}</ThemedText>
              <ThemedText variant="body" color={theme.colors.text} style={{ fontWeight: '600' }}>
                {cycles.length}
              </ThemedText>
            </View>
          </View>
          <View style={[styles.gradePeriodRow, { borderTopColor: theme.colors.border }]}>
            <View style={[styles.gradePeriodIcon, { backgroundColor: theme.colors.primary + '12', borderRadius: theme.borderRadius.full }]}>
              <Ionicons name="calendar-outline" size={16} color={theme.colors.primary} />
            </View>
            <View style={styles.gradePeriodTextWrap}>
              <ThemedText variant="caption" color={theme.colors.textTertiary} style={styles.gradePeriodLabel}>
                {t('cycles.term', 'Term')}
              </ThemedText>
              <ThemedText variant="bodySmall" color={theme.colors.text} numberOfLines={1} style={styles.gradePeriodText}>
                {formatDate(activeGrade.termStartDate)} - {formatDate(activeGrade.termEndDate)}
              </ThemedText>
            </View>
          </View>
        </View>
      )}

      {/* Cycles List */}
      {grades.length === 0 ? (
        <EmptyState
          icon="school-outline"
          title={t('cycles.noGrades', 'No Grades Yet')}
          description={t('cycles.noGradesDesc', 'Create a grade section first, then add payment plans to it.')}
          actionLabel={t('cycles.addGrade', 'Add Grade')}
          onAction={() => {
            setGradeName(''); setGradeDesc(''); setGradeFee('');
            setGradeStartDate(null); setGradeEndDate(null);
            setShowGradeModal(true);
          }}
        />
      ) : !selectedGradeId ? null : cyclesLoading ? (
        <ScreenSkeleton count={3} />
      ) : cycles.length === 0 ? (
        <EmptyState
          icon="card-outline"
          title={t('cycles.noCycles', 'No Payment Plans')}
          description={t('cycles.noCyclesDesc', 'Add a payment plan so parents can choose how to pay fees.')}
          actionLabel={t('cycles.addCycle', 'Add Plan')}
          onAction={openAddCycle}
        />
      ) : (
        <FlatList
          data={cycles}
          keyExtractor={(c) => String(c.paymentCycleId)}
          renderItem={({ item, index }) => (
            <CycleCard cycle={item} index={index} gradeFee={activeGrade?.schoolGradeFee ?? 0} />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={refetchCycles} tintColor={theme.colors.primary} colors={[theme.colors.primary]} />
          }
        />
      )}

      {/* ─── Add Grade Modal ─────────────────────────────────── */}
      <Modal visible={showGradeModal} animationType="fade" transparent onRequestClose={() => setShowGradeModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowGradeModal(false)}>
          <Pressable style={[styles.modalContent, { backgroundColor: theme.colors.card, borderRadius: theme.borderRadius.lg }]} onPress={() => { }}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <ThemedText variant="subtitle" style={styles.modalTitle}>
                {t('cycles.addGrade', 'Add Grade')}
              </ThemedText>
              <ThemedInput
                label={t('cycles.gradeName', 'Grade Name')}
                value={gradeName}
                onChangeText={setGradeName}
                placeholder={t('cycles.gradeNamePlaceholder', 'e.g. 6ème Année')}
              />
              <ThemedInput
                label={t('cycles.gradeDescription', 'Description (optional)')}
                value={gradeDesc}
                onChangeText={setGradeDesc}
                placeholder={t('cycles.gradeDescPlaceholder', 'Brief description...')}
              />
              <ThemedInput
                label={`${t('cycles.gradeFee', 'Annual Fee')} (${CURRENCY_SYMBOL})`}
                value={gradeFee}
                onChangeText={setGradeFee}
                placeholder="0"
                keyboardType="numeric"
              />
              {/* Live fee breakdown — shows the director exactly what the
                  school will net once the platform + Airtel fees are
                  deducted from the amount the parent is charged. */}
              <CommissionBreakdownCard
                grossAmount={parseFloat(gradeFee) || 0}
                audience="director"
                title={t('cycles.feeBreakdown', 'Répartition des frais')}
              />
              {/* Term Start Date Picker */}
              <ThemedText
                variant="bodySmall"
                color={theme.colors.textSecondary}
                style={styles.dateLabel}
              >
                {t('cycles.termStart', 'Term Start Date')}
              </ThemedText>
              <Pressable
                onPress={() => setShowStartPicker(true)}
                style={[
                  styles.dateSelector,
                  {
                    backgroundColor: theme.colors.inputBackground,
                    borderColor: theme.colors.border,
                    borderRadius: theme.borderRadius.md,
                  },
                ]}
              >
                <Ionicons
                  name="calendar-outline"
                  size={20}
                  color={gradeStartDate ? theme.colors.text : theme.colors.textTertiary}
                />
                <ThemedText
                  variant="body"
                  color={gradeStartDate ? theme.colors.text : theme.colors.textTertiary}
                  style={styles.dateText}
                >
                  {gradeStartDate
                    ? gradeStartDate.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })
                    : t('cycles.selectDate', 'Select date')}
                </ThemedText>
              </Pressable>
              {showStartPicker && (
                Platform.OS === 'ios' ? (
                  <Modal transparent animationType="fade" onRequestClose={() => setShowStartPicker(false)}>
                    <Pressable style={styles.datePickerOverlay} onPress={() => setShowStartPicker(false)}>
                      <View style={[styles.datePickerContent, { backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.xl }]}>
                        <View style={[styles.datePickerHeader, { borderBottomColor: theme.colors.borderLight }]}>
                          <Pressable onPress={() => setShowStartPicker(false)}>
                            <ThemedText variant="body" color={theme.colors.textSecondary}>{t('common.cancel')}</ThemedText>
                          </Pressable>
                          <ThemedText variant="subtitle">{t('cycles.termStart', 'Term Start Date')}</ThemedText>
                          <Pressable onPress={() => setShowStartPicker(false)}>
                            <ThemedText variant="body" color={theme.colors.primary}>{t('common.done')}</ThemedText>
                          </Pressable>
                        </View>
                        <DateTimePicker
                          value={gradeStartDate || new Date()}
                          mode="date"
                          display="spinner"
                          onChange={(_e: DateTimePickerEvent, d?: Date) => { if (d) setGradeStartDate(d); }}
                        />
                      </View>
                    </Pressable>
                  </Modal>
                ) : (
                  <DateTimePicker
                    value={gradeStartDate || new Date()}
                    mode="date"
                    display="default"
                    onChange={(_e: DateTimePickerEvent, d?: Date) => { setShowStartPicker(false); if (d) setGradeStartDate(d); }}
                  />
                )
              )}

              {/* Term End Date Picker */}
              <ThemedText
                variant="bodySmall"
                color={theme.colors.textSecondary}
                style={styles.dateLabel}
              >
                {t('cycles.termEnd', 'Term End Date')}
              </ThemedText>
              <Pressable
                onPress={() => setShowEndPicker(true)}
                style={[
                  styles.dateSelector,
                  {
                    backgroundColor: theme.colors.inputBackground,
                    borderColor: theme.colors.border,
                    borderRadius: theme.borderRadius.md,
                  },
                ]}
              >
                <Ionicons
                  name="calendar-outline"
                  size={20}
                  color={gradeEndDate ? theme.colors.text : theme.colors.textTertiary}
                />
                <ThemedText
                  variant="body"
                  color={gradeEndDate ? theme.colors.text : theme.colors.textTertiary}
                  style={styles.dateText}
                >
                  {gradeEndDate
                    ? gradeEndDate.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })
                    : t('cycles.selectDate', 'Select date')}
                </ThemedText>
              </Pressable>
              {showEndPicker && (
                Platform.OS === 'ios' ? (
                  <Modal transparent animationType="fade" onRequestClose={() => setShowEndPicker(false)}>
                    <Pressable style={styles.datePickerOverlay} onPress={() => setShowEndPicker(false)}>
                      <View style={[styles.datePickerContent, { backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.xl }]}>
                        <View style={[styles.datePickerHeader, { borderBottomColor: theme.colors.borderLight }]}>
                          <Pressable onPress={() => setShowEndPicker(false)}>
                            <ThemedText variant="body" color={theme.colors.textSecondary}>{t('common.cancel')}</ThemedText>
                          </Pressable>
                          <ThemedText variant="subtitle">{t('cycles.termEnd', 'Term End Date')}</ThemedText>
                          <Pressable onPress={() => setShowEndPicker(false)}>
                            <ThemedText variant="body" color={theme.colors.primary}>{t('common.done')}</ThemedText>
                          </Pressable>
                        </View>
                        <DateTimePicker
                          value={gradeEndDate || new Date()}
                          mode="date"
                          display="spinner"
                          onChange={(_e: DateTimePickerEvent, d?: Date) => { if (d) setGradeEndDate(d); }}
                        />
                      </View>
                    </Pressable>
                  </Modal>
                ) : (
                  <DateTimePicker
                    value={gradeEndDate || new Date()}
                    mode="date"
                    display="default"
                    onChange={(_e: DateTimePickerEvent, d?: Date) => { setShowEndPicker(false); if (d) setGradeEndDate(d); }}
                  />
                )
              )}
              <View style={styles.modalActions}>
                <ThemedButton
                  title={t('common.cancel')}
                  variant="ghost"
                  size="md"
                  onPress={() => setShowGradeModal(false)}
                  style={styles.modalBtn}
                />
                <ThemedButton
                  title={isAddingGrade ? t('common.loading') : t('common.save')}
                  variant="primary"
                  size="md"
                  onPress={handleAddGrade}
                  disabled={isAddingGrade}
                  style={styles.modalBtn}
                />
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ─── Add Cycle Modal ─────────────────────────────────── */}
      <Modal visible={showCycleModal} animationType="fade" transparent onRequestClose={() => setShowCycleModal(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetKeyboard}
        >
          <Pressable style={styles.sheetBackdrop} onPress={() => setShowCycleModal(false)} />
          <View
            style={[
              styles.planSheet,
              {
                backgroundColor: theme.colors.card,
                borderTopLeftRadius: theme.borderRadius.xl,
                borderTopRightRadius: theme.borderRadius.xl,
              },
            ]}
          >
            <View style={[styles.sheetHandle, { backgroundColor: theme.colors.border }]} />
            <View style={styles.planSheetHeader}>
              <View style={[styles.planHeaderIcon, { backgroundColor: theme.colors.primary + '15', borderRadius: theme.borderRadius.lg }]}>
                <Ionicons name="layers-outline" size={22} color={theme.colors.primary} />
              </View>
              <View style={styles.planHeaderCopy}>
                <ThemedText variant="h2" numberOfLines={1}>
                  {t('cycles.addCycle', 'Add Plan')}
                </ThemedText>
                <ThemedText variant="caption" color={theme.colors.textSecondary} numberOfLines={2}>
                  {t('cycles.planSetupDesc', 'Configure how families will pay this class fee.')}
                </ThemedText>
              </View>
              <Pressable
                onPress={() => setShowCycleModal(false)}
                style={[styles.sheetCloseBtn, { backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.full }]}
              >
                <Ionicons name="close" size={20} color={theme.colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.planSheetScroll}>
              {activeGrade && (
                <View
                  style={[
                    styles.selectedGradeCard,
                    {
                      backgroundColor: theme.colors.primary + '10',
                      borderColor: theme.colors.primary + '25',
                      borderRadius: theme.borderRadius.lg,
                    },
                  ]}
                >
                  <View style={styles.selectedGradeHeader}>
                    <ThemedText variant="caption" color={theme.colors.primary} style={styles.sectionEyebrow}>
                      {t('cycles.selectedGrade', 'Selected class')}
                    </ThemedText>
                    <ThemedText variant="subtitle" numberOfLines={1}>
                      {activeGrade.schoolGradeName}
                    </ThemedText>
                  </View>
                  <View style={styles.selectedGradeStats}>
                    <View style={styles.selectedGradeStat}>
                      <ThemedText variant="caption" color={theme.colors.textTertiary}>
                        {t('cycles.annualFee', 'Annual fee')}
                      </ThemedText>
                      <ThemedText variant="body" color={theme.colors.primary} style={styles.statStrong}>
                        {formatCurrency(activeGrade.schoolGradeFee)}
                      </ThemedText>
                    </View>
                    <View style={[styles.selectedGradeDivider, { backgroundColor: theme.colors.primary + '25' }]} />
                    <View style={styles.selectedGradeStatWide}>
                      <ThemedText variant="caption" color={theme.colors.textTertiary}>
                        {t('cycles.term', 'Term')}
                      </ThemedText>
                      <ThemedText variant="caption" color={theme.colors.text} numberOfLines={1}>
                        {formatDate(activeGrade.termStartDate)} - {formatDate(activeGrade.termEndDate)}
                      </ThemedText>
                    </View>
                  </View>
                </View>
              )}

              <View style={styles.formSection}>
                <View style={styles.formSectionTitleRow}>
                  <Ionicons name="create-outline" size={18} color={theme.colors.primary} />
                  <ThemedText variant="subtitle">{t('cycles.planDetails', 'Plan details')}</ThemedText>
                </View>
                <ThemedInput
                  label={t('cycles.cycleName', 'Plan Name')}
                  value={cycleName}
                  onChangeText={setCycleName}
                  placeholder={t('cycles.cycleNamePlaceholder', 'e.g. Monthly Payment')}
                />
                <ThemedInput
                  label={t('cycles.cycleDesc', 'Description (optional)')}
                  value={cycleDesc}
                  onChangeText={setCycleDesc}
                  placeholder={t('cycles.cycleDescPlaceholder', 'Brief description...')}
                />
              </View>

              <View style={styles.formSection}>
                <View style={styles.formSectionTitleRow}>
                  <Ionicons name="repeat-outline" size={18} color={theme.colors.primary} />
                  <ThemedText variant="subtitle">{t('cycles.paymentRhythm', 'Payment rhythm')}</ThemedText>
                </View>
                <View style={styles.modernTypeGrid}>
                  {CYCLE_TYPES.map((ct) => {
                    const isActive = cycleType === ct.key;
                    return (
                      <Pressable
                        key={ct.key}
                        onPress={() => setCycleType(ct.key)}
                        style={[
                          styles.modernTypeCard,
                          {
                            backgroundColor: isActive ? theme.colors.primary : theme.colors.surface,
                            borderColor: isActive ? theme.colors.primary : theme.colors.border,
                            borderRadius: theme.borderRadius.lg,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.modernTypeIcon,
                            {
                              backgroundColor: isActive ? 'rgba(255,255,255,0.16)' : theme.colors.primary + '12',
                              borderRadius: theme.borderRadius.md,
                            },
                          ]}
                        >
                          <Ionicons
                            name={ct.icon as any}
                            size={19}
                            color={isActive ? '#fff' : theme.colors.primary}
                          />
                        </View>
                        <View style={styles.modernTypeCopy}>
                          <ThemedText
                            variant="bodySmall"
                            color={isActive ? '#fff' : theme.colors.text}
                            numberOfLines={1}
                            style={styles.modernTypeLabel}
                          >
                            {t(`cycles.type${ct.key}`, ct.key)}
                          </ThemedText>
                          <ThemedText
                            variant="caption"
                            color={isActive ? 'rgba(255,255,255,0.72)' : theme.colors.textTertiary}
                            numberOfLines={1}
                          >
                            {ct.count !== null
                              ? `${ct.count} ${t('cycles.installments', 'installments')}`
                              : t('cycles.customSchedule', 'Custom schedule')}
                          </ThemedText>
                        </View>
                        {isActive && <Ionicons name="checkmark-circle" size={18} color="#fff" />}
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {cycleType === 'Custom' && (
                <View
                  style={[
                    styles.customPanel,
                    {
                      backgroundColor: theme.colors.surface,
                      borderColor: theme.colors.border,
                      borderRadius: theme.borderRadius.lg,
                    },
                  ]}
                >
                  <ThemedText variant="bodySmall" style={styles.label}>
                    {t('cycles.customInterval', 'Interval')}
                  </ThemedText>
                  <View style={styles.customRow}>
                    <View style={styles.customIntervalInput}>
                      <ThemedInput
                        label={t('cycles.every', 'Every')}
                        value={intervalCount}
                        onChangeText={setIntervalCount}
                        placeholder="2"
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={styles.customUnitColumn}>
                      <ThemedText variant="caption" color={theme.colors.textTertiary} style={{ marginBottom: 6 }}>
                        {t('cycles.unit', 'Unit')}
                      </ThemedText>
                      <View style={styles.unitRow}>
                        {INTERVAL_UNITS.map((u) => {
                          const isActive = intervalUnit === u;
                          return (
                            <Pressable
                              key={u}
                              onPress={() => setIntervalUnit(u)}
                              style={[
                                styles.unitChip,
                                {
                                  backgroundColor: isActive ? theme.colors.primary : theme.colors.card,
                                  borderColor: isActive ? theme.colors.primary : theme.colors.border,
                                  borderRadius: theme.borderRadius.sm,
                                },
                              ]}
                            >
                              <ThemedText
                                variant="caption"
                                color={isActive ? '#fff' : theme.colors.text}
                                style={{ fontWeight: isActive ? '600' : '400', fontSize: 11 }}
                              >
                                {t(`cycles.unit${u}`, u)}
                              </ThemedText>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  </View>

                  <ThemedInput
                    label={t('cycles.customAmounts', 'Custom Amounts (optional, comma-separated)')}
                    value={customAmounts}
                    onChangeText={setCustomAmounts}
                    placeholder={t('cycles.customAmountsPlaceholder', 'e.g. 50000,40000,30000')}
                  />
                </View>
              )}

              {expectedCount > 0 && activeGrade && (
                <View
                  style={[
                    styles.previewBoxModern,
                    {
                      backgroundColor: theme.colors.surface,
                      borderRadius: theme.borderRadius.lg,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <View style={styles.previewHeaderModern}>
                    <View style={[styles.previewIcon, { backgroundColor: theme.colors.successLight, borderRadius: theme.borderRadius.md }]}>
                      <Ionicons name={selectedCycleConfig.icon as any} size={18} color={theme.colors.success} />
                    </View>
                    <View style={styles.previewTitleWrap}>
                      <ThemedText variant="subtitle">{t('cycles.planPreview', 'Plan preview')}</ThemedText>
                      <ThemedText variant="caption" color={theme.colors.textSecondary} numberOfLines={1}>
                        {selectedCycleLabel}
                      </ThemedText>
                    </View>
                  </View>
                  <View style={styles.previewMetrics}>
                    <View style={[styles.previewMetricCard, { backgroundColor: theme.colors.primary + '10', borderRadius: theme.borderRadius.md }]}>
                      <ThemedText variant="caption" color={theme.colors.textTertiary}>
                        {t('cycles.installments', 'Installments')}
                      </ThemedText>
                      <ThemedText variant="h2" color={theme.colors.primary}>
                        {expectedCount}
                      </ThemedText>
                    </View>
                    <View style={[styles.previewMetricCard, { backgroundColor: theme.colors.primary + '10', borderRadius: theme.borderRadius.md }]}>
                      <ThemedText variant="caption" color={theme.colors.textTertiary}>
                        {t('cycles.perInstallment', 'Per installment')}
                      </ThemedText>
                      <ThemedText variant="body" color={theme.colors.primary} numberOfLines={1} style={styles.statStrong}>
                        ~{formatCurrency(perInstallment)}
                      </ThemedText>
                    </View>
                  </View>
                  <View style={[styles.previewTotalRow, { borderTopColor: theme.colors.border }]}>
                    <ThemedText variant="bodySmall" color={theme.colors.textSecondary}>
                      {t('cycles.total', 'Total')}
                    </ThemedText>
                    <ThemedText variant="subtitle" color={theme.colors.text}>
                      {formatCurrency(activeGrade.schoolGradeFee)}
                    </ThemedText>
                  </View>
                </View>
              )}
            </ScrollView>

            <View
              style={[
                styles.sheetActions,
                {
                  borderTopColor: theme.colors.border,
                  paddingBottom: Math.max(insets.bottom + 12, 20),
                },
              ]}
            >
              <ThemedButton
                title={t('common.cancel')}
                variant="secondary"
                size="lg"
                onPress={() => setShowCycleModal(false)}
                style={styles.sheetActionBtn}
              />
              <ThemedButton
                title={isAddingCycle ? t('common.loading') : t('common.save')}
                variant="primary"
                size="lg"
                onPress={handleAddCycle}
                disabled={isAddingCycle}
                style={styles.sheetActionBtn}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    gap: 12,
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
  },
  headerTitle: {
    flexShrink: 1,
  },
  headerActions: {
    gap: 8,
  },
  headerActionPill: {
    width: '100%',
    height: 40,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  headerActionText: {
    flexShrink: 1,
    fontSize: 12,
  },
  gradeChipWrapper: {
    height: 56,
    marginBottom: 4,
  },
  gradeChipList: {
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 8,
  },
  gradeChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    alignItems: 'center',
    minWidth: 80,
  },
  gradeInfoBar: {
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 10,
  },
  gradeInfoTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gradeInfoItem: {
    flex: 1,
    alignItems: 'center',
  },
  gradeInfoDivider: {
    width: 1,
    height: 28,
  },
  gradePeriodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    marginTop: 10,
    paddingTop: 10,
    gap: 10,
  },
  gradePeriodIcon: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradePeriodTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  gradePeriodLabel: {
    fontSize: 10,
    lineHeight: 13,
  },
  gradePeriodText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  cycleCard: {
    marginBottom: 10,
  },
  cycleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cycleIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cycleInfo: {
    flex: 1,
  },
  cycleMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  cycleMetaText: {
    flex: 1,
    minWidth: 0,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  cycleInsightGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  cycleInsight: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 64,
    justifyContent: 'center',
  },
  cycleInsightValue: {
    fontWeight: '700',
    marginTop: 2,
  },
  cycleFeeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    marginTop: 12,
    paddingTop: 12,
    gap: 12,
  },
  cycleDateInfo: {
    flex: 1,
    minWidth: 0,
  },
  cycleTotalInfo: {
    flexShrink: 0,
    alignItems: 'flex-end',
  },
  installmentPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    alignItems: 'center',
  },
  installmentDot: {
    alignItems: 'center',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalContent: {
    width: '100%',
    padding: 24,
    maxHeight: '85%',
  },
  modalTitle: {
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 16,
  },
  modalBtn: {
    minWidth: 100,
  },
  sheetKeyboard: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.48)',
  },
  planSheet: {
    maxHeight: '92%',
    paddingTop: 8,
    overflow: 'hidden',
  },
  sheetHandle: {
    width: 44,
    height: 4,
    borderRadius: 999,
    alignSelf: 'center',
    marginBottom: 12,
  },
  planSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 12,
  },
  planHeaderIcon: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  sheetCloseBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planSheetScroll: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  selectedGradeCard: {
    borderWidth: 1,
    padding: 14,
    marginBottom: 18,
  },
  selectedGradeHeader: {
    marginBottom: 12,
  },
  selectedGradeStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  selectedGradeStat: {
    flex: 0.95,
  },
  selectedGradeStatWide: {
    flex: 1.35,
    minWidth: 0,
  },
  selectedGradeDivider: {
    width: 1,
    height: 34,
  },
  sectionEyebrow: {
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0,
    marginBottom: 2,
  },
  statStrong: {
    fontWeight: '700',
  },
  formSection: {
    marginBottom: 18,
  },
  formSectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  modernTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  modernTypeCard: {
    width: '48%',
    minHeight: 78,
    borderWidth: 1,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  modernTypeIcon: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modernTypeCopy: {
    flex: 1,
    minWidth: 0,
  },
  modernTypeLabel: {
    fontWeight: '700',
  },
  customPanel: {
    borderWidth: 1,
    padding: 14,
    marginBottom: 18,
  },
  customIntervalInput: {
    flex: 1,
  },
  customUnitColumn: {
    flex: 1.55,
  },
  previewBoxModern: {
    borderWidth: 1,
    padding: 14,
    marginBottom: 8,
  },
  previewHeaderModern: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  previewIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  previewMetrics: {
    flexDirection: 'row',
    gap: 10,
  },
  previewMetricCard: {
    flex: 1,
    padding: 12,
    minHeight: 76,
    justifyContent: 'center',
  },
  previewTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    marginTop: 12,
    paddingTop: 12,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  sheetActionBtn: {
    flex: 1,
  },
  label: {
    marginBottom: 8,
    marginTop: 12,
    fontWeight: '600',
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeCard: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    minWidth: 60,
    flex: 1,
  },
  customSection: {
    marginTop: 8,
  },
  customRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  unitRow: {
    flexDirection: 'row',
    gap: 4,
    flexWrap: 'wrap',
  },
  unitChip: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  previewBox: {
    borderWidth: 1,
    padding: 12,
    marginTop: 12,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  dateLabel: {
    marginBottom: 6,
    marginTop: 8,
    fontWeight: '600',
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 52,
    marginBottom: 12,
    gap: 10,
  },
  dateText: {
    flex: 1,
  },
  datePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  datePickerContent: {
    paddingBottom: 20,
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
});
