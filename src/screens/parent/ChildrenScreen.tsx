import React, { useMemo } from 'react';
import { View, StyleSheet, Pressable, SectionList } from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';

import {
  ScreenContainer,
  ThemedText,
  ThemedCard,
  Avatar,
  EmptyState,
  ScreenSkeleton,
} from '../../components';
import { useTheme } from '../../theme';
import { useAnimatedEntry, staggerDelay, useAppSelector } from '../../hooks';
import {
  useGetParentChildrenQuery,
  useGetParentPendingRejectedChildrenQuery,
} from '../../services/api/apiSlice';
import type { ChildWithGradeDto, Child } from '../../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type DisplayChild = {
  childId: number;
  firstName: string;
  lastName: string;
  schoolName?: string;
  gradeName?: string;
  status: 'approved' | 'pending' | 'rejected';
};

function getStatusFromId(statusId: number): DisplayChild['status'] {
  if (statusId === 6) return 'pending';
  if (statusId === 13) return 'rejected';
  return 'approved';
}

function mapApproved(c: ChildWithGradeDto): DisplayChild {
  return {
    childId: c.childId,
    firstName: c.firstName,
    lastName: c.lastName,
    schoolName: c.schoolName,
    gradeName: c.schoolGradeName ?? undefined,
    status: getStatusFromId(c.fK_StatusId),
  };
}

function mapPendingRejected(c: Child): DisplayChild {
  return {
    childId: c.childId,
    firstName: c.firstName,
    lastName: c.lastName,
    status: getStatusFromId(c.fK_StatusId),
  };
}

// ---------------------------------------------------------------------------
// ChildCard
// ---------------------------------------------------------------------------

interface ChildCardProps {
  child: DisplayChild;
  index: number;
  onPress: () => void;
}

const ChildCard: React.FC<ChildCardProps> = ({ child, index, onPress }) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const anim = useAnimatedEntry({ type: 'slideUp', delay: staggerDelay(index + 1) });

  const statusConfig = {
    approved: {
      bg: theme.colors.success,
      label: t('children.approved', 'Approved'),
    },
    pending: {
      bg: theme.colors.warning,
      label: t('children.pending', 'Pending'),
    },
    rejected: {
      bg: theme.colors.error,
      label: t('children.rejected', 'Rejected'),
    },
  };
  const sc = statusConfig[child.status];

  return (
    <Animated.View style={anim}>
      <ThemedCard variant="elevated" onPress={onPress} style={styles.childCard}>
        <View style={styles.childRow}>
          <Avatar firstName={child.firstName} lastName={child.lastName} size="md" />
          <View style={styles.childInfo}>
            <ThemedText variant="body" style={{ fontWeight: '600' }}>
              {child.firstName} {child.lastName}
            </ThemedText>
            {child.schoolName ? (
              <ThemedText variant="caption" color={theme.colors.textSecondary}>
                {child.schoolName}
              </ThemedText>
            ) : null}
            <View style={styles.badgeRow}>
              {child.gradeName ? (
                <View
                  style={[
                    styles.gradeBadge,
                    { backgroundColor: theme.colors.primary, borderRadius: theme.borderRadius.sm },
                  ]}
                >
                  <ThemedText variant="caption" color="#FFFFFF" style={styles.gradeTxt}>
                    {child.gradeName}
                  </ThemedText>
                </View>
              ) : null}
              {/* Approval badge */}
              <View
                style={[
                  styles.approvalBadge,
                  { backgroundColor: sc.bg, borderRadius: theme.borderRadius.full },
                ]}
              >
                <ThemedText variant="caption" color="#FFFFFF" style={styles.approvalTxt} numberOfLines={1}>
                  {sc.label}
                </ThemedText>
              </View>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.textTertiary} />
        </View>
      </ThemedCard>
    </Animated.View>
  );
};

// ---------------------------------------------------------------------------
// ChildrenScreen
// ---------------------------------------------------------------------------

