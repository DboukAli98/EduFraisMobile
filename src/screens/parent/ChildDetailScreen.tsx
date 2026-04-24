import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter, useLocalSearchParams } from 'expo-router';

import {
  Alert,
  ScreenContainer,
  ThemedText,
  ThemedCard,
  ThemedButton,
  Avatar,
} from '../../components';
import { useTheme } from '../../theme';
import { useAnimatedEntry, staggerDelay } from '../../hooks';
import {
  useGetSingleChildQuery,
  useGetChildGradeQuery,
  useGetSchoolGradesSectionsQuery,
  useGetPaymentCyclesQuery,
  useGetChildCycleSelectionQuery,
  useSelectChildCycleMutation,
  useAddChildGradeMutation,
} from '../../services/api/apiSlice';
import { CURRENCY_SYMBOL } from '../../constants';
import type { SchoolGradeSection, PaymentCycle, PaymentCycleType, IntervalUnitName } from '../../types';

// ─── Payment-cycle helpers ───────────────────────────────────────
// The backend serializes these enums as numbers; map them to names the
// rest of the UI (and i18n keys) can reason about. Everything is
// defensive — we fall back to the raw string when it *is* already a
// string, and to a neutral "Custom" / "Month" when it's unknown.
const PAYMENT_CYCLE_TYPE_BY_INDEX: PaymentCycleType[] = [
  'Full',
  'Monthly',
  'Weekly',
  'Quarterly',
  'Custom',
];
const INTERVAL_UNIT_BY_INDEX: IntervalUnitName[] = ['Day', 'Week', 'Month', 'Year'];

const resolveCycleTypeName = (raw: PaymentCycleType | number | undefined): PaymentCycleType => {
  if (typeof raw === 'number') {
    return PAYMENT_CYCLE_TYPE_BY_INDEX[raw] ?? 'Custom';
  }
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
  if ((INTERVAL_UNIT_BY_INDEX as string[]).includes(raw as string)) {
    return raw as IntervalUnitName;
  }
  return null;
};

const formatCurrency = (amount: number) =>
  `${amount.toLocaleString()} ${CURRENCY_SYMBOL}`;

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
};

// ─── Info Row Component ──────────────────────────────────────────
const InfoRow: React.FC<{
  icon: string;
  label: string;
  value: string;
  color?: string;
}> = ({ icon, label, value, color }) => {
  const { theme } = useTheme();
  return (
    <View style={styles.infoRow}>
      <View style={[styles.infoIcon, { backgroundColor: theme.colors.primaryLight + '20' }]}>
        <Ionicons name={icon as any} size={18} color={theme.colors.primary} />
      </View>
      <View style={styles.infoContent}>
        <ThemedText variant="caption" color={theme.colors.textTertiary}>
          {label}
        </ThemedText>
        <ThemedText variant="body" color={color || theme.colors.text}>
          {value}
        </ThemedText>
      </View>
    </View>
  );
};

// ─── Grade Selection Card ────────────────────────────────────────
const GradeCard: React.FC<{
  grade: SchoolGradeSection;
  isSelected: boolean;
  onPress: () => void;
}> = ({ grade, isSelected, onPress }) => {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.gradeCard,
        {
          backgroundColor: isSelected ? theme.colors.primary + '15' : theme.colors.surface,
          borderColor: isSelected ? theme.colors.primary : theme.colors.border,
          borderRadius: theme.borderRadius.md,
        },
      ]}
    >
      <View style={styles.gradeCardContent}>
        <View style={styles.gradeInfo}>
          <ThemedText variant="subtitle" color={isSelected ? theme.colors.primary : theme.colors.text}>
            {grade.schoolGradeName}
          </ThemedText>
          {grade.schoolGradeDescription ? (
            <ThemedText variant="caption" color={theme.colors.textSecondary} numberOfLines={1}>
              {grade.schoolGradeDescription}
            </ThemedText>
          ) : null}
          <ThemedText variant="caption" color={theme.colors.textTertiary}>
            {formatDate(grade.termStartDate)} — {formatDate(grade.termEndDate)}
          </ThemedText>
        </View>
        <View style={styles.gradeRight}>
          <ThemedText variant="body" color={theme.colors.primary} style={{ fontWeight: '700' }}>
            {formatCurrency(grade.schoolGradeFee)}
          </ThemedText>
          {isSelected && (
            <Ionicons name="checkmark-circle" size={22} color={theme.colors.primary} />
          )}
        </View>
      </View>
    </Pressable>
  );
};

