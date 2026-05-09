import React, { useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';

import {
  Alert,
  ScreenContainer,
  ThemedText,
  ThemedCard,
  ThemedButton,
  ThemedInput,
  Avatar,
  ScreenSkeleton,
  EmptyState,
} from '../../components';
import { useTheme } from '../../theme';
import { useAnimatedEntry, staggerDelay, useAppSelector } from '../../hooks';
import {
  useAddAgentMutation,
  useAssignAgentToParentMutation,
  useGetAllAgentsQuery,
  useGetParentsQuery,
  useGetSchoolDirectorQuery,
} from '../../services/api/apiSlice';
import { COUNTRY_CODE } from '../../constants';
import type { CollectingAgent, Parent } from '../../types';
import AgentAreaPicker from './AgentAreaPicker';

interface SummaryItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  color: string;
  index: number;
}

interface AgentFormState {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  email: string;
  assignedArea: string;
  commissionPercentage: string;
}

const INITIAL_AGENT_FORM: AgentFormState = {
  firstName: '',
  lastName: '',
  phoneNumber: '',
  email: '',
  assignedArea: '',
  commissionPercentage: '',
};

/**
 * Renders an agent phone number consistently, regardless of whether the
 * backend row stores it as a full international number ("24270156590")
 * or as a local-only number paired with a separate countryCode column
 * ("70156590" + "242"). Prevents duplicated country codes in the UI.
 */
const formatAgentPhone = (countryCode?: string, phoneNumber?: string): string => {
  const cc = (countryCode || '').replace(/\D/g, '');
  const num = (phoneNumber || '').replace(/\s/g, '');
  if (!num) return cc ? `+${cc}` : '';
  if (cc && num.startsWith(cc)) {
    return `+${num}`;
  }
  return cc ? `+${cc} ${num}` : num;
};

const SummaryItem: React.FC<SummaryItemProps> = ({ icon, label, value, color, index }) => {
  const { theme } = useTheme();
  const anim = useAnimatedEntry({ type: 'scaleIn', delay: staggerDelay(index) });

  return (
    <Animated.View style={[styles.summaryItem, anim]}>
      <ThemedCard variant="elevated" style={styles.summaryCard}>
        <View
          style={[
            styles.summaryIcon,
            { backgroundColor: color + '15', borderRadius: theme.borderRadius.md },
          ]}
        >
          <Ionicons name={icon} size={20} color={color} />
        </View>
        <ThemedText variant="numeric" style={styles.summaryValue}>
          {value}
        </ThemedText>
        <ThemedText variant="caption" color={theme.colors.textSecondary}>
          {label}
        </ThemedText>
      </ThemedCard>
    </Animated.View>
  );
};

