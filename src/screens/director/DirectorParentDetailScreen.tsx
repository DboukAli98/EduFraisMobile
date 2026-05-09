import React, { useCallback, useState } from 'react';
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
import { useAppSelector } from '../../hooks';
import {
  useGetSingleParentQuery,
  useUpdateParentMutation,
  useGetParentChildrenQuery,
  useGetParentPendingRejectedChildrenQuery,
  useAddChildMutation,
  useAlterModuleStatusMutation,
} from '../../services/api/apiSlice';
import { COUNTRY_CODE } from '../../constants';
import { formatDate, extractLocalDigits } from '../../utils';
import type { ChildWithGradeDto, Child } from '../../types';

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

const STATUS_PENDING = 6;
const STATUS_REJECTED = 13;

const getChildStatus = (statusId: number): 'approved' | 'pending' | 'rejected' =>
  statusId === STATUS_PENDING ? 'pending' : statusId === STATUS_REJECTED ? 'rejected' : 'approved';

// ---------------------------------------------------------------------------
// Forms
// ---------------------------------------------------------------------------

interface EditParentForm {
  firstName: string;
  lastName: string;
  fatherName: string;
  phoneNumber: string;
  email: string;
  civilId: string;
}

interface AddChildForm {
  firstName: string;
  lastName: string;
  fatherName: string;
  dateOfBirth: string;
}

const EMPTY_EDIT: EditParentForm = {
  firstName: '', lastName: '', fatherName: '',
  phoneNumber: '', email: '', civilId: '',
};

const EMPTY_CHILD: AddChildForm = {
  firstName: '', lastName: '', fatherName: '', dateOfBirth: '',
};

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