// ─── Payment Cycle Card ──────────────────────────────────────────
const CycleCard: React.FC<{
  cycle: PaymentCycle;
  isSelected: boolean;
  onPress: () => void;
  // Grade is used to derive the total fee and, when the backend didn't
  // provide an explicit installment schedule, to synthesize a preview
  // (e.g. "12 × 12 500 XAF" for a monthly plan against a yearly fee).
  grade?: SchoolGradeSection;
}> = ({ cycle, isSelected, onPress, grade }) => {
  const { theme } = useTheme();
  const { t } = useTranslation();

  const cycleTypeName = resolveCycleTypeName(cycle.paymentCycleType);
  const intervalUnitName = resolveIntervalUnitName(cycle.intervalUnit);

  // Human labels for the chip + summary line. Falls back to the i18n default
  // string so nothing ever shows as just "0" again.
  const typeLabel = t(
    `childDetail.cycleType.${cycleTypeName}`,
    {
      Full: 'Paiement unique',
      Monthly: 'Mensuel',
      Weekly: 'Hebdomadaire',
      Quarterly: 'Trimestriel',
      Custom: 'Personnalisé',
    }[cycleTypeName],
  );

  // Derive the installment breakdown. Priority order:
  //   1. explicit `installmentAmounts` from the director
  //   2. synthesized split from the grade fee when the type implies a
  //      fixed number of installments (Full=1, Monthly=12, Weekly=52,
  //      Quarterly=4); Custom + no data → no breakdown.
  const explicitInstallments = cycle.installmentAmounts
    ? cycle.installmentAmounts
        .split(',')
        .map((v) => Number(v.trim()))
        .filter((n) => !Number.isNaN(n) && n > 0)
    : [];

  const impliedCount: number | null = (() => {
    if (explicitInstallments.length > 0) return null;
    if (cycleTypeName === 'Full') return 1;
    if (cycleTypeName === 'Monthly') return 12;
    if (cycleTypeName === 'Weekly') return 52;
    if (cycleTypeName === 'Quarterly') return 4;
    // Custom: we could compute from intervalCount + intervalUnit + term
    // dates, but the wire data is ambiguous, so keep it as a summary line
    // and let the parent see "Personnalisé" without a fake schedule.
    return null;
  })();

  const impliedInstallments: number[] =
    impliedCount && grade?.schoolGradeFee
      ? Array.from({ length: impliedCount }, () =>
          Math.round((grade.schoolGradeFee / impliedCount) * 100) / 100,
        )
      : [];

  const installments = explicitInstallments.length > 0 ? explicitInstallments : impliedInstallments;
  const isSynthesized = explicitInstallments.length === 0 && impliedInstallments.length > 0;

  const total =
    explicitInstallments.length > 0
      ? explicitInstallments.reduce((s, n) => s + n, 0)
      : grade?.schoolGradeFee ?? 0;

  // Summary line shown under the title: "12 versements mensuels · démarre le …"
  const summaryParts: string[] = [];
  if (installments.length > 0) {
    summaryParts.push(
      t('childDetail.cycleSummary.installments', {
        count: installments.length,
        defaultValue_one: '{{count}} versement',
        defaultValue_other: '{{count}} versements',
      }),
    );
  }
  if (cycleTypeName === 'Custom' && cycle.intervalCount && intervalUnitName) {
    const unitLabel = t(
      `childDetail.intervalUnit.${intervalUnitName}`,
      { Day: 'jour(s)', Week: 'semaine(s)', Month: 'mois', Year: 'an(s)' }[intervalUnitName],
    );
    summaryParts.push(
      t('childDetail.cycleSummary.every', 'tous les {{count}} {{unit}}', {
        count: cycle.intervalCount,
        unit: unitLabel,
      }),
    );
  }
  if (cycle.planStartDate) {
    summaryParts.push(
      t('childDetail.cycleSummary.startsOn', 'démarre le {{date}}', {
        date: formatDate(cycle.planStartDate),
      }),
    );
  }
  const summary = summaryParts.join(' · ');

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.cycleCard,
        {
          backgroundColor: isSelected ? theme.colors.primary + '15' : theme.colors.surface,
          borderColor: isSelected ? theme.colors.primary : theme.colors.border,
          borderRadius: theme.borderRadius.md,
        },
      ]}
    >
      <View style={styles.cycleHeader}>
        <View style={styles.cycleInfo}>
          <ThemedText variant="subtitle" color={isSelected ? theme.colors.primary : theme.colors.text}>
            {cycle.paymentCycleName}
          </ThemedText>
          <View
            style={[
              styles.typeBadge,
              { backgroundColor: theme.colors.primary, borderRadius: theme.borderRadius.sm },
            ]}
          >
            <ThemedText variant="caption" color="#FFFFFF" style={{ fontWeight: '600' }}>
              {typeLabel}
            </ThemedText>
          </View>
        </View>
        {isSelected && (
          <Ionicons name="checkmark-circle" size={22} color={theme.colors.primary} />
        )}
      </View>

      {summary ? (
        <ThemedText variant="caption" color={theme.colors.textSecondary} style={{ marginTop: 6 }}>
          {summary}
        </ThemedText>
      ) : null}

      {cycle.paymentCycleDescription ? (
        <ThemedText variant="caption" color={theme.colors.textSecondary} style={{ marginTop: 4 }}>
          {cycle.paymentCycleDescription}
        </ThemedText>
      ) : null}

      {total > 0 && (
        <View style={styles.totalRow}>
          <ThemedText variant="caption" color={theme.colors.textSecondary}>
            {t('childDetail.cycleTotal', 'Total à payer')}
          </ThemedText>
          <ThemedText variant="subtitle" color={theme.colors.primary}>
            {formatCurrency(total)}
          </ThemedText>
        </View>
      )}

      {installments.length > 0 && (
        <View style={styles.installmentList}>
          {isSynthesized && (
            <ThemedText
              variant="caption"
              color={theme.colors.textTertiary}
              style={{ marginBottom: 4, fontStyle: 'italic' }}
            >
              {t(
                'childDetail.cycleScheduleEstimated',
                'Aperçu indicatif — le montant exact de chaque versement est fixé par l’école.',
              )}
            </ThemedText>
          )}
          {installments.map((amt, i) => (
            <View key={i} style={styles.installmentRow}>
              <ThemedText variant="caption" color={theme.colors.textSecondary}>
                {t('childDetail.installmentLabel', 'Versement {{num}}', { num: i + 1 })}
              </ThemedText>
              <ThemedText variant="caption" color={theme.colors.text} style={{ fontWeight: '600' }}>
                {formatCurrency(amt)}
              </ThemedText>
            </View>
          ))}
        </View>
      )}
    </Pressable>
  );
};

