import React, { useMemo, useState } from 'react';
import {
  View, StyleSheet, Pressable, FlatList, TextInput } from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';

import {
  Alert,
  ScreenContainer,
  ThemedText,
  ThemedCard,
  Avatar,
  EmptyState,
  ScreenSkeleton,
  ThemedButton,
  SectionHeader,
} from '../../components';
import { useTheme } from '../../theme';
import { useAnimatedEntry, staggerDelay, useAppSelector } from '../../hooks';
import {
  useGetAllAgentsQuery,
  useGetParentsCollectingAgentsQuery,
  useGetMyAgentRequestsQuery,
  useRequestAgentAssignmentMutation,
} from '../../services/api/apiSlice';
import type { CollectingAgent } from '../../types';

// ---------------------------------------------------------------------------
// AgentCard (extracted so hooks are valid)
// ---------------------------------------------------------------------------

interface AgentCardProps {
  agent: CollectingAgent;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
}

const AgentCard: React.FC<AgentCardProps> = ({ agent, index, isSelected, onSelect }) => {
  const { theme } = useTheme();
  const anim = useAnimatedEntry({ type: 'slideUp', delay: staggerDelay(index + 1) });

  return (
    <Animated.View style={anim}>
      <Pressable onPress={onSelect}>
        <ThemedCard
          variant={isSelected ? 'elevated' : 'outlined'}
          style={{
            ...styles.card,
            ...(isSelected ? { borderColor: theme.colors.primary, borderWidth: 2 } : {}),
          }}
        >
          <View style={styles.row}>
            <Avatar firstName={agent.firstName} lastName={agent.lastName} size="md" />
            <View style={styles.info}>
              <ThemedText variant="body" style={{ fontWeight: '600' }}>
                {agent.firstName} {agent.lastName}
              </ThemedText>
              {agent.assignedArea ? (
                <ThemedText variant="caption" color={theme.colors.textSecondary}>
                  {agent.assignedArea}
                </ThemedText>
              ) : null}
            </View>
            {isSelected ? (
              <Ionicons name="checkmark-circle" size={24} color={theme.colors.primary} />
            ) : (
              <Ionicons name="ellipse-outline" size={24} color={theme.colors.textTertiary} />
            )}
          </View>
        </ThemedCard>
      </Pressable>
    </Animated.View>
  );
};

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

