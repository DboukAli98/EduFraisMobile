import React, { useMemo, useState } from 'react';
import { View, StyleSheet, Pressable, ScrollView, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  ScreenContainer,
  ThemedText,
  ThemedCard,
  Avatar,
  ThemedButton,
  useAlert,
  BackButton,
} from '../../components';
import { useTheme } from '../../theme';
import { useAppSelector } from '../../hooks';
import {
  useGetParentsCollectingAgentsQuery,
  useRequestAgentActivityMutation,
} from '../../services/api/apiSlice';
import type { ParentRequestableActivityType } from '../../types';

type RequestActivitySectionKey = 'type' | 'agent' | 'details' | 'review';

// ---------------------------------------------------------------------------
// Types picker config. Mirrors the agent-side LogActivityScreen layout but
// only offers the types a parent is allowed to request. Backend enforces
// the same whitelist (see CollectingAgentActivityService.ParentRequestableTypes).
// ---------------------------------------------------------------------------

const TYPE_OPTIONS: {
  key: ParentRequestableActivityType;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
    { key: 'PhoneCall', label: 'Phone Call', icon: 'call-outline' },
    { key: 'FieldVisit', label: 'Field Visit', icon: 'navigate-outline' },
    { key: 'ParentContact', label: 'General Contact', icon: 'chatbubble-ellipses-outline' },
    { key: 'PaymentHelp', label: 'Payment Help', icon: 'cash-outline' },
    { key: 'Other', label: 'Other', icon: 'ellipse-outline' },
  ];

const AccordionSection: React.FC<{
  id: RequestActivitySectionKey;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  isOpen: boolean;
  isComplete?: boolean;
  onPress: (id: RequestActivitySectionKey) => void;
  children: React.ReactNode;
}> = ({ id, title, description, icon, isOpen, isComplete = false, onPress, children }) => {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.accordionCard,
        {
          backgroundColor: theme.colors.surface,
          borderColor: isOpen ? theme.colors.primary : theme.colors.borderLight,
          borderRadius: theme.borderRadius.xl,
        },
      ]}
    >
      <Pressable
        onPress={() => onPress(id)}
        style={styles.accordionHeader}
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
      >
        <View style={[styles.accordionIcon, { backgroundColor: theme.colors.primary + '14' }]}>
          <Ionicons name={icon} size={20} color={theme.colors.primary} />
        </View>
        <View style={styles.accordionHeaderText}>
          <View style={styles.accordionTitleRow}>
            <ThemedText variant="body" style={styles.accordionTitle} numberOfLines={1}>
              {title}
            </ThemedText>
            {isComplete ? <Ionicons name="checkmark-circle" size={18} color={theme.colors.success} /> : null}
          </View>
          <ThemedText variant="caption" color={theme.colors.textSecondary} numberOfLines={1}>
            {description}
          </ThemedText>
        </View>
        <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={20} color={theme.colors.textSecondary} />
      </Pressable>
      {isOpen ? <View style={styles.accordionBody}>{children}</View> : null}
    </View>
  );
};

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

