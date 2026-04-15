import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  FlatList,
  Alert,
  Modal,
  ScrollView,
  RefreshControl,
  Platform,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import {
  ScreenContainer,
  ThemedText,
  ThemedCard,
  ThemedInput,
  ThemedButton,
  EmptyState,
  ScreenSkeleton,
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
import type { SchoolGradeSection, PaymentCycle, PaymentCycleType } from '../../types';

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

// ─── Cycle Card ─────────────────────────────────────────────────
const CycleCard: React.FC<{ cycle: PaymentCycle; index: number; gradeFee: number }> = ({
  cycle,
  index,
  gradeFee,
}) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const anim = useAnimatedEntry({ type: 'slideUp', delay: staggerDelay(index, 50) });

  const installments = cycle.installmentAmounts
    ? cycle.installmentAmounts.split(',').map(Number)
    : [];

  const typeLabels: Record<string, string> = {
    Full: t('cycles.typeFull', 'Full Payment'),
    Monthly: t('cycles.typeMonthly', 'Monthly'),
    Quarterly: t('cycles.typeQuarterly', 'Quarterly'),
    Weekly: t('cycles.typeWeekly', 'Weekly'),
    Custom: t('cycles.typeCustom', 'Custom'),
  };

  const countLabel = cycle.paymentCycleType === 'Full'
    ? `1 ${t('cycles.installment', 'installment')}`
    : cycle.paymentCycleType === 'Monthly'
      ? `12 ${t('cycles.installments', 'installments')}`
      : cycle.paymentCycleType === 'Quarterly'
        ? `4 ${t('cycles.installments', 'installments')}`
        : cycle.paymentCycleType === 'Weekly'
          ? `52 ${t('cycles.installments', 'installments')}`
          : cycle.intervalCount && cycle.intervalUnit != null
            ? `${t('cycles.every', 'Every')} ${cycle.intervalCount} ${typeof cycle.intervalUnit === 'string' ? cycle.intervalUnit.toLowerCase() : (['day', 'week', 'month', 'year'][cycle.intervalUnit as any] || '')}(s)`
            : '';

  return (
    <Animated.View style={anim}>
      <ThemedCard style={styles.cycleCard}>
        <View style={styles.cycleHeader}>
          <View style={[styles.cycleIcon, { backgroundColor: theme.colors.primaryLight + '20' }]}>
            <Ionicons
              name={CYCLE_TYPES.find((c) => c.key === cycle.paymentCycleType)?.icon as any ?? 'card-outline'}
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
                  {typeLabels[cycle.paymentCycleType] ?? cycle.paymentCycleType}
                </ThemedText>
              </View>
              {countLabel ? (
                <ThemedText variant="caption" color={theme.colors.textTertiary}>
                  {countLabel}
                </ThemedText>
              ) : null}
            </View>
          </View>
        </View>

        {cycle.paymentCycleDescription ? (
          <ThemedText variant="caption" color={theme.colors.textSecondary} style={{ marginTop: 6 }}>
            {cycle.paymentCycleDescription}
          </ThemedText>
        ) : null}

        <View style={[styles.cycleFeeRow, { borderTopColor: theme.colors.border }]}>
          <ThemedText variant="caption" color={theme.colors.textTertiary}>
            {t('cycles.startsOn', 'Starts')}: {formatDate(cycle.planStartDate)}
          </ThemedText>
          <ThemedText variant="body" color={theme.colors.primary} style={{ fontWeight: '700' }}>
            {formatCurrency(gradeFee)}
          </ThemedText>
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
        <ThemedText variant="h1">{t('cycles.title', 'Payment Plans')}</ThemedText>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => {
              setGradeName(''); setGradeDesc(''); setGradeFee('');
              setGradeStartDate(null); setGradeEndDate(null);
              setShowGradeModal(true);
            }}
            style={[styles.addBtn, { backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.full, borderWidth: 1, borderColor: theme.colors.primary }]}
          >
            <Ionicons name="school-outline" size={18} color={theme.colors.primary} />
          </Pressable>
          {selectedGradeId && (
            <Pressable
              onPress={openAddCycle}
              style={[styles.addBtn, { backgroundColor: theme.colors.primary, borderRadius: theme.borderRadius.full }]}
            >
              <Ionicons name="add" size={24} color="#fff" />
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
          <View style={styles.gradeInfoItem}>
            <ThemedText variant="caption" color={theme.colors.textTertiary}>{t('cycles.fee', 'Fee')}</ThemedText>
            <ThemedText variant="body" color={theme.colors.primary} style={{ fontWeight: '700' }}>
              {formatCurrency(activeGrade.schoolGradeFee)}
            </ThemedText>
          </View>
          <View style={[styles.gradeInfoDivider, { backgroundColor: theme.colors.border }]} />
          <View style={styles.gradeInfoItem}>
            <ThemedText variant="caption" color={theme.colors.textTertiary}>{t('cycles.term', 'Term')}</ThemedText>
            <ThemedText variant="caption" color={theme.colors.text}>
              {formatDate(activeGrade.termStartDate)} — {formatDate(activeGrade.termEndDate)}
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
        <Pressable style={styles.modalOverlay} onPress={() => setShowCycleModal(false)}>
          <Pressable style={[styles.modalContent, { backgroundColor: theme.colors.card, borderRadius: theme.borderRadius.lg }]} onPress={() => { }}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <ThemedText variant="subtitle" style={styles.modalTitle}>
                {t('cycles.addCycle', 'Add Payment Plan')}
              </ThemedText>

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

              {/* Cycle Type Selector */}
              <ThemedText variant="bodySmall" style={styles.label}>
                {t('cycles.cycleType', 'Payment Type')}
              </ThemedText>
              <View style={styles.typeGrid}>
                {CYCLE_TYPES.map((ct) => {
                  const isActive = cycleType === ct.key;
                  return (
                    <Pressable
                      key={ct.key}
                      onPress={() => setCycleType(ct.key)}
                      style={[
                        styles.typeCard,
                        {
                          backgroundColor: isActive ? theme.colors.primary + '15' : theme.colors.surface,
                          borderColor: isActive ? theme.colors.primary : theme.colors.border,
                          borderRadius: theme.borderRadius.md,
                        },
                      ]}
                    >
                      <Ionicons
                        name={ct.icon as any}
                        size={20}
                        color={isActive ? theme.colors.primary : theme.colors.textTertiary}
                      />
                      <ThemedText
                        variant="caption"
                        color={isActive ? theme.colors.primary : theme.colors.text}
                        style={{ fontWeight: isActive ? '700' : '400', marginTop: 4 }}
                      >
                        {ct.key}
                      </ThemedText>
                      {ct.count !== null && (
                        <ThemedText variant="caption" color={theme.colors.textTertiary} style={{ fontSize: 10 }}>
                          {ct.count}x
                        </ThemedText>
                      )}
                    </Pressable>
                  );
                })}
              </View>

              {/* Custom Fields */}
              {cycleType === 'Custom' && (
                <View style={styles.customSection}>
                  <ThemedText variant="bodySmall" style={styles.label}>
                    {t('cycles.customInterval', 'Interval')}
                  </ThemedText>
                  <View style={styles.customRow}>
                    <View style={{ flex: 1 }}>
                      <ThemedInput
                        label={t('cycles.every', 'Every')}
                        value={intervalCount}
                        onChangeText={setIntervalCount}
                        placeholder="2"
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={{ flex: 1.5 }}>
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
                                  backgroundColor: isActive ? theme.colors.primary : theme.colors.surface,
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
                                {u}
                              </ThemedText>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  </View>

                  {/* Custom Amounts */}
                  <ThemedInput
                    label={t('cycles.customAmounts', 'Custom Amounts (optional, comma-separated)')}
                    value={customAmounts}
                    onChangeText={setCustomAmounts}
                    placeholder={t('cycles.customAmountsPlaceholder', 'e.g. 50000,40000,30000')}
                  />
                </View>
              )}

              {/* Preview */}
              {expectedCount > 0 && activeGrade && (
                <View style={[styles.previewBox, { backgroundColor: theme.colors.primaryLight + '10', borderRadius: theme.borderRadius.md, borderColor: theme.colors.primary + '30' }]}>
                  <View style={styles.previewRow}>
                    <ThemedText variant="caption" color={theme.colors.textSecondary}>
                      {t('cycles.installments', 'Installments')}
                    </ThemedText>
                    <ThemedText variant="body" color={theme.colors.primary} style={{ fontWeight: '700' }}>
                      {expectedCount}
                    </ThemedText>
                  </View>
                  <View style={styles.previewRow}>
                    <ThemedText variant="caption" color={theme.colors.textSecondary}>
                      {t('cycles.perInstallment', 'Per installment')}
                    </ThemedText>
                    <ThemedText variant="body" color={theme.colors.primary} style={{ fontWeight: '700' }}>
                      ~{formatCurrency(perInstallment)}
                    </ThemedText>
                  </View>
                  <View style={styles.previewRow}>
                    <ThemedText variant="caption" color={theme.colors.textSecondary}>
                      {t('cycles.total', 'Total')}
                    </ThemedText>
                    <ThemedText variant="body" color={theme.colors.text} style={{ fontWeight: '600' }}>
                      {formatCurrency(activeGrade.schoolGradeFee)}
                    </ThemedText>
                  </View>
                </View>
              )}

              <View style={styles.modalActions}>
                <ThemedButton
                  title={t('common.cancel')}
                  variant="ghost"
                  size="md"
                  onPress={() => setShowCycleModal(false)}
                  style={styles.modalBtn}
                />
                <ThemedButton
                  title={isAddingCycle ? t('common.loading') : t('common.save')}
                  variant="primary"
                  size="md"
                  onPress={handleAddCycle}
                  disabled={isAddingCycle}
                  style={styles.modalBtn}
                />
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  addBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
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
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
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
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  cycleFeeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    marginTop: 10,
    paddingTop: 10,
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