const RequestAgentScreen: React.FC = () => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const user = useAppSelector((state) => state.auth.user);
  const parentId = parseInt(user?.entityUserId || '0');
  const schoolId = parseInt(user?.schoolId || '0');

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [notes, setNotes] = useState('');

  const { data: agentsData, isLoading: agentsLoading } = useGetAllAgentsQuery(
    { schoolId, pageNumber: 1, pageSize: 100 },
    { skip: !schoolId },
  );
  const { data: approvedData } = useGetParentsCollectingAgentsQuery(
    { parentId, pageNumber: 1, pageSize: 100 },
    { skip: !parentId },
  );
  const { data: requestsData } = useGetMyAgentRequestsQuery(
    { parentId, pageNumber: 1, pageSize: 100 },
    { skip: !parentId },
  );

  const [requestAgentAssignment, { isLoading: submitting }] =
    useRequestAgentAssignmentMutation();

  // Exclude agents the parent is already linked to (approved or pending)
  const excludedAgentIds = useMemo(() => {
    const approvedIds = (approvedData?.data ?? []).map((r) => r.fK_CollectingAgentId);
    const pendingIds = (requestsData?.data ?? [])
      .filter((r) => r.approvalStatus === 'Pending')
      .map((r) => r.fK_CollectingAgentId);
    return new Set<number>([...approvedIds, ...pendingIds]);
  }, [approvedData, requestsData]);

  const availableAgents = useMemo(() => {
    const all = agentsData?.data ?? [];
    return all.filter((a) => !excludedAgentIds.has(a.collectingAgentId));
  }, [agentsData, excludedAgentIds]);

  const selectedAgent = useMemo(
    () => availableAgents.find((a) => a.collectingAgentId === selectedId) || null,
    [availableAgents, selectedId],
  );

  const headerAnim = useAnimatedEntry({ type: 'slideUp', delay: staggerDelay(0) });

  const handleSubmit = async () => {
    if (!selectedId) {
      Alert.alert(
        t('common.error', 'Error'),
        t('parent.agents.selectAgentFirst', 'Please select an agent first'),
      );
      return;
    }
    try {
      const result = await requestAgentAssignment({
        collectingAgentId: selectedId,
        parentId,
        assignmentNotes: notes.trim() || undefined,
      }).unwrap();

      if (result.status === 'Success') {
        Alert.alert(
          t('common.success', 'Success'),
          result.message ||
          t(
            'parent.agents.requestSentMessage',
            'Your request has been sent to the director for approval.',
          ),
          [
            {
              text: t('common.ok', 'OK'),
              onPress: () => router.back(),
            },
          ],
        );
      } else {
        Alert.alert(t('common.error', 'Error'), result.error || t('common.genericError', 'Something went wrong'));
      }
    } catch (err: any) {
      const msg = err?.data?.error || err?.message || t('common.genericError', 'Something went wrong');
      Alert.alert(t('common.error', 'Error'), msg);
    }
  };

  if (agentsLoading) {
    return (
      <ScreenContainer>
        <ScreenSkeleton count={4} />
      </ScreenContainer>
    );
  }

  const renderAgent = ({ item, index }: { item: CollectingAgent; index: number }) => (
    <AgentCard
      agent={item}
      index={index}
      isSelected={item.collectingAgentId === selectedId}
      onSelect={() => setSelectedId(item.collectingAgentId)}
    />
  );

  return (
    <ScreenContainer scrollable={false}>
      <Animated.View style={[styles.headerRow, headerAnim]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </Pressable>
        <ThemedText variant="h1">{t('parent.agents.requestTitle', 'Request Agent')}</ThemedText>
      </Animated.View>

      <ThemedText variant="body" color={theme.colors.textSecondary} style={styles.intro}>
        {t(
          'parent.agents.requestIntro',
          'Pick a collecting agent to request. The director must approve your request before the agent is assigned to you.',
        )}
      </ThemedText>

      <SectionHeader title={t('parent.agents.availableAgents', 'Available Agents')} />
      {availableAgents.length === 0 ? (
        <EmptyState
          icon="person-remove-outline"
          title={t('parent.agents.noneAvailableTitle', 'No Agents Available')}
          description={t(
            'parent.agents.noneAvailableDesc',
            'All available agents are already linked to you or pending approval.',
          )}
        />
      ) : (
        <FlatList
          data={availableAgents}
          keyExtractor={(item) => String(item.collectingAgentId)}
          renderItem={renderAgent}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      {selectedAgent ? (
        <View style={styles.footer}>
          <ThemedText variant="caption" color={theme.colors.textSecondary} style={styles.notesLabel}>
            {t('parent.agents.notesLabel', 'Notes (optional)')}
          </ThemedText>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder={t('parent.agents.notesPlaceholder', 'Tell the director why you need this agent')}
            placeholderTextColor={theme.colors.textTertiary}
            multiline
            style={[
              styles.notesInput,
              {
                backgroundColor: theme.colors.surface,
                color: theme.colors.text,
                borderColor: theme.colors.border,
                borderRadius: theme.borderRadius.md,
              },
            ]}
          />
          <ThemedButton
            title={t('parent.agents.sendRequest', 'Send Request')}
            variant="primary"
            onPress={handleSubmit}
            loading={submitting}
            style={styles.submitBtn}
          />
        </View>
      ) : null}
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 8,
    gap: 8,
  },
  backBtn: {
    padding: 4,
  },
  intro: {
    marginBottom: 16,
  },
  list: {
    paddingBottom: 24,
  },
  card: {
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  info: {
    flex: 1,
  },
  footer: {
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.08)',
  },
  notesLabel: {
    marginBottom: 6,
  },
  notesInput: {
    minHeight: 70,
    borderWidth: 1,
    padding: 10,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  submitBtn: {
    marginBottom: 12,
  },
});

export default RequestAgentScreen;