const DirectorParentDetailScreen: React.FC = () => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ parentId?: string }>();
  const parentId = parseInt(params.parentId || '0');

  const user = useAppSelector((state) => state.auth.user);
  const schoolId = parseInt((user?.schoolId ?? '0').split(',')[0], 10);

  // Edit modal
  const [editVisible, setEditVisible] = useState(false);
  const [editForm, setEditForm] = useState<EditParentForm>(EMPTY_EDIT);

  // Add child modal
  const [addChildVisible, setAddChildVisible] = useState(false);
  const [childForm, setChildForm] = useState<AddChildForm>(EMPTY_CHILD);

  const {
    data: parentData,
    isLoading: parentLoading,
    refetch: refetchParent,
  } = useGetSingleParentQuery({ parentId }, { skip: !parentId });

  const {
    data: childrenData,
    isLoading: childrenLoading,
    refetch: refetchChildren,
  } = useGetParentChildrenQuery(
    { parentId, pageNumber: 1, pageSize: 50 },
    { skip: !parentId },
  );

  const {
    data: pendingData,
    isLoading: pendingLoading,
    refetch: refetchPending,
  } = useGetParentPendingRejectedChildrenQuery(
    { parentId, pageNumber: 1, pageSize: 50 },
    { skip: !parentId },
  );

  const [updateParent, { isLoading: saving }] = useUpdateParentMutation();
  const [addChild, { isLoading: addingChild }] = useAddChildMutation();
  const [alterStatus] = useAlterModuleStatusMutation();

  // ── Status alter helper ──
  const performStatus = useCallback(
    async (
      moduleName: 'schoolparentssection' | 'schoolchildrensection',
      itemId: number,
      action: 'enable' | 'disable' | 'deleted',
      onDone?: () => void,
    ) => {
      try {
        await alterStatus({
          moduleName,
          actionType: action,
          moduleItemsIds: String(itemId),
        }).unwrap();
        Alert.alert(t('common.success', 'Success'), t('common.statusChanged', 'Status updated.'));
        onDone?.();
      } catch (err: any) {
        Alert.alert(
          t('common.error', 'Error'),
          err?.data?.error || err?.data?.message || t('common.genericError', 'Something went wrong'),
        );
      }
    },
    [alterStatus, t],
  );

  const showActionSheet = useCallback(
    (
      moduleName: 'schoolparentssection' | 'schoolchildrensection',
      itemId: number,
      isActive: boolean,
      onDone?: () => void,
    ) => {
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
                  onPress: () =>
                    performStatus(moduleName, itemId, isActive ? 'disable' : 'enable', onDone),
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
                  onPress: () => performStatus(moduleName, itemId, 'deleted', onDone),
                },
              ],
            );
          },
        },
      ];
      Alert.alert(title, message, buttons);
    },
    [performStatus, t],
  );

  const parent = parentData?.data;
  const approvedChildren: ChildWithGradeDto[] = childrenData?.data ?? [];
  const pendingChildren: Child[] = pendingData?.data ?? [];

  // Dedup pending by childId
  const approvedIds = new Set(approvedChildren.map((c) => c.childId));
  const filteredPending = pendingChildren.filter((c) => !approvedIds.has(c.childId));

  const isLoading = parentLoading || childrenLoading || pendingLoading;

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchParent(), refetchChildren(), refetchPending()]);
    setRefreshing(false);
  }, [refetchParent, refetchChildren, refetchPending]);

  // ── Edit helpers ──
  const openEdit = () => {
    if (!parent) return;
    setEditForm({
      firstName: parent.firstName || '',
      lastName: parent.lastName || '',
      fatherName: parent.fatherName || '',
      // Show clean local digits so the +242 leftIcon stays the canonical
      // prefix and the user never sees the country code duplicated.
      phoneNumber: extractLocalDigits(parent.phoneNumber || '', COUNTRY_CODE),
      email: parent.email || '',
      civilId: parent.civilId || '',
    });
    setEditVisible(true);
  };

  const handleSaveParent = async () => {
    if (!editForm.firstName.trim() || !editForm.lastName.trim()) {
      Alert.alert(t('common.error', 'Error'), t('director.parents.requiredFields', 'First name and last name are required.'));
      return;
    }
    // Preserve the leading 0 — backend stores phones as-typed.
    const localPhone = editForm.phoneNumber.replace(/\D/g, '');

    try {
      await updateParent({
        parentId,
        firstName: editForm.firstName.trim(),
        lastName: editForm.lastName.trim(),
        fatherName: editForm.fatherName.trim() || '',
        countryCode: COUNTRY_CODE,
        phoneNumber: localPhone || undefined,
        email: editForm.email.trim() || '',
        civilId: editForm.civilId.trim() || '',
      }).unwrap();
      setEditVisible(false);
      Alert.alert(t('common.success', 'Success'), t('director.parents.updated', 'Parent updated.'));
    } catch (err: any) {
      Alert.alert(
        t('common.error', 'Error'),
        err?.data?.error || err?.data?.message || t('common.genericError', 'Something went wrong'),
      );
    }
  };

  // ── Add child helpers ──
  const handleAddChild = async () => {
    if (!childForm.firstName.trim() || !childForm.lastName.trim() || !childForm.dateOfBirth.trim()) {
      Alert.alert(
        t('common.error', 'Error'),
        t('director.parents.childRequiredFields', 'First name, last name and date of birth are required.'),
      );
      return;
    }
    // Basic date format validation YYYY-MM-DD
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(childForm.dateOfBirth.trim())) {
      Alert.alert(t('common.error', 'Error'), t('director.parents.invalidDate', 'Date format must be YYYY-MM-DD.'));
      return;
    }
    try {
      await addChild({
        firstName: childForm.firstName.trim(),
        lastName: childForm.lastName.trim(),
        fatherName: childForm.fatherName.trim() || undefined,
        dateOfBirth: childForm.dateOfBirth.trim(),
        parentId,
        schoolId,
      }).unwrap();
      setAddChildVisible(false);
      setChildForm(EMPTY_CHILD);
      Alert.alert(
        t('common.success', 'Success'),
        t('director.parents.childAdded', 'Child added. It is pending approval.'),
      );
    } catch (err: any) {
      Alert.alert(
        t('common.error', 'Error'),
        err?.data?.error || err?.data?.message || t('common.genericError', 'Something went wrong'),
      );
    }
  };

  if (isLoading) {
    return (
      <ScreenContainer>
        <ScreenSkeleton count={5} />
      </ScreenContainer>
    );
  }

  if (!parent) {
    return (
      <ScreenContainer>
        <Pressable onPress={() => router.back()} style={styles.backRow}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
          <ThemedText variant="h1">{t('director.parents.detailTitle', 'Parent Details')}</ThemedText>
        </Pressable>
        <ThemedText variant="body" color={theme.colors.textSecondary}>
          {t('director.parents.notFound', 'Parent not found.')}
        </ThemedText>
      </ScreenContainer>
    );
  }

  const statusColors: Record<string, string> = {
    approved: theme.colors.success,
    pending: theme.colors.warning,
    rejected: theme.colors.error,
  };

  const statusLabels: Record<string, string> = {
    approved: t('children.approved', 'Approved'),
    pending: t('children.pending', 'Pending'),
    rejected: t('children.rejected', 'Rejected'),
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
          <ThemedText variant="h1">{t('director.parents.detailTitle', 'Parent Details')}</ThemedText>
        </View>

        {/* Profile card */}
        <ThemedCard variant="elevated" style={styles.profileCard}>
          <View style={styles.profileRow}>
            <Avatar firstName={parent.firstName} lastName={parent.lastName} size="lg" />
            <View style={styles.profileInfo}>
              <ThemedText variant="title">
                {parent.firstName} {parent.lastName}
              </ThemedText>
              {parent.fatherName ? (
                <ThemedText variant="caption" color={theme.colors.textSecondary}>
                  {t('director.parents.fatherName', 'Father')}: {parent.fatherName}
                </ThemedText>
              ) : null}
              <View style={styles.statusInline}>
                <View
                  style={[
                    styles.dot,
                    {
                      backgroundColor:
                        parent.fK_StatusId === 1 ? theme.colors.success : theme.colors.warning,
                    },
                  ]}
                />
                <ThemedText
                  variant="caption"
                  color={
                    parent.fK_StatusId === 1 ? theme.colors.success : theme.colors.warning
                  }
                  style={{ fontWeight: '500', fontSize: 11 }}
                >
                  {parent.fK_StatusId === 1
                    ? t('common.active', 'Active')
                    : t('common.inactive', 'Inactive')}
                </ThemedText>
              </View>
            </View>
            <Pressable
              onPress={openEdit}
              style={[
                styles.editBtn,
                { backgroundColor: theme.colors.primary + '15', borderRadius: theme.borderRadius.full },
              ]}
            >
              <Ionicons name="pencil-outline" size={18} color={theme.colors.primary} />
            </Pressable>
            <Pressable
              onPress={() =>
                showActionSheet(
                  'schoolparentssection',
                  parent.parentId,
                  parent.fK_StatusId === 1,
                )
              }
              style={[
                styles.editBtn,
                { backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.full },
              ]}
            >
              <Ionicons name="ellipsis-vertical" size={18} color={theme.colors.text} />
            </Pressable>
          </View>
        </ThemedCard>

        {/* Contact info */}
        <SectionHeader title={t('director.parents.contact', 'Contact')} style={styles.section} />
        <ThemedCard variant="outlined" style={styles.infoCard}>
          <InfoRow
            icon="call-outline"
            label={t('auth.phone', 'Phone')}
            value={`+${parent.countryCode} ${parent.phoneNumber}`}
            color={theme.colors.primary}
          />
          {parent.email ? (
            <InfoRow
              icon="mail-outline"
              label={t('auth.email', 'Email')}
              value={parent.email}
              color={theme.colors.secondary}
            />
          ) : null}
          {parent.civilId ? (
            <InfoRow
              icon="card-outline"
              label={t('auth.civilId', 'Civil ID')}
              value={parent.civilId}
              color={theme.colors.accent}
            />
          ) : null}
        </ThemedCard>

        {/* Children */}
        <View style={styles.childrenHeader}>
          <SectionHeader title={t('director.parents.children', 'Children')} style={styles.section} />
          <Pressable
            onPress={() => setAddChildVisible(true)}
            style={[
              styles.addChildBtn,
              { backgroundColor: theme.colors.primary, borderRadius: theme.borderRadius.full },
            ]}
          >
            <Ionicons name="add" size={20} color="#fff" />
          </Pressable>
        </View>

        {approvedChildren.length === 0 && filteredPending.length === 0 ? (
          <ThemedCard variant="outlined" style={styles.emptyChildren}>
            <ThemedText variant="caption" color={theme.colors.textSecondary} align="center">
              {t('director.parents.noChildren', 'No children yet. Tap + to add one.')}
            </ThemedText>
          </ThemedCard>
        ) : (
          <>
            {filteredPending.map((child) => {
              const status = getChildStatus(child.fK_StatusId);
              return (
                <ThemedCard key={child.childId} variant="outlined" style={styles.childCard}>
                  <View style={styles.childRow}>
                    <Avatar firstName={child.firstName} lastName={child.lastName} size="sm" />
                    <View style={styles.childInfo}>
                      <ThemedText variant="bodySmall" style={{ fontWeight: '600' }}>
                        {child.firstName} {child.lastName}
                      </ThemedText>
                      <ThemedText variant="caption" color={theme.colors.textTertiary}>
                        {formatDate(child.dateOfBirth)}
                      </ThemedText>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor: statusColors[status],
                          borderRadius: theme.borderRadius.full,
                        },
                      ]}
                    >
                      <ThemedText variant="caption" color="#fff" style={styles.statusTxt}>
                        {statusLabels[status]}
                      </ThemedText>
                    </View>
                    <Pressable
                      onPress={() =>
                        showActionSheet(
                          'schoolchildrensection',
                          child.childId,
                          child.fK_StatusId === 1 || status === 'pending',
                          refetchPending,
                        )
                      }
                      hitSlop={8}
                      style={styles.childMore}
                    >
                      <Ionicons
                        name="ellipsis-vertical"
                        size={16}
                        color={theme.colors.textSecondary}
                      />
                    </Pressable>
                  </View>
                </ThemedCard>
              );
            })}

            {approvedChildren.map((child) => (
              <ThemedCard key={child.childId} variant="outlined" style={styles.childCard}>
                <View style={styles.childRow}>
                  <Avatar firstName={child.firstName} lastName={child.lastName} size="sm" />
                  <View style={styles.childInfo}>
                    <ThemedText variant="bodySmall" style={{ fontWeight: '600' }}>
                      {child.firstName} {child.lastName}
                    </ThemedText>
                    {child.schoolGradeName ? (
                      <ThemedText variant="caption" color={theme.colors.textSecondary}>
                        {child.schoolGradeName}
                      </ThemedText>
                    ) : null}
                    <ThemedText variant="caption" color={theme.colors.textTertiary}>
                      {formatDate(child.dateOfBirth)}
                    </ThemedText>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor: statusColors.approved,
                        borderRadius: theme.borderRadius.full,
                      },
                    ]}
                  >
                    <ThemedText variant="caption" color="#fff" style={styles.statusTxt}>
                      {statusLabels.approved}
                    </ThemedText>
                  </View>
                  <Pressable
                    onPress={() =>
                      showActionSheet(
                        'schoolchildrensection',
                        child.childId,
                        true,
                        refetchChildren,
                      )
                    }
                    hitSlop={8}
                    style={styles.childMore}
                  >
                    <Ionicons
                      name="ellipsis-vertical"
                      size={16}
                      color={theme.colors.textSecondary}
                    />
                  </Pressable>
                </View>
              </ThemedCard>
            ))}
          </>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Edit Parent Modal */}
      <Modal visible={editVisible} animationType="fade" transparent onRequestClose={() => setEditVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setEditVisible(false)}>
          <Pressable
            style={[styles.modalBox, { backgroundColor: theme.colors.card, borderRadius: theme.borderRadius.lg }]}
            onPress={(e) => e.stopPropagation()}
          >
            <ThemedText variant="subtitle" style={styles.modalTitle}>
              {t('director.parents.editParent', 'Edit Parent')}
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
              label={t('auth.phone', 'Phone')}
              value={editForm.phoneNumber}
              onChangeText={(v) => setEditForm((p) => ({ ...p, phoneNumber: v.replace(/\D/g, '') }))}
              keyboardType="phone-pad"
              leftIcon={
                <ThemedText variant="caption" color={theme.colors.textSecondary}>
                  {COUNTRY_CODE}
                </ThemedText>
              }
            />
            <ThemedInput
              label={t('auth.email', 'Email')}
              value={editForm.email}
              onChangeText={(v) => setEditForm((p) => ({ ...p, email: v }))}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <ThemedInput
              label={t('auth.civilId', 'Civil ID')}
              value={editForm.civilId}
              onChangeText={(v) => setEditForm((p) => ({ ...p, civilId: v }))}
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
                onPress={handleSaveParent}
                loading={saving}
                style={styles.modalBtn}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Add Child Modal */}
      <Modal visible={addChildVisible} animationType="fade" transparent onRequestClose={() => setAddChildVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setAddChildVisible(false)}>
          <Pressable
            style={[styles.modalBox, { backgroundColor: theme.colors.card, borderRadius: theme.borderRadius.lg }]}
            onPress={(e) => e.stopPropagation()}
          >
            <ThemedText variant="subtitle" style={styles.modalTitle}>
              {t('director.parents.addChild', 'Add Child')}
            </ThemedText>
            <ThemedText variant="caption" color={theme.colors.textSecondary} style={styles.modalDesc}>
              {t('director.parents.addChildDesc', 'The child will be added as pending and visible once approved.')}
            </ThemedText>

            <ThemedInput
              label={t('auth.firstName', 'First Name')}
              value={childForm.firstName}
              onChangeText={(v) => setChildForm((p) => ({ ...p, firstName: v }))}
            />
            <ThemedInput
              label={t('auth.lastName', 'Last Name')}
              value={childForm.lastName}
              onChangeText={(v) => setChildForm((p) => ({ ...p, lastName: v }))}
            />
            <ThemedInput
              label={t('auth.fatherName', 'Father Name')}
              value={childForm.fatherName}
              onChangeText={(v) => setChildForm((p) => ({ ...p, fatherName: v }))}
            />
            <ThemedInput
              label={t('director.parents.dateOfBirth', 'Date of Birth (YYYY-MM-DD)')}
              value={childForm.dateOfBirth}
              onChangeText={(v) => setChildForm((p) => ({ ...p, dateOfBirth: v }))}
              placeholder="2010-06-15"
              keyboardType="numeric"
            />

            <View style={styles.modalActions}>
              <ThemedButton
                title={t('common.cancel', 'Cancel')}
                variant="ghost"
                onPress={() => setAddChildVisible(false)}
                style={styles.modalBtn}
              />
              <ThemedButton
                title={t('director.parents.addChild', 'Add Child')}
                variant="primary"
                onPress={handleAddChild}
                loading={addingChild}
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
// InfoRow helper
// ---------------------------------------------------------------------------

interface InfoRowProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
  color: string;
}

const InfoRow: React.FC<InfoRowProps> = ({ icon, label, value, color }) => {
  const { theme } = useTheme();
  return (
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
    </View>
  );
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
  editBtn: {
    width: 36, height: 36,
    alignItems: 'center', justifyContent: 'center',
  },
  section: { paddingHorizontal: 16, marginTop: 12 },
  infoCard: { marginHorizontal: 16, padding: 0, overflow: 'hidden', marginBottom: 4 },
  childrenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 16,
  },
  addChildBtn: {
    width: 32, height: 32,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 12,
  },
  emptyChildren: {
    marginHorizontal: 16,
    paddingVertical: 20,
  },
  childCard: { marginHorizontal: 16, marginBottom: 8 },
  childRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  childInfo: { flex: 1 },
  childMore: { padding: 4 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2 },
  statusTxt: { fontWeight: '600', fontSize: 10 },
  statusInline: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalBox: { padding: 20 },
  modalTitle: { marginBottom: 8, fontWeight: '700' },
  modalDesc: { marginBottom: 12 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  modalBtn: { flex: 1 },
});

export default DirectorParentDetailScreen;