const RequestActivityScreen: React.FC = () => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { showAlert } = useAlert();
  const params = useLocalSearchParams<{ collectingAgentId?: string }>();

  // Optional agent preselect (parent tapping from the agent detail screen).
  const preselectedAgentId = params.collectingAgentId
    ? parseInt(params.collectingAgentId)
    : null;

  const user = useAppSelector((state) => state.auth.user);
  const parentId = parseInt(user?.entityUserId || '0');

  const [selectedType, setSelectedType] = useState<ParentRequestableActivityType>('PaymentHelp');
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(preselectedAgentId);
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [activeSection, setActiveSection] = useState<RequestActivitySectionKey>('type');

  // Only approved, active assignments can file requests. Pending / Rejected
  // rows from GetMyAgentRequests are excluded — the backend would reject
  // them anyway, but hiding them here avoids a confusing 403.
  const { data: approvedAgentsData, isLoading: agentsLoading } =
    useGetParentsCollectingAgentsQuery(
      { parentId, pageNumber: 1, pageSize: 50 },
      { skip: !parentId },
    );

  const approvedAgents = useMemo(() => {
    const rows = approvedAgentsData?.data ?? [];
    return rows
      .filter(
        (r) =>
          r.isActive &&
          (!r.approvalStatus || r.approvalStatus === 'Approved'),
      )
      .map((r) => ({
        assignmentId: r.collectingAgentParentId,
        agent: r.collectingAgent,
      }))
      .filter((x) => !!x.agent);
  }, [approvedAgentsData]);

  const selectedAgent = useMemo(
    () =>
      approvedAgents.find((a) => a.agent?.collectingAgentId === selectedAgentId)?.agent ||
      null,
    [approvedAgents, selectedAgentId],
  );

  const [requestActivity, { isLoading: submitting }] = useRequestAgentActivityMutation();

  const selectedTypeMeta = useMemo(
    () => TYPE_OPTIONS.find((o) => o.key === selectedType) ?? TYPE_OPTIONS[0],
    [selectedType],
  );

  const selectedTypeLabel = t(`parent.requestActivity.types.${selectedTypeMeta.key}`, selectedTypeMeta.label);
  const detailsComplete = Boolean(description.trim());
  const requestComplete = Boolean(selectedAgentId && detailsComplete);

  const handleToggleSection = (section: RequestActivitySectionKey) => {
    setActiveSection((current) => (current === section ? current : section));
  };

  const handleSelectType = (type: ParentRequestableActivityType) => {
    setSelectedType(type);
    setActiveSection('agent');
  };

  const handleSelectAgent = (agentId: number) => {
    setSelectedAgentId(agentId);
    setActiveSection('details');
  };

  const handleSubmit = async () => {
    const trimmedDescription = description.trim();

    if (!selectedAgentId) {
      setActiveSection('agent');
      showAlert({
        type: 'warning',
        title: t('common.error', 'Error'),
        message: t(
          'parent.requestActivity.agentRequired',
          'Please pick which agent should handle this',
        ),
      });
      return;
    }

    if (!trimmedDescription) {
      setActiveSection('details');
      showAlert({
        type: 'warning',
        title: t('common.error', 'Error'),
        message: t(
          'parent.requestActivity.descriptionRequired',
          'Please describe what you need',
        ),
      });
      return;
    }

    try {
      const result = await requestActivity({
        collectingAgentId: selectedAgentId,
        activityType: selectedType,
        activityDescription: trimmedDescription,
        notes: notes.trim() || undefined,
      }).unwrap();

      if (result.status === 'Success') {
        showAlert({
          type: 'success',
          title: t('common.success', 'Success'),
          message:
            result.message ||
            t('parent.requestActivity.sent', 'Request sent to your agent'),
          buttons: [{ text: t('common.ok', 'OK'), onPress: () => router.back() }],
        });
      } else {
        showAlert({
          type: 'error',
          title: t('common.error', 'Error'),
          message: result.error || t('common.genericError', 'Something went wrong'),
        });
      }
    } catch (err: any) {
      const msg =
        err?.data?.error || err?.message || t('common.genericError', 'Something went wrong');
      showAlert({
        type: 'error',
        title: t('common.error', 'Error'),
        message: msg,
      });
    }
  };

  return (
    <ScreenContainer>
      <View style={styles.headerRow}>
        <BackButton label={t('common.back', 'Retour')} showLabel={false} style={styles.backBtn} />
        <ThemedText variant="h1" style={styles.headerTitle}>
          {t('parent.requestActivity.title', 'Request Activity')}
        </ThemedText>
      </View>

      <AccordionSection
        id="type"
        title={t('parent.requestActivity.typeSection', 'What do you need?')}
        description={selectedTypeLabel}
        icon="options-outline"
        isOpen={activeSection === 'type'}
        isComplete
        onPress={handleToggleSection}
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeRow}>
          {TYPE_OPTIONS.map((opt) => {
            const selected = selectedType === opt.key;
            return (
              <Pressable
                key={opt.key}
                onPress={() => handleSelectType(opt.key)}
                style={[
                  styles.typeChip,
                  {
                    borderRadius: theme.borderRadius.md,
                    borderColor: selected ? theme.colors.primary : theme.colors.border,
                    backgroundColor: selected ? theme.colors.primary + '15' : theme.colors.surface,
                  },
                ]}
              >
                <Ionicons name={opt.icon} size={18} color={selected ? theme.colors.primary : theme.colors.textSecondary} />
                <ThemedText
                  variant="caption"
                  color={selected ? theme.colors.primary : theme.colors.text}
                  style={styles.typeLabel}
                >
                  {t(`parent.requestActivity.types.${opt.key}`, opt.label)}
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>
      </AccordionSection>

      <AccordionSection
        id="agent"
        title={t('parent.requestActivity.agentSection', 'Agent')}
        description={selectedAgent ? `${selectedAgent.firstName} ${selectedAgent.lastName}` : t('parent.requestActivity.pickAgentStep', 'Choose the assigned agent')}
        icon="person-outline"
        isOpen={activeSection === 'agent'}
        isComplete={!!selectedAgentId}
        onPress={handleToggleSection}
      >
        {agentsLoading ? (
          <ThemedText variant="caption" color={theme.colors.textSecondary}>
            {t('common.loading', 'Loading…')}
          </ThemedText>
        ) : approvedAgents.length === 0 ? (
          <ThemedCard variant="outlined" style={styles.emptyCard}>
            <ThemedText variant="bodySmall" color={theme.colors.textSecondary}>
              {t(
                'parent.requestActivity.noAgents',
                'You have no approved agents yet. Ask your director or request one before filing activity requests.',
              )}
            </ThemedText>
          </ThemedCard>
        ) : (
          <View style={styles.agentList}>
            {approvedAgents.map(({ assignmentId, agent }) => {
              if (!agent) return null;
              const selected = selectedAgentId === agent.collectingAgentId;
              return (
                <Pressable key={assignmentId} onPress={() => handleSelectAgent(agent.collectingAgentId)}>
                  <ThemedCard
                    variant={selected ? 'elevated' : 'outlined'}
                    style={{
                      ...styles.agentCard,
                      ...(selected ? { borderColor: theme.colors.primary, borderWidth: 2 } : {}),
                    }}
                  >
                    <View style={styles.agentRow}>
                      <Avatar firstName={agent.firstName} lastName={agent.lastName} size="sm" />
                      <View style={styles.agentInfo}>
                        <ThemedText variant="bodySmall" style={{ fontWeight: '600' }}>
                          {agent.firstName} {agent.lastName}
                        </ThemedText>
                        {agent.phoneNumber ? (
                          <ThemedText variant="caption" color={theme.colors.textSecondary}>
                            {agent.countryCode} {agent.phoneNumber}
                          </ThemedText>
                        ) : null}
                      </View>
                      <Ionicons
                        name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                        size={22}
                        color={selected ? theme.colors.primary : theme.colors.textTertiary}
                      />
                    </View>
                  </ThemedCard>
                </Pressable>
              );
            })}
          </View>
        )}
      </AccordionSection>

      <AccordionSection
        id="details"
        title={t('parent.requestActivity.descriptionSection', 'Details')}
        description={detailsComplete ? description.trim() : t('parent.requestActivity.detailsStep', 'Describe what you need')}
        icon="document-text-outline"
        isOpen={activeSection === 'details'}
        isComplete={detailsComplete}
        onPress={handleToggleSection}
      >
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder={t('parent.requestActivity.descriptionPlaceholder', 'Tell the agent what you need (required)')}
          placeholderTextColor={theme.colors.textTertiary}
          multiline
          style={[
            styles.input,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              color: theme.colors.text,
              borderRadius: theme.borderRadius.md,
            },
          ]}
        />

        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder={t('parent.requestActivity.notesPlaceholder', 'Any extra context — amount, location, time window…')}
          placeholderTextColor={theme.colors.textTertiary}
          multiline
          style={[
            styles.input,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              color: theme.colors.text,
              borderRadius: theme.borderRadius.md,
            },
          ]}
        />

        <ThemedButton
          title={t('parent.requestActivity.reviewRequest', 'Review Request')}
          variant="secondary"
          onPress={() => setActiveSection('review')}
          disabled={!detailsComplete}
        />
      </AccordionSection>

      <AccordionSection
        id="review"
        title={t('parent.requestActivity.reviewRequest', 'Review Request')}
        description={requestComplete ? t('parent.requestActivity.readyToSend', 'Ready to send') : t('parent.requestActivity.reviewStep', 'Check required fields')}
        icon="checkmark-done-outline"
        isOpen={activeSection === 'review'}
        isComplete={requestComplete}
        onPress={handleToggleSection}
      >
        <View style={[styles.reviewBox, { backgroundColor: theme.colors.inputBackground, borderRadius: theme.borderRadius.lg }]}>
          <ThemedText variant="caption" color={theme.colors.textSecondary}>{t('parent.requestActivity.typeSection', 'What do you need?')}</ThemedText>
          <ThemedText variant="bodySmall" style={styles.reviewValue}>{selectedTypeLabel}</ThemedText>
          <ThemedText variant="caption" color={theme.colors.textSecondary} style={styles.reviewLabel}>{t('parent.requestActivity.agentSection', 'Agent')}</ThemedText>
          <ThemedText variant="bodySmall" style={styles.reviewValue}>{selectedAgent ? `${selectedAgent.firstName} ${selectedAgent.lastName}` : '-'}</ThemedText>
          <ThemedText variant="caption" color={theme.colors.textSecondary} style={styles.reviewLabel}>{t('parent.requestActivity.descriptionSection', 'Details')}</ThemedText>
          <ThemedText variant="bodySmall" style={styles.reviewValue}>{description.trim() || '-'}</ThemedText>
        </View>
        <ThemedButton
          title={t('parent.requestActivity.submit', 'Send Request')}
          variant="primary"
          onPress={handleSubmit}
          loading={submitting}
          disabled={approvedAgents.length === 0}
          style={styles.submitBtn}
        />
      </AccordionSection>

      {selectedAgent ? (
        <ThemedText
          variant="caption"
          color={theme.colors.textTertiary}
          style={styles.footerHint}
        >
          {t('parent.requestActivity.sendingTo', 'Sending to')} {selectedAgent.firstName}{' '}
          {selectedAgent.lastName}
        </ThemedText>
      ) : null}
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
    gap: 8,
  },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1 },
  accordionCard: {
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  accordionIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  accordionHeaderText: {
    flex: 1,
    marginRight: 8,
  },
  accordionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  accordionTitle: {
    flex: 1,
    fontWeight: '700',
  },
  accordionBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    minHeight: 38,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    gap: 6,
  },
  typeLabel: {
    fontWeight: '600',
    includeFontPadding: false,
  },
  agentList: { gap: 8 },
  agentCard: { marginBottom: 0 },
  agentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  agentInfo: { flex: 1 },
  emptyCard: { paddingVertical: 16 },
  input: {
    minHeight: 70,
    borderWidth: 1,
    padding: 10,
    textAlignVertical: 'top',
    marginTop: 8,
  },
  submitBtn: { marginTop: 20 },
  reviewBox: {
    padding: 12,
    marginBottom: 14,
  },
  reviewLabel: {
    marginTop: 10,
  },
  reviewValue: {
    marginTop: 2,
    fontWeight: '700',
  },
  footerHint: { marginTop: 8, textAlign: 'center' },
});

export default RequestActivityScreen;