const AgentsScreen: React.FC = () => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const user = useAppSelector((state) => state.auth.user);
  const role = user?.role;
  const schoolId = parseInt((user?.schoolId ?? '0').split(',')[0], 10);
  const directorEntityId = parseInt(user?.entityUserId ?? '0', 10);

  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [isAssignModalVisible, setIsAssignModalVisible] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<CollectingAgent | null>(null);
  const [selectedParentId, setSelectedParentId] = useState<number | null>(null);
  const [assignmentNotes, setAssignmentNotes] = useState('');
  const [parentSearch, setParentSearch] = useState('');
  const [agentForm, setAgentForm] = useState<AgentFormState>(INITIAL_AGENT_FORM);

  const { data: agentsRes, isLoading } = useGetAllAgentsQuery(
    { schoolId, pageNumber: 1, pageSize: 100 },
    { skip: !schoolId },
  );
  const { data: parentsRes, isLoading: parentsLoading } = useGetParentsQuery(
    {
      schoolId,
      pageNumber: 1,
      pageSize: 50,
      search: parentSearch.trim() || undefined,
    },
    { skip: !isAssignModalVisible || !schoolId },
  );
  const { data: schoolDirectorRes } = useGetSchoolDirectorQuery(
    { schoolId },
    { skip: !schoolId || (role === 'director' && directorEntityId > 0) },
  );

  const [addAgent, { isLoading: isAddingAgent }] = useAddAgentMutation();
  const [assignAgentToParent, { isLoading: isAssigningParent }] = useAssignAgentToParentMutation();

  const agents = agentsRes?.data || [];
  const parents = parentsRes?.data || [];
  const schoolDirector =
    (schoolDirectorRes as any)?.director ?? (schoolDirectorRes as any)?.data ?? null;

  const summary = useMemo(() => {
    const totalAgents = agents.length;
    const avgCommission = totalAgents > 0
      ? (
        agents.reduce((sum, agent) => sum + (agent.commissionPercentage || 0), 0) /
        totalAgents
      ).toFixed(1)
      : '0';

    return {
      totalAgents,
      avgCommission: `${avgCommission}%`,
    };
  }, [agents]);
  const areaSuggestions = useMemo(
    () =>
      Array.from(
        new Set(
          agents
            .map((agent) => agent.assignedArea?.trim())
            .filter((value): value is string => Boolean(value)),
        ),
      ),
    [agents],
  );

  const resolvedDirectorId =
    role === 'director' && directorEntityId > 0
      ? directorEntityId
      : (schoolDirector?.directorId ?? 0);

  const headerAnim = useAnimatedEntry({ type: 'slideUp', delay: staggerDelay(0) });
  const listAnim = useAnimatedEntry({ type: 'slideUp', delay: staggerDelay(4) });

  const updateAgentForm = (field: keyof AgentFormState, value: string) => {
    setAgentForm((current) => ({ ...current, [field]: value }));
  };

  const closeAddModal = () => {
    setIsAddModalVisible(false);
    setAgentForm(INITIAL_AGENT_FORM);
  };

  const openAssignModal = (agent: CollectingAgent) => {
    setSelectedAgent(agent);
    setSelectedParentId(null);
    setAssignmentNotes('');
    setParentSearch('');
    setIsAssignModalVisible(true);
  };

  const openDetails = (agent: CollectingAgent) => {
    router.push({
      pathname: '/(app)/agent-detail',
      params: { agentId: String(agent.collectingAgentId) },
    });
  };

  const closeAssignModal = () => {
    setIsAssignModalVisible(false);
    setSelectedAgent(null);
    setSelectedParentId(null);
    setAssignmentNotes('');
    setParentSearch('');
  };

  const handleAddAgent = async () => {
    if (!schoolId) {
      Alert.alert(
        t('common.error', 'Error'),
        t('director.agents.noSchool', 'This account is not linked to a school.'),
      );
      return;
    }

    if (
      !agentForm.firstName.trim() ||
      !agentForm.lastName.trim() ||
      !agentForm.phoneNumber.trim()
    ) {
      Alert.alert(
        t('common.error', 'Error'),
        t(
          'director.agents.requiredFields',
          'First name, last name, and phone number are required.',
        ),
      );
      return;
    }

    try {
      // Send local digits — including the leading 0 as the user typed.
      // The backend stores phones as `CountryCode + phoneNumber` and
      // doesn't strip the trunk prefix.
      const localPhone = agentForm.phoneNumber.replace(/\D/g, '');

      await addAgent({
        schoolId,
        firstName: agentForm.firstName.trim(),
        lastName: agentForm.lastName.trim(),
        email: agentForm.email.trim() || undefined,
        countryCode: COUNTRY_CODE,
        phoneNumber: localPhone,
        assignedArea: agentForm.assignedArea.trim() || undefined,
        commissionPercentage: agentForm.commissionPercentage.trim()
          ? Number(agentForm.commissionPercentage)
          : undefined,
      }).unwrap();

      closeAddModal();

      Alert.alert(
        t('common.success', 'Success'),
        t('director.agents.addSuccess', 'Agent created successfully.'),
      );
    } catch (error: any) {
      Alert.alert(
        t('common.error', 'Error'),
        error?.data?.message ||
        error?.data?.error ||
        t('director.agents.addError', 'Failed to create the agent.'),
      );
    }
  };

  const handleAssignParent = async () => {
    if (!selectedAgent || !selectedParentId) {
      Alert.alert(
        t('common.error', 'Error'),
        t('director.agents.selectParentFirst', 'Please select a parent first.'),
      );
      return;
    }

    if (!resolvedDirectorId) {
      Alert.alert(
        t('common.error', 'Error'),
        t('director.agents.noDirectorContext', 'The current account cannot assign parents yet.'),
      );
      return;
    }

    try {
      await assignAgentToParent({
        collectingAgentId: selectedAgent.collectingAgentId,
        parentId: selectedParentId,
        assignmentNotes: assignmentNotes.trim() || undefined,
        directorId: resolvedDirectorId,
      }).unwrap();

      closeAssignModal();

      Alert.alert(
        t('common.success', 'Success'),
        t('director.agents.assignSuccess', 'Parent assigned to the agent successfully.'),
      );
    } catch (error: any) {
      Alert.alert(
        t('common.error', 'Error'),
        error?.data?.message ||
        error?.data?.error ||
        t('director.agents.assignError', 'Failed to assign the parent to this agent.'),
      );
    }
  };

  const renderAgent = ({ item }: { item: CollectingAgent }) => (
    <ThemedCard variant="elevated" style={styles.agentCard}>
      <View style={styles.agentRow}>
        <Avatar firstName={item.firstName} lastName={item.lastName} size="lg" />
        <View style={styles.agentInfo}>
          <ThemedText variant="subtitle">
            {item.firstName} {item.lastName}
          </ThemedText>
          <ThemedText variant="caption" color={theme.colors.textSecondary}>
            {formatAgentPhone(item.countryCode, item.phoneNumber)}
          </ThemedText>
          {!!item.email && (
            <ThemedText variant="caption" color={theme.colors.textTertiary}>
              {item.email}
            </ThemedText>
          )}
          <View style={styles.agentMeta}>
            <View
              style={[
                styles.commBadge,
                {
                  backgroundColor: theme.colors.secondary,
                  borderRadius: theme.borderRadius.full,
                },
              ]}
            >
              <ThemedText variant="caption" color="#FFFFFF" style={styles.commTxt}>
                {item.commissionPercentage ?? 0}%
              </ThemedText>
            </View>

            {!!item.assignedArea && (
              <ThemedText variant="caption" color={theme.colors.textSecondary}>
                {item.assignedArea}
              </ThemedText>
            )}
          </View>
        </View>
      </View>

      <View style={styles.cardActions}>
        <ThemedButton
          title={t('director.agents.viewDetails', 'View Details')}
          onPress={() => openDetails(item)}
          variant="ghost"
          size="sm"
          style={styles.cardActionButton}
          icon={<Ionicons name="eye-outline" size={16} color={theme.colors.primary} />}
        />
        <ThemedButton
          title={t('director.agents.assignParent', 'Assign Parent')}
          onPress={() => openAssignModal(item)}
          variant="secondary"
          size="sm"
          style={styles.cardActionButton}
          icon={<Ionicons name="link-outline" size={16} color={theme.colors.primary} />}
        />
      </View>
    </ThemedCard>
  );

  if (!schoolId) {
    return (
      <ScreenContainer>
        <EmptyState
          icon="people-outline"
          title={t('director.agents.noSchool', 'No school linked')}
          description={t(
            'director.agents.noSchoolDescription',
            'Agent management requires a school-linked director account.',
          )}
        />
      </ScreenContainer>
    );
  }

  if (isLoading) {
    return (
      <ScreenContainer scrollable={false}>
        <ScreenSkeleton />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scrollable={false}>
      <Animated.View style={[styles.headerRow, headerAnim]}>
        <ThemedText variant="h1">{t('director.agents.title', 'Agents')}</ThemedText>
      </Animated.View>

      <View style={styles.summaryRow}>
        <SummaryItem
          icon="people"
          label={t('director.agents.totalAgents', 'Total Agents')}
          value={String(summary.totalAgents)}
          color={theme.colors.primary}
          index={0}
        />
        <SummaryItem
          icon="stats-chart"
          label={t('director.agents.avgCommission', 'Avg Commission')}
          value={summary.avgCommission}
          color={theme.colors.success}
          index={1}
        />
      </View>

      <Animated.View style={[styles.listWrap, listAnim]}>
        {agents.length === 0 ? (
          <EmptyState
            icon="person-add-outline"
            title={t('director.agents.emptyTitle', 'No agents yet')}
            description={t(
              'director.agents.emptyDescription',
              'Create your first collecting agent to start assigning parents.',
            )}
            actionLabel={t('director.agents.add', 'Add')}
            onAction={() => setIsAddModalVisible(true)}
          />
        ) : (
          <FlatList
            data={agents}
            keyExtractor={(item) => String(item.collectingAgentId)}
            renderItem={renderAgent}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          />
        )}
      </Animated.View>

      {agents.length > 0 && (
        <View style={styles.fabContainer}>
          <ThemedButton
            title={t('director.agents.add', 'Add')}
            onPress={() => setIsAddModalVisible(true)}
            variant="primary"
            size="lg"
            fullWidth
            icon={<Ionicons name="person-add-outline" size={20} color="#FFFFFF" />}
          />
        </View>
      )}

      <Modal
        visible={isAddModalVisible}
        animationType="fade"
        transparent
        onRequestClose={closeAddModal}
      >
        <Pressable style={styles.modalOverlay} onPress={closeAddModal}>
          <Pressable
            style={[
              styles.modalContent,
              { backgroundColor: theme.colors.card, borderRadius: theme.borderRadius.lg },
            ]}
            onPress={(event) => event.stopPropagation()}
          >
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <ThemedText variant="subtitle" style={styles.modalTitle}>
                {t('director.agents.addAgent', 'Add Agent')}
              </ThemedText>
              <ThemedText
                variant="caption"
                color={theme.colors.textSecondary}
                style={styles.modalDescription}
              >
                {t(
                  'director.agents.addAgentDescription',
                  'Create a collecting agent account for this school.',
                )}
              </ThemedText>

              <ThemedInput
                label={t('auth.firstName', 'First Name')}
                value={agentForm.firstName}
                onChangeText={(value) => updateAgentForm('firstName', value)}
                placeholder={t('auth.firstName', 'First Name')}
              />
              <ThemedInput
                label={t('auth.lastName', 'Last Name')}
                value={agentForm.lastName}
                onChangeText={(value) => updateAgentForm('lastName', value)}
                placeholder={t('auth.lastName', 'Last Name')}
              />
              <ThemedInput
                label={t('auth.phone', 'Phone Number')}
                value={agentForm.phoneNumber}
                onChangeText={(value) =>
                  updateAgentForm('phoneNumber', value.replace(/[^\d]/g, ''))
                }
                placeholder="812345678"
                keyboardType="phone-pad"
                leftIcon={
                  <ThemedText variant="bodySmall" color={theme.colors.textSecondary}>
                    {COUNTRY_CODE}
                  </ThemedText>
                }
              />
              <ThemedInput
                label={t('auth.email', 'Email')}
                value={agentForm.email}
                onChangeText={(value) => updateAgentForm('email', value)}
                placeholder="email@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <ThemedInput
                label={t('director.agents.area', 'Assigned Area')}
                value={agentForm.assignedArea}
                onChangeText={(value) => updateAgentForm('assignedArea', value)}
                placeholder={t(
                  'director.agents.areaPlaceholder',
                  'Neighborhood, district, or route',
                )}
              />
              <AgentAreaPicker
                selectedArea={agentForm.assignedArea}
                suggestions={areaSuggestions}
                onSelectArea={(value) => updateAgentForm('assignedArea', value)}
              />
              <ThemedInput
                label={t('director.agents.commission', 'Commission Percentage')}
                value={agentForm.commissionPercentage}
                onChangeText={(value) =>
                  updateAgentForm('commissionPercentage', value.replace(/[^\d.]/g, ''))
                }
                placeholder="10"
                keyboardType="decimal-pad"
              />

              <View style={styles.modalActions}>
                <ThemedButton
                  title={t('common.cancel', 'Cancel')}
                  onPress={closeAddModal}
                  variant="ghost"
                  size="md"
                  style={styles.modalButton}
                />
                <ThemedButton
                  title={t('director.agents.addAgent', 'Add Agent')}
                  onPress={handleAddAgent}
                  variant="primary"
                  size="md"
                  style={styles.modalButton}
                  loading={isAddingAgent}
                />
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={isAssignModalVisible}
        animationType="fade"
        transparent
        onRequestClose={closeAssignModal}
      >
        <Pressable style={styles.modalOverlay} onPress={closeAssignModal}>
          <Pressable
            style={[
              styles.modalContent,
              { backgroundColor: theme.colors.card, borderRadius: theme.borderRadius.lg },
            ]}
            onPress={(event) => event.stopPropagation()}
          >
            <ThemedText variant="subtitle" style={styles.modalTitle}>
              {t('director.agents.assignParent', 'Assign Parent')}
            </ThemedText>
            <ThemedText
              variant="caption"
              color={theme.colors.textSecondary}
              style={styles.modalDescription}
            >
              {selectedAgent
                ? `${selectedAgent.firstName} ${selectedAgent.lastName}`
                : t(
                  'director.agents.assignParentDescription',
                  'Choose a parent to assign to this collecting agent.',
                )}
            </ThemedText>

            <ThemedInput
              label={t('common.search', 'Search')}
              value={parentSearch}
              onChangeText={setParentSearch}
              placeholder={t('common.searchParents', 'Search parents...')}
              leftIcon={<Ionicons name="search" size={18} color={theme.colors.textTertiary} />}
            />

            <ScrollView style={styles.parentList} nestedScrollEnabled showsVerticalScrollIndicator>
              {parentsLoading ? (
                <ScreenSkeleton count={2} />
              ) : parents.length === 0 ? (
                <EmptyState
                  icon="people-outline"
                  title={t('director.agents.noParents', 'No parents found')}
                  description={t(
                    'director.agents.noParentsDescription',
                    'Add or enable parents before assigning them to an agent.',
                  )}
                />
              ) : (
                parents.map((parent: Parent) => {
                  const isSelected = selectedParentId === parent.parentId;

                  return (
                    <Pressable
                      key={parent.parentId}
                      onPress={() => setSelectedParentId(parent.parentId)}
                      style={[
                        styles.parentOption,
                        {
                          borderColor: isSelected
                            ? theme.colors.primary
                            : theme.colors.borderLight,
                          backgroundColor: isSelected
                            ? theme.colors.primary + '10'
                            : theme.colors.surface,
                          borderRadius: theme.borderRadius.lg,
                        },
                      ]}
                    >
                      <Avatar firstName={parent.firstName} lastName={parent.lastName} size="md" />
                      <View style={styles.parentOptionInfo}>
                        <ThemedText variant="bodySmall" style={{ fontWeight: '600' }}>
                          {parent.firstName} {parent.lastName}
                        </ThemedText>
                        <ThemedText variant="caption" color={theme.colors.textSecondary}>
                          +{parent.countryCode} {parent.phoneNumber}
                        </ThemedText>
                      </View>
                      {isSelected && (
                        <Ionicons
                          name="checkmark-circle"
                          size={22}
                          color={theme.colors.primary}
                        />
                      )}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>

            <ThemedInput
              label={t('director.agents.assignmentNotes', 'Assignment Notes')}
              value={assignmentNotes}
              onChangeText={setAssignmentNotes}
              placeholder={t(
                'director.agents.assignmentNotesPlaceholder',
                'Optional notes for this assignment',
              )}
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalActions}>
              <ThemedButton
                title={t('common.cancel', 'Cancel')}
                onPress={closeAssignModal}
                variant="ghost"
                size="md"
                style={styles.modalButton}
              />
              <ThemedButton
                title={t('director.agents.assignParent', 'Assign Parent')}
                onPress={handleAssignParent}
                variant="primary"
                size="md"
                style={styles.modalButton}
                loading={isAssigningParent}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  headerRow: {
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  summaryItem: {
    flex: 1,
    paddingHorizontal: 4,
  },
  summaryCard: {
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  summaryIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  summaryValue: {
    marginBottom: 2,
  },
  listWrap: {
    flex: 1,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  agentCard: {
    marginBottom: 10,
  },
  agentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  agentInfo: {
    flex: 1,
    marginLeft: 14,
  },
  agentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 12,
    flexWrap: 'wrap',
  },
  commBadge: {
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  commTxt: {
    fontWeight: '700',
  },
  cardActions: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  cardActionButton: {
    alignSelf: 'flex-start',
  },
  fabContainer: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalContent: {
    width: '100%',
    maxHeight: '88%',
    padding: 24,
  },
  modalTitle: {
    marginBottom: 8,
  },
  modalDescription: {
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
  },
  parentList: {
    maxHeight: 240,
    marginBottom: 12,
  },
  parentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
  },
  parentOptionInfo: {
    flex: 1,
    marginLeft: 12,
  },
});

export default AgentsScreen;
