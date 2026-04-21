import React, { useCallback, useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  Alert,
  ScreenContainer,
  ThemedText,
  ThemedCard,
  ThemedButton,
  ThemedInput,
  Avatar,
  SectionHeader,
  ScreenSkeleton,
} from '../../components';
import { useTheme } from '../../theme';
import {
  useGetSingleChildQuery,
  useUpdateChildMutation,
  useAlterModuleStatusMutation,
  useGetSingleParentQuery,
  useGetChildGradeQuery,
  useGetSchoolGradeSectionDetailQuery,
} from '../../services/api/apiSlice';
import { formatDate } from '../../utils';

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

const STATUS_ENABLED = 1;
const STATUS_DISABLED = 2;
const STATUS_DELETED = 5;
const STATUS_PENDING = 6;
const STATUS_REJECTED = 13;

const statusKey = (id: number): 'approved' | 'pending' | 'rejected' | 'inactive' => {
  if (id === STATUS_PENDING) return 'pending';
  if (id === STATUS_REJECTED) return 'rejected';
  if (id === STATUS_DISABLED || id === STATUS_DELETED) return 'inactive';
  return 'approved';
};

// ---------------------------------------------------------------------------
// Edit form
// ---------------------------------------------------------------------------

interface EditChildForm {
  firstName: string;
  lastName: string;
  fatherName: string;
  dateOfBirth: string; // YYYY-MM-DD
}

const EMPTY_EDIT: EditChildForm = {
  firstName: '',
  lastName: '',
  fatherName: '',
  dateOfBirth: '',
};

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

