import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import {
  Avatar,
  EmptyState,
  ScreenContainer,
  ScreenSkeleton,
  SectionHeader,
  ThemedButton,
  ThemedCard,
  ThemedInput,
  ThemedText,
} from '../../components';
import { useTheme } from '../../theme';
import { useAppSelector } from '../../hooks';
import {
  useEditAgentMutation,
  useGetAgentActivitiesQuery,
  useGetAgentCommissionsQuery,
  useGetAgentDetailsQuery,
  useGetAgentParentsQuery,
  useGetAllAgentsQuery,
} from '../../services/api/apiSlice';
import { formatCurrency, formatDate, formatPhone } from '../../utils';
import AgentAreaPicker from './AgentAreaPicker';

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

interface DetailRowProps {
  label: string;
  value: string;
  valueColor?: string;
}

const DetailRow: React.FC<DetailRowProps> = ({ label, value, valueColor }) => {
  const { theme } = useTheme();

  return (
    <View style={styles.detailRow}>
      <ThemedText variant="bodySmall" color={theme.colors.textSecondary}>
        {label}
      </ThemedText>
      <ThemedText variant="body" color={valueColor} style={styles.detailValue}>
        {value}
      </ThemedText>
    </View>
  );
};

const AgentDetailScreen: React.FC = () => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { agentId } = useLocalSearchParams<{ agentId: string }>();

  const user = useAppSelector((state) => state.auth.user);
  const schoolId = parseInt((user?.schoolId ?? '0').split(',')[0], 10);
  const numericAgentId = parseInt(agentId ?? '0', 10);

  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [agentForm, setAgentForm] = useState<AgentFormState>(INITIAL_AGENT_FORM);

  const { data: agentRes, isLoading: loadingAgent } = useGetAgentDetailsQuery(
    { agentId: numericAgentId },
    { skip: !numericAgentId },
  );
  const { data: parentsRes, isLoading: loadingParents } = useGetAgentParentsQuery(
    { collectingAgentId: numericAgentId, pageNumber: 1, pageSize: 20 },
    { skip: !numericAgentId },
  );
  const { data: activitiesRes, isLoading: loadingActivities } = useGetAgentActivitiesQuery(
    { collectingAgentId: numericAgentId, pageNumber: 1, pageSize: 5 },
    { skip: !numericAgentId },
  );
  const { data: commissionsRes, isLoading: loadingCommissions } = useGetAgentCommissionsQuery(
    { collectingAgentId: numericAgentId, pageNumber: 1, pageSize: 50 },
    { skip: !numericAgentId },
  );
  const { data: agentsRes } = useGetAllAgentsQuery(
    { schoolId, pageNumber: 1, pageSize: 100 },
    { skip: !schoolId },
  );

  const [editAgent, { isLoading: isSavingAgent }] = useEditAgentMutation();

  const agent = agentRes?.data;
  const parents = parentsRes?.data ?? [];
  const activities = activitiesRes?.data ?? [];

  const areaSuggestions = useMemo(() => {
    const values = (agentsRes?.data ?? [])
      .map((item) => item.assignedArea?.trim())
      .filter((value): value is string => Boolean(value));

    if (agent?.assignedArea?.trim()) {
      values.unshift(agent.assignedArea.trim());
    }

    return Array.from(new Set(values));
  }, [agent?.assignedArea, agentsRes?.data]);

  useEffect(() => {
    if (!agent) {
      return;
    }

    setAgentForm({
      firstName: agent.firstName ?? '',
      lastName: agent.lastName ?? '',
      phoneNumber: agent.phoneNumber ?? '',
      email: agent.email ?? '',
      assignedArea: agent.assignedArea ?? '',
      commissionPercentage:
        agent.commissionPercentage === null || agent.commissionPercentage === undefined
          ? ''
          : String(agent.commissionPercentage),
    });
  }, [agent]);

  const updateAgentForm = (field: keyof AgentFormState, value: string) => {
    setAgentForm((current) => ({ ...current, [field]: value }));
  };

  const handleSaveAgent = async () => {
    if (!agent) {
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
      await editAgent({
        collectingAgentId: agent.collectingAgentId,
        schoolId: agent.fK_SchoolId,
        firstName: agentForm.firstName.trim(),
        lastName: agentForm.lastName.trim(),
        email: agentForm.email.trim(),
        countryCode: agent.countryCode,
        phoneNumber: agentForm.phoneNumber.trim(),
        assignedArea: agentForm.assignedArea.trim() || undefined,
        commissionPercentage: agentForm.commissionPercentage.trim()
          ? Number(agentForm.commissionPercentage)
          : undefined,
        statusId: agent.fK_StatusId,
      }).unwrap();

      setIsEditModalVisible(false);

      Alert.alert(
        t('common.success', 'Success'),
        t('director.agents.updateSuccess', 'Agent details updated successfully.'),
      );
    } catch (error: any) {
      Alert.alert(
        t('common.error', 'Error'),
        error?.data?.message ||
          error?.data?.error ||
          t('director.agents.updateError', 'Failed to update the agent.'),
      );
    }
  };

  if (loadingAgent || loadingParents || loadingActivities || loadingCommissions) {
    return (
      <ScreenContainer>
        <ScreenSkeleton count={5} />
      </ScreenContainer>
    );
  }

  if (!agent) {
    return (
      <ScreenContainer>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          <ThemedText variant="body" style={styles.backLabel}>
            {t('common.back', 'Back')}
          </ThemedText>
        </TouchableOpacity>

        <EmptyState
          icon="person-outline"
          title={t('director.agents.agentNotFound', 'Agent not found')}
          description={t(
            'director.agents.agentNotFoundDescription',
            'This collecting agent could not be loaded.',
          )}
        />
      </ScreenContainer>
    );
  }

  const assignedParentsCount = parentsRes?.totalCount ?? parents.length;
  const activityCount = activitiesRes?.totalCount ?? activities.length;
  const commissionCount = commissionsRes?.totalCount ?? commissionsRes?.data?.length ?? 0;
  const totalCommissionAmount = commissionsRes?.totalCommissionAmount ?? 0;

  return (
    <ScreenContainer>
      <TouchableOpacity
        onPress={() => router.back()}
        style={styles.backButton}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        <ThemedText variant="body" style={styles.backLabel}>
          {t('common.back', 'Back')}
        </ThemedText>
      </TouchableOpacity>

      <ThemedCard variant="elevated" style={styles.heroCard}>
        <View style={styles.heroRow}>
          <Avatar firstName={agent.firstName} lastName={agent.lastName} size="xl" />
          <View style={styles.heroInfo}>
            <ThemedText variant="h2">
              {agent.firstName} {agent.lastName}
            </ThemedText>
            <ThemedText variant="bodySmall" color={theme.colors.textSecondary}>
              +{agent.countryCode} {formatPhone(agent.phoneNumber, '').trim()}
            </ThemedText>
            {!!agent.email && (
              <ThemedText variant="caption" color={theme.colors.textTertiary}>
                {agent.email}
              </ThemedText>
            )}
          </View>
        </View>

        <View style={styles.badgesRow}>
          <View
            style={[
              styles.pill,
              {
                backgroundColor: theme.colors.secondary,
                borderRadius: theme.borderRadius.full,
              },
            ]}
          >
            <ThemedText variant="caption" color="#FFFFFF" style={styles.pillText}>
              {agent.commissionPercentage ?? 0}%
            </ThemedText>
          </View>
          <View
            style={[
              styles.outlinePill,
              {
                borderColor: agent.fK_StatusId === 1 ? theme.colors.success : theme.colors.warning,
                borderRadius: theme.borderRadius.full,
              },
            ]}
          >
            <ThemedText
              variant="caption"
              color={agent.fK_StatusId === 1 ? theme.colors.success : theme.colors.warning}
              style={styles.pillText}
            >
              {agent.fK_StatusId === 1 ? 'Active' : 'Inactive'}
            </ThemedText>
          </View>
        </View>
      </ThemedCard>

      <View style={styles.summaryRow}>
        <ThemedCard variant="outlined" style={styles.summaryCard}>
          <Ionicons name="people-outline" size={20} color={theme.colors.primary} />
          <ThemedText variant="numeric" style={styles.summaryValue}>
            {assignedParentsCount}
          </ThemedText>
          <ThemedText variant="caption" color={theme.colors.textSecondary}>
            {t('director.agents.assignedParents', 'Assigned Parents')}
          </ThemedText>
        </ThemedCard>

        <ThemedCard variant="outlined" style={styles.summaryCard}>
          <Ionicons name="pulse-outline" size={20} color={theme.colors.success} />
          <ThemedText variant="numeric" style={styles.summaryValue}>
            {activityCount}
          </ThemedText>
          <ThemedText variant="caption" color={theme.colors.textSecondary}>
            {t('director.agents.activities', 'Activities')}
          </ThemedText>
        </ThemedCard>

        <ThemedCard variant="outlined" style={styles.summaryCard}>
          <Ionicons name="cash-outline" size={20} color={theme.colors.warning} />
          <ThemedText variant="numeric" style={styles.summaryValue}>
            {commissionCount}
          </ThemedText>
          <ThemedText variant="caption" color={theme.colors.textSecondary}>
            {t('director.agents.commissions', 'Commissions')}
          </ThemedText>
        </ThemedCard>
      </View>

      <ThemedCard variant="outlined" style={styles.detailsCard}>
        <DetailRow
          label={t('director.agents.area', 'Assigned Area')}
          value={agent.assignedArea || t('director.agents.noArea', 'No area assigned yet')}
          valueColor={agent.assignedArea ? theme.colors.text : theme.colors.textSecondary}
        />
        <DetailRow
          label={t('director.agents.commission', 'Commission Rate')}
          value={`${agent.commissionPercentage ?? 0}%`}
        />
        <DetailRow
          label={t('director.agents.totalCommission', 'Total Commissions')}
          value={formatCurrency(totalCommissionAmount)}
        />
        <DetailRow
          label={t('common.createdOn', 'Created On')}
          value={agent.createdOn ? formatDate(agent.createdOn) : '-'}
        />
      </ThemedCard>

      <View style={styles.actionRow}>
        <ThemedButton
          title={t('director.agents.viewActivities', 'View Activities')}
          onPress={() =>
            router.push({
              pathname: '/(app)/agent-activities',
              params: { agentId: String(agent.collectingAgentId) },
            })
          }
          variant="secondary"
          size="md"
          style={styles.actionButton}
          icon={<Ionicons name="pulse-outline" size={18} color={theme.colors.primary} />}
        />
        <ThemedButton
          title={t('common.edit', 'Edit')}
          onPress={() => setIsEditModalVisible(true)}
          variant="primary"
          size="md"
          style={styles.actionButton}
          icon={<Ionicons name="create-outline" size={18} color="#FFFFFF" />}
        />
      </View>

      <SectionHeader
        title={t('director.agents.assignedParents', 'Assigned Parents')}
        action={assignedParentsCount > 0 ? String(assignedParentsCount) : undefined}
      />
      {parents.length === 0 ? (
        <ThemedCard variant="outlined" style={styles.emptyCard}>
          <ThemedText variant="bodySmall" color={theme.colors.textSecondary}>
            {t(
              'director.agents.noAssignedParents',
              'This agent does not have any assigned parents yet.',
            )}
          </ThemedText>
        </ThemedCard>
      ) : (
        parents.slice(0, 4).map((parent) => (
          <ThemedCard key={parent.parentId} variant="outlined" style={styles.listCard}>
            <View style={styles.listRow}>
              <Avatar firstName={parent.firstName} lastName={parent.lastName} size="md" />
              <View style={styles.listInfo}>
                <ThemedText variant="bodySmall" style={styles.listTitle}>
                  {parent.firstName} {parent.lastName}
                </ThemedText>
                <ThemedText variant="caption" color={theme.colors.textSecondary}>
                  +{parent.countryCode} {formatPhone(parent.phoneNumber, '').trim()}
                </ThemedText>
              </View>
            </View>
          </ThemedCard>
        ))
      )}

      <SectionHeader
        title={t('director.agents.recentActivity', 'Recent Activity')}
        action={t('common.viewAll', 'View All')}
        onAction={() =>
          router.push({
            pathname: '/(app)/agent-activities',
            params: { agentId: String(agent.collectingAgentId) },
          })
        }
      />
      {activities.length === 0 ? (
        <ThemedCard variant="outlined" style={styles.emptyCard}>
          <ThemedText variant="bodySmall" color={theme.colors.textSecondary}>
            {t('director.agents.noActivity', 'No activities have been logged for this agent yet.')}
          </ThemedText>
        </ThemedCard>
      ) : (
        activities.slice(0, 4).map((activity) => (
          <ThemedCard key={activity.activityId} variant="outlined" style={styles.activityCard}>
            <View style={styles.activityHeader}>
              <View
                style={[
                  styles.activityIcon,
                  {
                    backgroundColor: theme.colors.primaryLight + '15',
                    borderRadius: theme.borderRadius.md,
                  },
                ]}
              >
                <Ionicons name="pulse-outline" size={18} color={theme.colors.primary} />
              </View>
              <View style={styles.activityInfo}>
                <ThemedText variant="bodySmall" style={styles.listTitle}>
                  {activity.activityDescription}
                </ThemedText>
                <ThemedText variant="caption" color={theme.colors.textSecondary}>
                  {activity.parent?.firstName && activity.parent?.lastName
                    ? `${activity.parent.firstName} ${activity.parent.lastName}`
                    : activity.fK_ParentId
                      ? `Parent #${activity.fK_ParentId}`
                      : t('director.agents.generalActivity', 'General activity')}
                </ThemedText>
              </View>
              <ThemedText variant="caption" color={theme.colors.textTertiary}>
                {formatDate(activity.activityDate || activity.createdOn || new Date().toISOString())}
              </ThemedText>
            </View>
          </ThemedCard>
        ))
      )}

      <Modal
        visible={isEditModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setIsEditModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setIsEditModalVisible(false)}>
          <Pressable
            style={[
              styles.modalContent,
              { backgroundColor: theme.colors.card, borderRadius: theme.borderRadius.lg },
            ]}
            onPress={(event) => event.stopPropagation()}
          >
            <ScrollView showsVerticalScrollIndicator={false}>
              <ThemedText variant="subtitle" style={styles.modalTitle}>
                {t('director.agents.editAgent', 'Edit Agent')}
              </ThemedText>
              <ThemedText
                variant="caption"
                color={theme.colors.textSecondary}
                style={styles.modalDescription}
              >
                {t(
                  'director.agents.editAgentDescription',
                  'Update the agent profile, area, and commission rate.',
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
                  onPress={() => setIsEditModalVisible(false)}
                  variant="ghost"
                  size="md"
                  style={styles.modalButton}
                />
                <ThemedButton
                  title={t('common.save', 'Save')}
                  onPress={handleSaveAgent}
                  variant="primary"
                  size="md"
                  style={styles.modalButton}
                  loading={isSavingAgent}
                />
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    marginTop: 4,
    marginBottom: 12,
  },
  backLabel: {
    marginLeft: 8,
  },
  heroCard: {
    marginBottom: 16,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroInfo: {
    flex: 1,
    marginLeft: 16,
    gap: 4,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  outlinePill: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pillText: {
    fontWeight: '700',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 10,
  },
  summaryValue: {
    marginTop: 8,
    marginBottom: 4,
  },
  detailsCard: {
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  detailValue: {
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
    marginLeft: 12,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  actionButton: {
    flex: 1,
  },
  emptyCard: {
    marginBottom: 16,
  },
  listCard: {
    marginBottom: 10,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  listInfo: {
    flex: 1,
    marginLeft: 12,
  },
  listTitle: {
    fontWeight: '600',
  },
  activityCard: {
    marginBottom: 10,
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  activityIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityInfo: {
    flex: 1,
    marginRight: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    width: '100%',
    maxHeight: '88%',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
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
    marginTop: 4,
  },
  modalButton: {
    flex: 1,
  },
});

export default AgentDetailScreen;