// ─── Main Screen ────────────────────────────────────────────────
export default function ChildDetailScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ childId: string; schoolName?: string }>();
  const childId = parseInt(params.childId || '0');
  // Prefer the route param if the caller passed it (cheap, no wait),
  // otherwise fall back to whatever the API resolves below.
  const paramSchoolName = params.schoolName || '';

  const [selectedGradeId, setSelectedGradeId] = useState<number | null>(null);
  const [selectedCycleId, setSelectedCycleId] = useState<number | null>(null);

  // ── Queries ──
  const {
    data: childData,
    isLoading: childLoading,
    refetch: refetchChild,
  } = useGetSingleChildQuery({ childrenId: childId }, { skip: !childId });

  const {
    data: childGradeData,
    isLoading: gradeLoading,
    refetch: refetchGrade,
  } = useGetChildGradeQuery({ childrenId: childId }, { skip: !childId });

  const child = childData?.data;
  const childGrade = childGradeData?.data;

  // Get school grades for grade selection
  const {
    data: gradesData,
    isLoading: gradesListLoading,
  } = useGetSchoolGradesSectionsQuery(
    { schoolId: child?.fK_SchoolId ?? 0, onlyEnabled: true, pageNumber: 1, pageSize: 50 },
    { skip: !child?.fK_SchoolId },
  );

  // Get payment cycles for selected grade
  const gradeIdForCycles = childGrade?.fK_SchoolGradeSectionId ?? selectedGradeId;
  const {
    data: cyclesData,
    isLoading: cyclesLoading,
  } = useGetPaymentCyclesQuery(
    { schoolGradeSectionId: gradeIdForCycles!, pageNumber: 1, pageSize: 50 },
    { skip: !gradeIdForCycles },
  );

  // Get existing cycle selection
  const {
    data: cycleSelectionData,
  } = useGetChildCycleSelectionQuery(
    { childGradeId: childGrade?.childGradeId ?? 0 },
    { skip: !childGrade?.childGradeId },
  );

  const [selectCycle, { isLoading: isSelectingCycle }] = useSelectChildCycleMutation();
  const [addGrade, { isLoading: isAddingGrade }] = useAddChildGradeMutation();

  const grades = gradesData?.data ?? [];
  const cycles = cyclesData?.data ?? [];
  const existingCycleSelection = cycleSelectionData?.data;

  // Determine status
  const statusId = child?.fK_StatusId ?? 0;
  const isPending = statusId === 6;
  const isRejected = statusId === 13;
  const isApproved = !isPending && !isRejected;

  const statusConfig = useMemo(() => {
    if (isPending) return { label: t('children.pending', 'Pending'), bg: theme.colors.warning };
    if (isRejected) return { label: t('children.rejected', 'Rejected'), bg: theme.colors.error };
    return { label: t('children.approved', 'Approved'), bg: theme.colors.success };
  }, [isPending, isRejected, theme, t]);

  // Current grade info
  const currentGrade = useMemo(
    () => grades.find((g) => g.schoolGradeSectionId === childGrade?.fK_SchoolGradeSectionId),
    [grades, childGrade],
  );

  const hasGrade = !!childGrade;
  const hasCycle = !!existingCycleSelection;

  // ── Assign Grade ──
  const handleAssignGrade = useCallback(async () => {
    if (!selectedGradeId || !childId) return;
    const grade = grades.find((g) => g.schoolGradeSectionId === selectedGradeId);
    if (!grade) return;

    try {
      await addGrade({
        childrenId: childId,
        schoolGradeSectionId: selectedGradeId,
        startDate: grade.termStartDate.split('T')[0],
        endDate: grade.termEndDate ? grade.termEndDate.split('T')[0] : undefined,
      }).unwrap();
      Alert.alert(t('common.success'), t('childDetail.gradeAssigned', 'Grade assigned successfully'));
      refetchGrade();
    } catch (err: any) {
      Alert.alert(t('common.error'), err?.data?.message || t('childDetail.gradeAssignFailed', 'Failed to assign grade'));
    }
  }, [selectedGradeId, childId, grades, addGrade, refetchGrade, t]);

  // ── Select Payment Cycle ──
  const handleSelectCycle = useCallback(async () => {
    if (!selectedCycleId || !childGrade?.childGradeId) return;

    try {
      await selectCycle({
        childGradeId: childGrade.childGradeId,
        paymentCycleId: selectedCycleId,
      }).unwrap();
      Alert.alert(t('common.success'), t('childDetail.cycleSelected', 'Payment plan selected successfully'));
    } catch (err: any) {
      Alert.alert(t('common.error'), err?.data?.message || t('childDetail.cycleSelectFailed', 'Failed to select payment plan'));
    }
  }, [selectedCycleId, childGrade, selectCycle, t]);

  const onRefresh = useCallback(() => {
    refetchChild();
    refetchGrade();
  }, [refetchChild, refetchGrade]);

  const headerAnim = useAnimatedEntry({ type: 'slideUp', delay: staggerDelay(0) });
  const profileAnim = useAnimatedEntry({ type: 'slideUp', delay: staggerDelay(1) });
  const sectionAnim = useAnimatedEntry({ type: 'slideUp', delay: staggerDelay(2) });

  if (childLoading || gradeLoading) {
    return (
      <ScreenContainer>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  if (!child) {
    return (
      <ScreenContainer>
        <View style={styles.loadingContainer}>
          <ThemedText variant="body" color={theme.colors.textSecondary}>
            {t('childDetail.notFound', 'Child not found')}
          </ThemedText>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scrollable={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={theme.colors.primary} colors={[theme.colors.primary]} />
        }
      >
        {/* Back + Title */}
        <Animated.View style={[styles.header, headerAnim]}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </Pressable>
          <ThemedText variant="h2">{t('childDetail.title', 'Child Details')}</ThemedText>
          <View style={{ width: 40 }} />
        </Animated.View>

        {/* Profile Card */}
        <Animated.View style={profileAnim}>
          <ThemedCard style={styles.profileCard}>
            <View style={styles.profileRow}>
              <Avatar firstName={child.firstName} lastName={child.lastName} size="lg" />
              <View style={styles.profileInfo}>
                <ThemedText variant="title">
                  {child.firstName} {child.lastName}
                </ThemedText>
                {child.fatherName ? (
                  <ThemedText variant="caption" color={theme.colors.textSecondary}>
                    {t('director.students.father', "Father")}: {child.fatherName}
                  </ThemedText>
                ) : null}
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: statusConfig.bg, borderRadius: theme.borderRadius.full },
                  ]}
                >
                  <ThemedText variant="caption" color="#FFFFFF" style={{ fontWeight: '500', fontSize: 11 }}>
                    {statusConfig.label}
                  </ThemedText>
                </View>
              </View>
            </View>
          </ThemedCard>
        </Animated.View>

        {/* Child Info */}
        <Animated.View style={sectionAnim}>
          <ThemedCard style={styles.sectionCard}>
            <ThemedText variant="subtitle" style={styles.sectionTitle}>
              {t('childDetail.info', 'Information')}
            </ThemedText>
            <InfoRow
              icon="calendar-outline"
              label={t('children.dateOfBirth', 'Date of Birth')}
              value={formatDate(child.dateOfBirth)}
            />
            <InfoRow
              icon="school-outline"
              label={t('children.school', 'School')}
              value={paramSchoolName || child?.schoolName || t('common.unknown', 'Unknown')}
            />
            {currentGrade && (
              <InfoRow
                icon="book-outline"
                label={t('children.grade', 'Grade')}
                value={`${currentGrade.schoolGradeName} — ${formatCurrency(currentGrade.schoolGradeFee)}`}
              />
            )}
            {existingCycleSelection && (
              <InfoRow
                icon="card-outline"
                label={t('childDetail.paymentPlan', 'Payment Plan')}
                value={`${formatCurrency(existingCycleSelection.totalFee)}`}
                color={theme.colors.success}
              />
            )}
          </ThemedCard>
        </Animated.View>

        {/* Rejection reason */}
        {isRejected && child.rejectionReason && (
          <ThemedCard style={[styles.sectionCard, { borderLeftWidth: 3, borderLeftColor: theme.colors.error }]}>
            <ThemedText variant="subtitle" color={theme.colors.error} style={styles.sectionTitle}>
              {t('childDetail.rejectionReason', 'Rejection Reason')}
            </ThemedText>
            <ThemedText variant="body" color={theme.colors.textSecondary}>
              {child.rejectionReason}
            </ThemedText>
          </ThemedCard>
        )}

        {/* Grade Selection — only if approved and no grade yet */}
        {isApproved && !hasGrade && grades.length > 0 && (
          <View style={styles.section}>
            <ThemedText variant="subtitle" style={styles.sectionTitle}>
              {t('childDetail.selectGrade', 'Select Grade')}
            </ThemedText>
            <ThemedText variant="caption" color={theme.colors.textSecondary} style={{ marginBottom: 12 }}>
              {t('childDetail.selectGradeDesc', 'Choose a grade to enroll this child')}
            </ThemedText>
            {grades.map((grade) => (
              <GradeCard
                key={grade.schoolGradeSectionId}
                grade={grade}
                isSelected={selectedGradeId === grade.schoolGradeSectionId}
                onPress={() => setSelectedGradeId(grade.schoolGradeSectionId)}
              />
            ))}
            {selectedGradeId && (
              <ThemedButton
                title={isAddingGrade ? t('common.loading') : t('childDetail.assignGrade', 'Assign Grade')}
                variant="primary"
                size="lg"
                onPress={handleAssignGrade}
                disabled={isAddingGrade}
                style={styles.actionBtn}
              />
            )}
          </View>
        )}

        {/* Payment Cycle Selection — only if has grade but no cycle */}
        {isApproved && hasGrade && !hasCycle && cycles.length > 0 && (
          <View style={styles.section}>
            <ThemedText variant="subtitle" style={styles.sectionTitle}>
              {t('childDetail.selectPaymentPlan', 'Select Payment Plan')}
            </ThemedText>
            <ThemedText variant="caption" color={theme.colors.textSecondary} style={{ marginBottom: 12 }}>
              {t('childDetail.selectPaymentPlanDesc', 'Choose how you want to pay the school fees')}
            </ThemedText>
            {cyclesLoading ? (
              <ActivityIndicator color={theme.colors.primary} style={{ marginVertical: 16 }} />
            ) : (
              cycles.map((cycle) => (
                <CycleCard
                  key={cycle.paymentCycleId}
                  cycle={cycle}
                  isSelected={selectedCycleId === cycle.paymentCycleId}
                  onPress={() => setSelectedCycleId(cycle.paymentCycleId)}
                  grade={currentGrade}
                />
              ))
            )}
            {selectedCycleId && (
              <ThemedButton
                title={isSelectingCycle ? t('common.loading') : t('childDetail.confirmPlan', 'Confirm Payment Plan')}
                variant="primary"
                size="lg"
                onPress={handleSelectCycle}
                disabled={isSelectingCycle}
                style={styles.actionBtn}
              />
            )}
          </View>
        )}

        {/* Completed state */}
        {isApproved && hasGrade && hasCycle && (
          <ThemedCard style={[styles.sectionCard, { borderLeftWidth: 3, borderLeftColor: theme.colors.success }]}>
            <View style={styles.completedRow}>
              <Ionicons name="checkmark-circle" size={24} color={theme.colors.success} />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <ThemedText variant="subtitle" color={theme.colors.success}>
                  {t('childDetail.enrollmentComplete', 'Enrollment Complete')}
                </ThemedText>
                <ThemedText variant="caption" color={theme.colors.textSecondary}>
                  {t('childDetail.enrollmentCompleteDesc', 'Grade and payment plan are set. Installments are visible in the Payments tab.')}
                </ThemedText>
              </View>
            </View>
          </ThemedCard>
        )}

        {/* Pending state message */}
        {isPending && (
          <ThemedCard style={[styles.sectionCard, { borderLeftWidth: 3, borderLeftColor: theme.colors.warning }]}>
            <View style={styles.completedRow}>
              <Ionicons name="time-outline" size={24} color={theme.colors.warning} />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <ThemedText variant="subtitle" color={theme.colors.warning}>
                  {t('childDetail.pendingApproval', 'Pending Approval')}
                </ThemedText>
                <ThemedText variant="caption" color={theme.colors.textSecondary}>
                  {t('childDetail.pendingDesc', 'The school director must approve this registration before you can select a grade and payment plan.')}
                </ThemedText>
              </View>
            </View>
          </ThemedCard>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileCard: {
    marginBottom: 12,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileInfo: {
    flex: 1,
    marginLeft: 16,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 6,
  },
  sectionCard: {
    marginBottom: 12,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  gradeCard: {
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  gradeCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gradeInfo: {
    flex: 1,
  },
  gradeRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  cycleCard: {
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  cycleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cycleInfo: {
    flex: 1,
    gap: 4,
  },
  typeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  totalRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128,128,128,0.2)',
  },
  installmentList: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128,128,128,0.2)',
    paddingTop: 8,
  },
  installmentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  actionBtn: {
    marginTop: 12,
  },
  completedRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
