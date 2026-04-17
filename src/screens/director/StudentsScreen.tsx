import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  FlatList,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';

import {
  ScreenContainer,
  ThemedText,
  ThemedCard,
  ThemedInput,
  ThemedButton,
  Avatar,
  ScreenSkeleton,
} from '../../components';
import { useTheme } from '../../theme';
import { useAnimatedEntry, staggerDelay, useAppSelector } from '../../hooks';
import {
  useGetChildrenListingQuery,
  useGetPendingChildrenQuery,
  useApproveChildMutation,
  useRejectChildMutation,
} from '../../services/api/apiSlice';
import type { Child } from '../../types';

type Tab = 'students' | 'pending';

const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// PendingChildCard
// ---------------------------------------------------------------------------

const PendingChildCard: React.FC<{
  child: Child;
  index: number;
  onApprove: (childId: number) => void;
  onReject: (childId: number) => void;
  isApproving: boolean;
}> = ({ child, index, onApprove, onReject, isApproving }) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const anim = useAnimatedEntry({ type: 'slideUp', delay: staggerDelay(index, 50) });

  const dobFormatted = child.dateOfBirth
    ? new Date(child.dateOfBirth).toLocaleDateString()
    : '';

  return (
    <Animated.View style={anim}>
      <ThemedCard variant="elevated" style={styles.pendingCard}>
        <View style={styles.pendingRow}>
          <Avatar firstName={child.firstName} lastName={child.lastName} size="lg" />
          <View style={styles.pendingInfo}>
            <ThemedText variant="subtitle">
              {child.firstName} {child.lastName}
            </ThemedText>
            {child.fatherName ? (
              <ThemedText variant="caption" color={theme.colors.textSecondary}>
                {t('director.students.father', 'Father')}: {child.fatherName}
              </ThemedText>
            ) : null}
            {dobFormatted ? (
              <ThemedText variant="caption" color={theme.colors.textSecondary}>
                {t('children.dateOfBirth', 'Date of Birth')}: {dobFormatted}
              </ThemedText>
            ) : null}
            {child.createdOn ? (
              <ThemedText variant="caption" color={theme.colors.textTertiary}>
                {t('director.students.requestedOn', 'Requested')}: {new Date(child.createdOn).toLocaleDateString()}
              </ThemedText>
            ) : null}
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.actionRow}>
          <Pressable
            onPress={() => onReject(child.childId)}
            style={[
              styles.actionBtn,
              styles.rejectBtn,
              { borderColor: theme.colors.error, borderRadius: theme.borderRadius.md },
            ]}
          >
            <Ionicons name="close" size={18} color={theme.colors.error} />
            <ThemedText variant="caption" color={theme.colors.error} style={styles.actionText}>
              {t('director.students.reject', 'Reject')}
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() => onApprove(child.childId)}
            disabled={isApproving}
            style={[
              styles.actionBtn,
              styles.approveBtn,
              { backgroundColor: theme.colors.primary, borderRadius: theme.borderRadius.md },
            ]}
          >
            <Ionicons name="checkmark" size={18} color="#fff" />
            <ThemedText variant="caption" color="#fff" style={styles.actionText}>
              {t('director.students.approve', 'Approve')}
            </ThemedText>
          </Pressable>
        </View>
      </ThemedCard>
    </Animated.View>
  );
};

// ---------------------------------------------------------------------------
// StudentsScreen
// ---------------------------------------------------------------------------

