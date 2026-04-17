import React, { useCallback, useState } from 'react';
import { View, StyleSheet, Pressable, FlatList, Alert, TextInput, RefreshControl } from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';

import {
  ScreenContainer,
  ThemedText,
  ThemedCard,
  ThemedButton,
  Avatar,
  EmptyState,
  ScreenSkeleton,
} from '../../components';
import { useTheme } from '../../theme';
import { useAnimatedEntry, staggerDelay, useAppSelector } from '../../hooks';
import {
  useGetPendingAgentRequestsQuery,
  useApproveAgentRequestMutation,
  useRejectAgentRequestMutation,
} from '../../services/api/apiSlice';
import { formatDate } from '../../utils';
import type { CollectingAgentParents } from '../../types';

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

interface RequestCardProps {
  item: CollectingAgentParents;
  index: number;
  directorId: number;
}

const RequestCard: React.FC<RequestCardProps> = ({ item, index, directorId }) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const anim = useAnimatedEntry({ type: 'slideUp', delay: staggerDelay(index + 1) });

  const [notes, setNotes] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [approveRequest, { isLoading: approving }] = useApproveAgentRequestMutation();
  const [rejectRequest, { isLoading: rejecting }] = useRejectAgentRequestMutation();

  const agent = item.collectingAgent;
  const parent = item.parent;

  const handleApprove = () => {
    Alert.alert(
      t('director.agentRequests.approveConfirmTitle', 'Approve Request'),
      t('director.agentRequests.approveConfirmMsg', 'Assign this agent to the parent?'),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('common.approve', 'Approve'),
          onPress: async () => {
            try {
              const res = await approveRequest({
                collectingAgentParentId: item.collectingAgentParentId,
                directorId,
                approvalNotes: notes.trim() || undefined,
              }).unwrap();
              if (res.status !== 'Success') {
                Alert.alert(t('common.error', 'Error'), res.error || '');
              }
            } catch (e: any) {
              Alert.alert(t('common.error', 'Error'), e?.data?.error || t('common.genericError', 'Something went wrong'));
            }
          },
        },
      ],
    );
  };

  const handleReject = () => {
    Alert.alert(
      t('director.agentRequests.rejectConfirmTitle', 'Reject Request'),
      t('director.agentRequests.rejectConfirmMsg', 'Refuse this agent assignment?'),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('director.agentRequests.reject', 'Reject'),
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await rejectRequest({
                collectingAgentParentId: item.collectingAgentParentId,
                directorId,
                approvalNotes: notes.trim() || undefined,
              }).unwrap();
              if (res.status !== 'Success') {
                Alert.alert(t('common.error', 'Error'), res.error || '');
              }
            } catch (e: any) {
              Alert.alert(t('common.error', 'Error'), e?.data?.error || t('common.genericError', 'Something went wrong'));
            }
          },
        },
      ],
    );
  };

  return (
    <Animated.View style={anim}>
      <ThemedCard variant="elevated" style={styles.card}>
        <Pressable onPress={() => setExpanded(!expanded)}>
          {/* Parent row */}
          <View style={styles.row}>
            <Avatar
              firstName={parent?.firstName || '?'}
              lastName={parent?.lastName || ''}
              size="md"
            />
            <View style={styles.info}>
              <ThemedText variant="subtitle">
                {parent?.firstName} {parent?.lastName}
              </ThemedText>
              <ThemedText variant="caption" color={theme.colors.textSecondary}>
                {t('director.agentRequests.requestsAgent', 'Requests agent')}{' '}
                <ThemedText variant="caption" style={{ fontWeight: '700' }}>
                  {agent?.firstName} {agent?.lastName}
                </ThemedText>
              </ThemedText>
              <ThemedText variant="caption" color={theme.colors.textTertiary}>
                {formatDate(item.assignedDate)}
              </ThemedText>
            </View>
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={theme.colors.textTertiary}
            />
          </View>
        </Pressable>

        {expanded && (
          <View style={styles.expandedArea}>
            {item.assignmentNotes ? (
              <View style={styles.noteBox}>
                <ThemedText variant="caption" color={theme.colors.textSecondary}>
                  {t('director.agentRequests.parentNote', 'Parent note')}
                </ThemedText>
                <ThemedText variant="body">{item.assignmentNotes}</ThemedText>
              </View>
            ) : null}

            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder={t('director.agentRequests.addNote', 'Add a note (optional)')}
              placeholderTextColor={theme.colors.textTertiary}
              style={[
                styles.noteInput,
                {
                  backgroundColor: theme.colors.surface,
                  color: theme.colors.text,
                  borderColor: theme.colors.border,
                  borderRadius: theme.borderRadius.md,
                },
              ]}
            />

            <View style={styles.actions}>
              <ThemedButton
                title={t('director.agentRequests.reject', 'Reject')}
                variant="secondary"
                onPress={handleReject}
                loading={rejecting}
                style={styles.actionBtn}
              />
              <ThemedButton
                title={t('director.agentRequests.approve', 'Approve')}
                variant="primary"
                onPress={handleApprove}
                loading={approving}
                style={styles.actionBtn}
              />
            </View>
          </View>
        )}
      </ThemedCard>
    </Animated.View>
  );
};

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

const AgentRequestsScreen: React.FC = () => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const user = useAppSelector((state) => state.auth.user);
  const schoolId = parseInt(user?.schoolId || '0');
  const directorId = parseInt(user?.entityUserId || '0');

  const { data, isLoading, refetch } = useGetPendingAgentRequestsQuery(
    { schoolId, pageNumber: 1, pageSize: 50 },
    { skip: !schoolId },
  );

  const requests = data?.data ?? [];
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);
  const headerAnim = useAnimatedEntry({ type: 'slideUp', delay: staggerDelay(0) });

  if (isLoading) {
    return (
      <ScreenContainer scrollable={false}>
        <Animated.View style={[styles.header, headerAnim]}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
          </Pressable>
          <ThemedText variant="h1">
            {t('director.agentRequests.title', 'Agent Requests')}
          </ThemedText>
        </Animated.View>
        <ScreenSkeleton count={3} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scrollable={false}>
      <Animated.View style={[styles.header, headerAnim]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </Pressable>
        <ThemedText variant="h1">
          {t('director.agentRequests.title', 'Agent Requests')}
        </ThemedText>
      </Animated.View>

      {requests.length === 0 ? (
        <EmptyState
          icon="checkmark-done-outline"
          title={t('director.agentRequests.emptyTitle', 'No Pending Requests')}
          description={t(
            'director.agentRequests.emptyDesc',
            'All agent assignment requests have been processed.',
          )}
        />
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => String(item.collectingAgentParentId)}
          renderItem={({ item, index }) => (
            <RequestCard item={item} index={index} directorId={directorId} />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 8,
    gap: 8,
    paddingHorizontal: 16,
  },
  backBtn: { padding: 4 },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  card: { marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  info: { flex: 1 },
  expandedArea: { marginTop: 12, gap: 10 },
  noteBox: { gap: 2 },
  noteInput: {
    borderWidth: 1,
    padding: 10,
    minHeight: 50,
    textAlignVertical: 'top',
  },
  actions: { flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1 },
});

export default AgentRequestsScreen;