const DirectorChildDetailScreen: React.FC = () => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ childId?: string }>();
  const childId = parseInt(params.childId || '0');

  const [editVisible, setEditVisible] = useState(false);
  const [editForm, setEditForm] = useState<EditChildForm>(EMPTY_EDIT);
  const [refreshing, setRefreshing] = useState(false);

  const {
    data: childRes,
    isLoading: childLoading,
    refetch: refetchChild,
  } = useGetSingleChildQuery({ childrenId: childId }, { skip: !childId });

  const child = childRes?.data;

  // Resolve parent name (no raw IDs shown in UI per project memory rule).
  const {
    data: parentRes,
    refetch: refetchParent,
  } = useGetSingleParentQuery(
    { parentId: child?.fK_ParentId ?? 0 },
    { skip: !child?.fK_ParentId },
  );
  const parent = parentRes?.data;

  // Grade lookup (read-only on this screen).
  const {
    data: gradeRes,
    refetch: refetchGrade,
  } = useGetChildGradeQuery({ childrenId: childId }, { skip: !childId });
  const childGrade = gradeRes?.data;

  const {
    data: gradeSectionRes,
  } = useGetSchoolGradeSectionDetailQuery(
    { schoolGradeSectionId: childGrade?.fK_SchoolGradeSectionId ?? 0 },
    { skip: !childGrade?.fK_SchoolGradeSectionId },
  );
  const gradeSection = gradeSectionRes?.data;

  const [updateChild, { isLoading: saving }] = useUpdateChildMutation();
  const [alterStatus] = useAlterModuleStatusMutation();

  // ── Status alter helper ──
  const performStatus = useCallback(
    async (action: 'enable' | 'disable' | 'deleted') => {
      if (!child) return;
      try {
        await alterStatus({
          moduleName: 'schoolchildrensection',
          actionType: action,
          moduleItemsIds: String(child.childId),
        }).unwrap();
        Alert.alert(
          t('common.success', 'Success'),
          t('common.statusChanged', 'Status updated.'),
        );
        if (action === 'deleted') {
          router.back();
        } else {
          refetchChild();
        }
      } catch (err: any) {
        Alert.alert(
          t('common.error', 'Error'),
          err?.data?.error || err?.data?.message || t('common.genericError', 'Something went wrong'),
        );
      }
    },
    [alterStatus, child, refetchChild, router, t],
  );

  const showActionSheet = useCallback(() => {
    if (!child) return;
    const isActive = child.fK_StatusId === STATUS_ENABLED;
    const title = t('common.actions', 'Actions');
    const message = t('common.chooseAction', 'Choose an action');
    const buttons: any[] = [
      { text: t('common.cancel', 'Cancel'), style: 'cancel' },
      {
        text: isActive ? t('common.disable', 'Disable') : t('common.enable', 'Enable'),
        onPress: () => {
          Alert.alert(
            title,
            isActive
              ? t('common.confirmDisable', 'Disable this item?')
              : t('common.confirmEnable', 'Enable this item?'),
            [
              { text: t('common.cancel', 'Cancel'), style: 'cancel' },
              {
                text: t('common.confirm', 'Confirm'),
                onPress: () => performStatus(isActive ? 'disable' : 'enable'),
              },
            ],
          );
        },
      },
      {
        text: t('common.delete', 'Delete'),
        style: 'destructive',
        onPress: () => {
          Alert.alert(
            t('common.delete', 'Delete'),
            t('common.confirmDelete', 'This will permanently remove the item. Continue?'),
            [
              { text: t('common.cancel', 'Cancel'), style: 'cancel' },
              {
                text: t('common.delete', 'Delete'),
                style: 'destructive',
                onPress: () => performStatus('deleted'),
              },
            ],
          );
        },
      },
    ];
    Alert.alert(title, message, buttons);
  }, [child, performStatus, t]);

  // ── Edit helpers ──
  const openEdit = () => {
    if (!child) return;
    // Server returns dateOfBirth as ISO; trim to YYYY-MM-DD for the input.
    const dob = (child.dateOfBirth || '').slice(0, 10);
    setEditForm({
      firstName: child.firstName || '',
      lastName: child.lastName || '',
      fatherName: child.fatherName || '',
      dateOfBirth: dob,
    });
    setEditVisible(true);
  };

  const handleSave = async () => {
    if (!child) return;
    if (
      !editForm.firstName.trim() ||
      !editForm.lastName.trim() ||
      !editForm.dateOfBirth.trim()
    ) {
      Alert.alert(
        t('common.error', 'Error'),
        t('director.children.requiredFields', 'First name, last name and date of birth are required.'),
      );
      return;
    }
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(editForm.dateOfBirth.trim())) {
      Alert.alert(
        t('common.error', 'Error'),
        t('director.children.invalidDate', 'Date format must be YYYY-MM-DD.'),
      );
      return;
    }
    try {
      await updateChild({
        childrenId: child.childId,
        firstName: editForm.firstName.trim(),
        lastName: editForm.lastName.trim(),
        fatherName: editForm.fatherName.trim() || '',
        dateOfBirth: editForm.dateOfBirth.trim(),
        parentId: child.fK_ParentId,
        schoolId: child.fK_SchoolId,
      }).unwrap();
      setEditVisible(false);
      Alert.alert(
        t('common.success', 'Success'),
        t('director.children.updated', 'Student updated.'),
      );
      refetchChild();
    } catch (err: any) {
      Alert.alert(
        t('common.error', 'Error'),
        err?.data?.error || err?.data?.message || t('common.genericError', 'Something went wrong'),
      );
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchChild(), refetchParent(), refetchGrade()]);
    setRefreshing(false);
  }, [refetchChild, refetchParent, refetchGrade]);

  // Reset edit form when modal closes so re-open always shows fresh values.
  useEffect(() => {
    if (!editVisible) setEditForm(EMPTY_EDIT);
  }, [editVisible]);

  if (childLoading) {
    return (
      <ScreenContainer>
        <ScreenSkeleton count={5} />
      </ScreenContainer>
    );
  }

  if (!child) {
    return (
      <ScreenContainer>
        <Pressable onPress={() => router.back()} style={styles.backRow}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
          <ThemedText variant="h1">{t('director.children.detailTitle', 'Student Details')}</ThemedText>
        </Pressable>
        <ThemedText variant="body" color={theme.colors.textSecondary}>
          {t('director.children.notFound', 'Student not found.')}
        </ThemedText>
      </ScreenContainer>
    );
  }

  const status = statusKey(child.fK_StatusId);
  const statusColors: Record<string, string> = {
    approved: theme.colors.success,
    pending: theme.colors.warning,
    rejected: theme.colors.error,
    inactive: theme.colors.textTertiary,
  };
  const statusLabels: Record<string, string> = {
    approved: t('common.active', 'Active'),
    pending: t('children.pending', 'Pending'),
    rejected: t('children.rejected', 'Rejected'),
    inactive: t('common.inactive', 'Inactive'),
  };

  return (
    <ScreenContainer scrollable={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
          </Pressable>
          <ThemedText variant="h1">{t('director.children.detailTitle', 'Student Details')}</ThemedText>
        </View>

        {/* Profile card */}
        <ThemedCard variant="elevated" style={styles.profileCard}>
          <View style={styles.profileRow}>
            <Avatar firstName={child.firstName} lastName={child.lastName} size="lg" />
            <View style={styles.profileInfo}>
              <ThemedText variant="title">
                {child.firstName} {child.lastName}
              </ThemedText>
              {child.fatherName ? (
                <ThemedText variant="caption" color={theme.colors.textSecondary}>
                  {t('director.children.father', 'Father')}: {child.fatherName}
                </ThemedText>
              ) : null}
              <View style={styles.statusInline}>
                <View style={[styles.dot, { backgroundColor: statusColors[status] }]} />
                <ThemedText
                  variant="caption"
                  color={statusColors[status]}
                  style={{ fontWeight: '500', fontSize: 11 }}
                >
                  {statusLabels[status]}
                </ThemedText>
              </View>
            </View>
            <Pressable
              onPress={openEdit}
              style={[
                styles.iconBtn,
                {
                  backgroundColor: theme.colors.primary + '15',
                  borderRadius: theme.borderRadius.full,
                },
              ]}
            >
              <Ionicons name="pencil-outline" size={18} color={theme.colors.primary} />
            </Pressable>
            <Pressable
              onPress={showActionSheet}
              style={[
                styles.iconBtn,
                { backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.full },
              ]}
            >
              <Ionicons name="ellipsis-vertical" size={18} color={theme.colors.text} />
            </Pressable>
          </View>
        </ThemedCard>

        {/* Profile info */}
        <SectionHeader title={t('director.children.profile', 'Profile')} style={styles.section} />
        <ThemedCard variant="outlined" style={styles.infoCard}>
          <InfoRow
            icon="calendar-outline"
            label={t('children.dateOfBirth', 'Date of Birth')}
            value={child.dateOfBirth ? formatDate(child.dateOfBirth) : '—'}
            color={theme.colors.primary}
          />
          {parent ? (
            <InfoRow
              icon="person-outline"
              label={t('director.children.parent', 'Parent')}
              value={`${parent.firstName} ${parent.lastName}`}
              color={theme.colors.secondary}
              onPress={() =>
                router.push({
                  pathname: '/(app)/director-parent-detail',
                  params: { parentId: String(parent.parentId) },
                })
              }
            />
          ) : null}
          {child.rejectionReason ? (
            <InfoRow
              icon="alert-circle-outline"
              label={t('director.students.reason', 'Reason')}
              value={child.rejectionReason}
              color={theme.colors.error}
            />
          ) : null}
        </ThemedCard>

        {/* Grade */}
        <SectionHeader title={t('director.children.grade', 'Grade')} style={styles.section} />
        <ThemedCard variant="outlined" style={styles.infoCard}>
          <InfoRow
            icon="school-outline"
            label={t('director.children.grade', 'Grade')}
            value={
              gradeSection?.schoolGradeName ||
              t('director.children.noGrade', 'Not yet assigned')
            }
            color={theme.colors.accent}
          />
        </ThemedCard>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Edit Modal */}
      <Modal
        visible={editVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setEditVisible(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setEditVisible(false)}>
          <Pressable
            style={[
              styles.modalBox,
              { backgroundColor: theme.colors.card, borderRadius: theme.borderRadius.lg },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <ThemedText variant="subtitle" style={styles.modalTitle}>
              {t('director.children.editChild', 'Edit Student')}
            </ThemedText>

            <ThemedInput
              label={t('auth.firstName', 'First Name')}
              value={editForm.firstName}
              onChangeText={(v) => setEditForm((p) => ({ ...p, firstName: v }))}
            />
            <ThemedInput
              label={t('auth.lastName', 'Last Name')}
              value={editForm.lastName}
              onChangeText={(v) => setEditForm((p) => ({ ...p, lastName: v }))}
            />
            <ThemedInput
              label={t('auth.fatherName', 'Father Name')}
              value={editForm.fatherName}
              onChangeText={(v) => setEditForm((p) => ({ ...p, fatherName: v }))}
            />
            <ThemedInput
              label={t('director.children.dateOfBirth', 'Date of Birth (YYYY-MM-DD)')}
              value={editForm.dateOfBirth}
              onChangeText={(v) => setEditForm((p) => ({ ...p, dateOfBirth: v }))}
              placeholder="2010-06-15"
              keyboardType="numeric"
            />

            <View style={styles.modalActions}>
              <ThemedButton
                title={t('common.cancel', 'Cancel')}
                variant="ghost"
                onPress={() => setEditVisible(false)}
                style={styles.modalBtn}
              />
              <ThemedButton
                title={t('common.save', 'Save')}
                variant="primary"
                onPress={handleSave}
                loading={saving}
                style={styles.modalBtn}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
};

// ---------------------------------------------------------------------------
// InfoRow helper (mirrors the one in DirectorParentDetailScreen)
// ---------------------------------------------------------------------------

interface InfoRowProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
  color: string;
  onPress?: () => void;
}

const InfoRow: React.FC<InfoRowProps> = ({ icon, label, value, color, onPress }) => {
  const { theme } = useTheme();
  const content = (
    <View style={infoStyles.row}>
      <View
        style={[
          infoStyles.iconWrap,
          { backgroundColor: color + '15', borderRadius: theme.borderRadius.full },
        ]}
      >
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <View style={infoStyles.text}>
        <ThemedText variant="caption" color={theme.colors.textSecondary}>
          {label}
        </ThemedText>
        <ThemedText variant="body">{value}</ThemedText>
      </View>
      {onPress ? (
        <Ionicons name="chevron-forward" size={18} color={theme.colors.textTertiary} />
      ) : null}
    </View>
  );
  return onPress ? <Pressable onPress={onPress}>{content}</Pressable> : content;
};

const infoStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1 },
});

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  scroll: { paddingBottom: 32 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  backBtn: { padding: 4 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  profileCard: { marginHorizontal: 16, marginBottom: 4 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  profileInfo: { flex: 1 },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: { paddingHorizontal: 16, marginTop: 12 },
  infoCard: { marginHorizontal: 16, padding: 0, overflow: 'hidden', marginBottom: 4 },
  statusInline: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalBox: { padding: 20 },
  modalTitle: { marginBottom: 12, fontWeight: '700' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  modalBtn: { flex: 1 },
});

export default DirectorChildDetailScreen;