const StudentsScreen: React.FC = () => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const user = useAppSelector((state) => state.auth.user);
  const schoolId = parseInt(user?.schoolId || '0');

  const [activeTab, setActiveTab] = useState<Tab>('students');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Reject modal state
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectChildId, setRejectChildId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // All students query
  const {
    data: childrenRes,
    isLoading: studentsLoading,
    isFetching: studentsFetching,
  } = useGetChildrenListingQuery(
    { pageNumber: page, pageSize: PAGE_SIZE, search: search.trim() || undefined },
    { skip: activeTab !== 'students' },
  );

  // Pending children query
  const {
    data: pendingRes,
    isLoading: pendingLoading,
    isFetching: pendingFetching,
    refetch: refetchPending,
  } = useGetPendingChildrenQuery(
    { schoolId, pageNumber: 1, pageSize: 50 },
    { skip: activeTab !== 'pending' || !schoolId },
  );

  const [approveChild, { isLoading: isApproving }] = useApproveChildMutation();
  const [rejectChild, { isLoading: isRejecting }] = useRejectChildMutation();

  const children = childrenRes?.data || [];
  const totalCount = childrenRes?.totalCount || 0;
  const hasMore = children.length >= PAGE_SIZE && page * PAGE_SIZE < totalCount;

  const pendingChildren = pendingRes?.data || [];

  const headerAnim = useAnimatedEntry({ type: 'slideUp', delay: staggerDelay(0) });

  const handleSearchChange = useCallback((text: string) => {
    setSearch(text);
    setPage(1);
  }, []);

  const handleLoadMore = useCallback(() => {
    if (hasMore && !studentsFetching) {
      setPage((prev) => prev + 1);
    }
  }, [hasMore, studentsFetching]);

  const handleApprove = useCallback(
    async (childId: number) => {
      Alert.alert(
        t('director.students.confirmApprove', 'Approve Child'),
        t('director.students.confirmApproveDesc', 'Are you sure you want to approve this child registration?'),
        [
          { text: t('common.cancel', 'Cancel'), style: 'cancel' },
          {
            text: t('director.students.approve', 'Approve'),
            onPress: async () => {
              try {
                await approveChild(childId).unwrap();
                Alert.alert(
                  t('common.success', 'Success'),
                  t('director.students.approveSuccess', 'Child approved successfully.'),
                );
                refetchPending();
              } catch (err: any) {
                Alert.alert(
                  t('common.error', 'Error'),
                  err?.data?.message || t('director.students.approveFailed', 'Failed to approve child.'),
                );
              }
            },
          },
        ],
      );
    },
    [approveChild, refetchPending, t],
  );

  const handleRejectPress = useCallback((childId: number) => {
    setRejectChildId(childId);
    setRejectReason('');
    setRejectModalVisible(true);
  }, []);

  const handleRejectConfirm = useCallback(async () => {
    if (!rejectChildId) return;
    if (!rejectReason.trim()) {
      Alert.alert(
        t('common.error', 'Error'),
        t('director.students.rejectReasonRequired', 'Please provide a reason for rejection.'),
      );
      return;
    }
    try {
      await rejectChild({ childId: rejectChildId, reason: rejectReason.trim() }).unwrap();
      setRejectModalVisible(false);
      Alert.alert(
        t('common.success', 'Success'),
        t('director.students.rejectSuccess', 'Child registration rejected.'),
      );
      refetchPending();
    } catch (err: any) {
      Alert.alert(
        t('common.error', 'Error'),
        err?.data?.message || t('director.students.rejectFailed', 'Failed to reject child.'),
      );
    }
  }, [rejectChildId, rejectReason, rejectChild, refetchPending, t]);

  const isLoading = activeTab === 'students' ? studentsLoading : pendingLoading;

  const openChildDetail = useCallback(
    (childId: number) => {
      router.push({
        pathname: '/(app)/director-child-detail',
        params: { childId: String(childId) },
      });
    },
    [router],
  );

  // ─── Student card ────────────────────────────────────────────
  const renderStudent = ({ item }: { item: Child }) => (
    <ThemedCard
      variant="elevated"
      style={styles.studentCard}
      onPress={() => openChildDetail(item.childId)}
    >
      <View style={styles.studentRow}>
        <Avatar firstName={item.firstName} lastName={item.lastName} size="lg" />
        <View style={styles.studentInfo}>
          <ThemedText variant="subtitle">
            {item.firstName} {item.lastName}
          </ThemedText>
          <ThemedText variant="caption" color={theme.colors.textSecondary}>
            {t('director.students.parent', 'Parent')}: {item.fatherName}
          </ThemedText>
        </View>
        <Ionicons name="chevron-forward" size={20} color={theme.colors.textTertiary} />
      </View>
    </ThemedCard>
  );

  // ─── Pending card ────────────────────────────────────────────
  const renderPending = ({ item, index }: { item: Child; index: number }) => (
    <PendingChildCard
      child={item}
      index={index}
      onApprove={handleApprove}
      onReject={handleRejectPress}
      isApproving={isApproving}
    />
  );

  if (isLoading) {
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
        <ThemedText variant="h1">{t('director.students.title', 'Students')}</ThemedText>
        {activeTab === 'students' && (
          <ThemedText variant="bodySmall" color={theme.colors.textSecondary}>
            {totalCount.toLocaleString()} {t('director.students.students', 'Students')}
          </ThemedText>
        )}
        {activeTab === 'pending' && (
          <ThemedText variant="bodySmall" color={theme.colors.textSecondary}>
            {pendingChildren.length} {t('director.students.pendingCount', 'pending')}
          </ThemedText>
        )}
      </Animated.View>

      {/* Tab Switcher */}
      <View style={styles.tabRow}>
        <Pressable
          onPress={() => setActiveTab('students')}
          style={[
            styles.tab,
            {
              backgroundColor: activeTab === 'students' ? theme.colors.primary : 'transparent',
              borderColor: theme.colors.primary,
              borderRadius: theme.borderRadius.md,
            },
          ]}
        >
          <Ionicons
            name="school-outline"
            size={16}
            color={activeTab === 'students' ? '#fff' : theme.colors.primary}
            style={styles.tabIcon}
          />
          <ThemedText
            variant="caption"
            color={activeTab === 'students' ? '#fff' : theme.colors.primary}
            style={styles.tabLabel}
          >
            {t('director.students.allStudents', 'All Students')}
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab('pending')}
          style={[
            styles.tab,
            {
              backgroundColor: activeTab === 'pending' ? theme.colors.primary : 'transparent',
              borderColor: theme.colors.primary,
              borderRadius: theme.borderRadius.md,
            },
          ]}
        >
          <Ionicons
            name="time-outline"
            size={16}
            color={activeTab === 'pending' ? '#fff' : theme.colors.primary}
            style={styles.tabIcon}
          />
          <ThemedText
            variant="caption"
            color={activeTab === 'pending' ? '#fff' : theme.colors.primary}
            style={styles.tabLabel}
          >
            {t('director.students.pendingApproval', 'Pending')}
          </ThemedText>
          {pendingChildren.length > 0 && activeTab !== 'pending' && (
            <View style={[styles.badge, { backgroundColor: theme.colors.error }]}>
              <ThemedText variant="caption" color="#fff" style={styles.badgeText}>
                {pendingChildren.length}
              </ThemedText>
            </View>
          )}
        </Pressable>
      </View>

      {/* Students Tab */}
      {activeTab === 'students' && (
        <>
          <View style={styles.searchRow}>
            <ThemedInput
              placeholder={t('director.students.search', 'Search students or parents...')}
              value={search}
              onChangeText={handleSearchChange}
              leftIcon={<Ionicons name="search" size={18} color={theme.colors.textTertiary} />}
              containerStyle={styles.searchInput}
            />
          </View>
          <FlatList
            data={children}
            keyExtractor={(item) => String(item.childId)}
            renderItem={renderStudent}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              studentsFetching ? <ActivityIndicator style={{ marginVertical: 16 }} /> : null
            }
          />
        </>
      )}

      {/* Pending Tab */}
      {activeTab === 'pending' && (
        <>
          {pendingFetching && !pendingLoading ? (
            <ActivityIndicator style={{ marginTop: 24 }} color={theme.colors.primary} />
          ) : null}
          {pendingChildren.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="checkmark-circle-outline" size={56} color={theme.colors.success} />
              <ThemedText variant="body" color={theme.colors.textSecondary} style={styles.emptyText}>
                {t('director.students.noPending', 'No pending registrations')}
              </ThemedText>
            </View>
          ) : (
            <FlatList
              data={pendingChildren}
              keyExtractor={(item) => String(item.childId)}
              renderItem={renderPending}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
            />
          )}
        </>
      )}

      {/* Reject Reason Modal */}
      <Modal
        visible={rejectModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setRejectModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setRejectModalVisible(false)}>
          <Pressable
            style={[
              styles.modalContent,
              { backgroundColor: theme.colors.card, borderRadius: theme.borderRadius.lg },
            ]}
            onPress={() => {}}
          >
            <ThemedText variant="subtitle" style={styles.modalTitle}>
              {t('director.students.rejectTitle', 'Reject Registration')}
            </ThemedText>
            <ThemedText variant="caption" color={theme.colors.textSecondary} style={styles.modalDesc}>
              {t('director.students.rejectDesc', 'Please provide a reason for rejecting this child registration. The parent will be notified.')}
            </ThemedText>
            <ThemedInput
              label={t('director.students.reason', 'Reason')}
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder={t('director.students.reasonPlaceholder', 'Enter rejection reason...')}
              multiline
              numberOfLines={3}
            />
            <View style={styles.modalActions}>
              <ThemedButton
                title={t('common.cancel', 'Cancel')}
                variant="ghost"
                size="md"
                onPress={() => setRejectModalVisible(false)}
                style={styles.modalBtn}
              />
              <ThemedButton
                title={isRejecting ? t('common.loading', 'Loading...') : t('director.students.reject', 'Reject')}
                variant="danger"
                size="md"
                onPress={handleRejectConfirm}
                disabled={isRejecting}
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
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 12,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
  },
  tabIcon: {
    marginRight: 6,
  },
  tabLabel: {
    fontWeight: '600',
  },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  searchRow: { paddingHorizontal: 16 },
  searchInput: { marginBottom: 8 },
  list: { paddingHorizontal: 16, paddingBottom: 32 },

  // Student card
  studentCard: { marginBottom: 10 },
  studentRow: { flexDirection: 'row', alignItems: 'center' },
  studentInfo: { flex: 1, marginLeft: 14 },

  // Pending card
  pendingCard: { marginBottom: 12 },
  pendingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  pendingInfo: { flex: 1, marginLeft: 14 },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  rejectBtn: {
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  approveBtn: {},
  actionText: {
    fontWeight: '600',
    marginLeft: 4,
  },

  // Empty
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    marginTop: 12,
    textAlign: 'center',
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
  },
  modalTitle: {
    marginBottom: 8,
  },
  modalDesc: {
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
});

export default StudentsScreen;