const ChildrenScreen: React.FC = () => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const user = useAppSelector((state) => state.auth.user);
  const parentId = parseInt(user?.entityUserId || '0');

  const {
    data: childrenData,
    isLoading: childrenLoading,
  } = useGetParentChildrenQuery(
    { parentId, pageNumber: 1, pageSize: 50 },
    { skip: !parentId },
  );

  const {
    data: pendingData,
    isLoading: pendingLoading,
  } = useGetParentPendingRejectedChildrenQuery(
    { parentId, pageNumber: 1, pageSize: 50 },
    { skip: !parentId },
  );

  const approvedChildren = useMemo(
    () => (childrenData?.data ?? []).map(mapApproved),
    [childrenData],
  );

  const pendingRejectedChildren = useMemo(
    () => (pendingData?.data ?? []).map(mapPendingRejected),
    [pendingData],
  );

  // Deduplicate: remove from pending list any that already appear in approved
  const approvedIds = useMemo(
    () => new Set(approvedChildren.map((c) => c.childId)),
    [approvedChildren],
  );
  const filteredPending = useMemo(
    () => pendingRejectedChildren.filter((c) => !approvedIds.has(c.childId)),
    [pendingRejectedChildren, approvedIds],
  );

  const sections = useMemo(() => {
    const result: { title: string; data: DisplayChild[] }[] = [];
    if (filteredPending.length > 0) {
      result.push({
        title: t('children.pending', 'Pending Approval'),
        data: filteredPending,
      });
    }
    if (approvedChildren.length > 0) {
      result.push({
        title: t('children.approved', 'Approved'),
        data: approvedChildren,
      });
    }
    return result;
  }, [approvedChildren, filteredPending, t]);

  const isLoading = childrenLoading || pendingLoading;
  const isEmpty = approvedChildren.length === 0 && filteredPending.length === 0;

  const headerAnim = useAnimatedEntry({ type: 'slideUp', delay: staggerDelay(0) });

  if (isLoading) {
    return (
      <ScreenContainer scrollable={false}>
        <Animated.View style={[styles.header, headerAnim]}>
          <ThemedText variant="h1">{t('parent.children.title', 'My Children')}</ThemedText>
        </Animated.View>
        <View style={styles.list}>
          <ScreenSkeleton count={3} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scrollable={false}>
      {/* Header */}
      <Animated.View style={[styles.header, headerAnim]}>
        <ThemedText variant="h1">{t('parent.children.title', 'My Children')}</ThemedText>
        <Pressable
          onPress={() => router.push('/(app)/add-child')}
          style={[
            styles.addBtn,
            { backgroundColor: theme.colors.primary, borderRadius: theme.borderRadius.full },
          ]}
        >
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </Pressable>
      </Animated.View>

      {isEmpty ? (
        <EmptyState
          icon="people-outline"
          title={t('parent.children.emptyTitle', 'No Children Yet')}
          description={t('parent.children.emptyDesc', 'Add your first child to get started with fee management.')}
          actionLabel={t('parent.children.addChild', 'Add Child')}
          onAction={() => router.push('/(app)/add-child')}
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => String(item.childId)}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <ThemedText variant="caption" color={theme.colors.textSecondary} style={styles.sectionTitle}>
                {section.title}
              </ThemedText>
            </View>
          )}
          renderItem={({ item, index }) => (
            <ChildCard
              child={item}
              index={index}
              onPress={() => router.push({ pathname: '/(app)/child-detail', params: { childId: String(item.childId), schoolName: item.schoolName || '' } })}
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
        />
      )}
    </ScreenContainer>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 8,
    paddingHorizontal: 16,
  },
  addBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  sectionHeader: {
    marginTop: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  childCard: {
    marginBottom: 12,
  },
  childRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  childInfo: {
    flex: 1,
    marginLeft: 16,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  gradeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  gradeTxt: {
    fontWeight: '500',
    fontSize: 10,
  },
  approvalBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  approvalTxt: {
    fontWeight: '500',
    fontSize: 10,
  },
});

export default ChildrenScreen;
