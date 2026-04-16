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
  useGetParentsCollectingAgentsQuery,
  useGetMyAgentRequestsQuery,
} from '../../services/api/apiSlice';
import type { CollectingAgentParents } from '../../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type AgentStatus = 'approved' | 'pending' | 'rejected';

const getStatus = (row: CollectingAgentParents): AgentStatus => {
  if (row.approvalStatus === 'Pending') return 'pending';
  if (row.approvalStatus === 'Rejected') return 'rejected';
  return 'approved';
};

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

interface AgentRowProps {
  row: CollectingAgentParents;
  index: number;
  onPress: () => void;
}

const AgentRow: React.FC<AgentRowProps> = ({ row, index, onPress }) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const anim = useAnimatedEntry({ type: 'slideUp', delay: staggerDelay(index + 1) });

  const status = getStatus(row);
  const agent = row.collectingAgent;
  const firstName = agent?.firstName || '';
  const lastName = agent?.lastName || '';

  const statusConfig: Record<AgentStatus, { bg: string; label: string }> = {
    approved: {
      bg: theme.colors.success,
      label: t('parent.agents.statusApproved', 'Active'),
    },
    pending: {
      bg: theme.colors.warning,
      label: t('parent.agents.statusPending', 'Pending'),
    },
    rejected: {
      bg: theme.colors.error,
      label: t('parent.agents.statusRejected', 'Rejected'),
    },
  };
  const sc = statusConfig[status];

  return (
    <Animated.View style={anim}>
      <ThemedCard variant="elevated" onPress={onPress} style={styles.card}>
        <View style={styles.row}>
          <Avatar firstName={firstName} lastName={lastName} size="lg" />
          <View style={styles.info}>
            <ThemedText variant="subtitle">
              {firstName} {lastName}
            </ThemedText>
            {agent?.assignedArea ? (
              <ThemedText variant="caption" color={theme.colors.textSecondary}>
                {agent.assignedArea}
              </ThemedText>
            ) : null}
            <View style={styles.badgeRow}>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: sc.bg, borderRadius: theme.borderRadius.full },
                ]}
              >
                <ThemedText variant="caption" color="#FFFFFF" style={styles.statusTxt}>
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
// Screen
// ---------------------------------------------------------------------------

const ParentMyAgentsScreen: React.FC = () => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const user = useAppSelector((state) => state.auth.user);
  const parentId = parseInt(user?.entityUserId || '0');

  const {
    data: approvedData,
    isLoading: approvedLoading,
  } = useGetParentsCollectingAgentsQuery(
    { parentId, pageNumber: 1, pageSize: 50 },
    { skip: !parentId },
  );

  const {
    data: requestsData,
    isLoading: requestsLoading,
  } = useGetMyAgentRequestsQuery(
    { parentId, pageNumber: 1, pageSize: 50 },
    { skip: !parentId },
  );

  const approved = useMemo(() => approvedData?.data ?? [], [approvedData]);
  const pendingRejected = useMemo(() => requestsData?.data ?? [], [requestsData]);

  const sections = useMemo(() => {
    const res: { title: string; data: CollectingAgentParents[] }[] = [];
    const pending = pendingRejected.filter((r) => r.approvalStatus === 'Pending');
    const rejected = pendingRejected.filter((r) => r.approvalStatus === 'Rejected');
    if (pending.length > 0) {
      res.push({ title: t('parent.agents.pendingTitle', 'Pending Requests'), data: pending });
    }
    if (approved.length > 0) {
      res.push({ title: t('parent.agents.approvedTitle', 'My Agents'), data: approved });
    }
    if (rejected.length > 0) {
      res.push({ title: t('parent.agents.rejectedTitle', 'Rejected Requests'), data: rejected });
    }
    return res;
  }, [approved, pendingRejected, t]);

  const isLoading = approvedLoading || requestsLoading;
  const isEmpty = approved.length === 0 && pendingRejected.length === 0;

  const headerAnim = useAnimatedEntry({ type: 'slideUp', delay: staggerDelay(0) });

  if (isLoading) {
    return (
      <ScreenContainer scrollable={false}>
        <Animated.View style={[styles.header, headerAnim]}>
          <ThemedText variant="h1">{t('parent.agents.title', 'My Agents')}</ThemedText>
        </Animated.View>
        <View style={styles.list}>
          <ScreenSkeleton count={3} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scrollable={false}>
      <Animated.View style={[styles.header, headerAnim]}>
        <ThemedText variant="h1">{t('parent.agents.title', 'My Agents')}</ThemedText>
        <Pressable
          onPress={() => router.push('/(app)/request-agent')}
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
          icon="person-add-outline"
          title={t('parent.agents.emptyTitle', 'No Agents Yet')}
          description={t(
            'parent.agents.emptyDesc',
            'Request a collecting agent to help you with payments. Your request will need director approval.',
          )}
          actionLabel={t('parent.agents.requestAgent', 'Request Agent')}
          onAction={() => router.push('/(app)/request-agent')}
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => String(item.collectingAgentParentId)}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <ThemedText variant="caption" color={theme.colors.textSecondary} style={styles.sectionTitle}>
                {section.title}
              </ThemedText>
            </View>
          )}
          renderItem={({ item, index }) => (
            <AgentRow
              row={item}
              index={index}
              onPress={() => router.push({
                pathname: '/(app)/parent-agent-detail',
                params: { collectingAgentParentId: String(item.collectingAgentParentId) },
              })}
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
  card: {
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  info: {
    flex: 1,
    marginLeft: 16,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  statusTxt: {
    fontWeight: '600',
    fontSize: 11,
  },
});

export default ParentMyAgentsScreen;
