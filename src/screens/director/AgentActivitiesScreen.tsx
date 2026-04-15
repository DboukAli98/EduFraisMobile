import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import {
  Avatar,
  EmptyState,
  ScreenContainer,
  ScreenSkeleton,
  ThemedCard,
  ThemedText,
} from '../../components';
import { useTheme } from '../../theme';
import { useGetAgentActivitiesQuery, useGetAgentDetailsQuery } from '../../services/api/apiSlice';
import { formatDate } from '../../utils';

const ACTIVITY_TYPE_KEYS = [
  'PaymentCollected',
  'PaymentAttempted',
  'ParentContact',
  'SupportRequestHandled',
  'ParentAssigned',
  'ParentUnassigned',
  'FieldVisit',
  'PhoneCall',
  'Other',
] as const;

const ACTIVITY_META: Record<
  string,
  {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    colorToken: 'primary' | 'success' | 'warning' | 'secondary';
  }
> = {
  PaymentCollected: { icon: 'cash-outline', label: 'Payment Collected', colorToken: 'success' },
  PaymentAttempted: { icon: 'alert-circle-outline', label: 'Payment Attempt', colorToken: 'warning' },
  ParentContact: { icon: 'chatbubble-ellipses-outline', label: 'Parent Contact', colorToken: 'primary' },
  SupportRequestHandled: { icon: 'help-buoy-outline', label: 'Support Handled', colorToken: 'secondary' },
  ParentAssigned: { icon: 'link-outline', label: 'Parent Assigned', colorToken: 'primary' },
  ParentUnassigned: { icon: 'unlink-outline', label: 'Parent Unassigned', colorToken: 'warning' },
  FieldVisit: { icon: 'navigate-outline', label: 'Field Visit', colorToken: 'primary' },
  PhoneCall: { icon: 'call-outline', label: 'Phone Call', colorToken: 'secondary' },
  Other: { icon: 'ellipse-outline', label: 'Other', colorToken: 'primary' },
};

const normalizeActivityType = (value: string | number | undefined) => {
  if (typeof value === 'number') {
    return ACTIVITY_TYPE_KEYS[value] ?? 'Other';
  }

  return value && ACTIVITY_META[value] ? value : 'Other';
};

const AgentActivitiesScreen: React.FC = () => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { agentId } = useLocalSearchParams<{ agentId: string }>();

  const numericAgentId = parseInt(agentId ?? '0', 10);

  const { data: agentRes, isLoading: loadingAgent } = useGetAgentDetailsQuery(
    { agentId: numericAgentId },
    { skip: !numericAgentId },
  );
  const { data: activitiesRes, isLoading: loadingActivities } = useGetAgentActivitiesQuery(
    { collectingAgentId: numericAgentId, pageNumber: 1, pageSize: 100 },
    { skip: !numericAgentId },
  );

  const agent = agentRes?.data;
  const activities = activitiesRes?.data ?? [];

  if (loadingAgent || loadingActivities) {
    return (
      <ScreenContainer>
        <ScreenSkeleton count={6} />
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
          icon="pulse-outline"
          title={t('director.agents.agentNotFound', 'Agent not found')}
          description={t(
            'director.agents.agentNotFoundDescription',
            'This collecting agent could not be loaded.',
          )}
        />
      </ScreenContainer>
    );
  }

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
          <Avatar firstName={agent.firstName} lastName={agent.lastName} size="lg" />
          <View style={styles.heroInfo}>
            <ThemedText variant="h2">
              {agent.firstName} {agent.lastName}
            </ThemedText>
            <ThemedText variant="bodySmall" color={theme.colors.textSecondary}>
              {activitiesRes?.totalCount ?? activities.length} {t('director.agents.activities', 'activities')}
            </ThemedText>
            <ThemedText variant="caption" color={theme.colors.textTertiary}>
              {agent.assignedArea || t('director.agents.noArea', 'No area assigned yet')}
            </ThemedText>
          </View>
        </View>
      </ThemedCard>

      {activities.length === 0 ? (
        <EmptyState
          icon="pulse-outline"
          title={t('director.agents.noActivity', 'No activities yet')}
          description={t(
            'director.agents.noActivityDescription',
            'This agent has not logged any activity yet.',
          )}
        />
      ) : (
        activities.map((activity) => {
          const activityKey = normalizeActivityType(activity.activityType);
          const meta = ACTIVITY_META[activityKey];
          const iconColor =
            meta.colorToken === 'success'
              ? theme.colors.success
              : meta.colorToken === 'warning'
                ? theme.colors.warning
                : meta.colorToken === 'secondary'
                  ? theme.colors.secondary
                  : theme.colors.primary;

          return (
            <ThemedCard key={activity.activityId} variant="outlined" style={styles.activityCard}>
              <View style={styles.activityRow}>
                <View
                  style={[
                    styles.iconWrap,
                    {
                      backgroundColor: iconColor + '15',
                      borderRadius: theme.borderRadius.md,
                    },
                  ]}
                >
                  <Ionicons name={meta.icon} size={18} color={iconColor} />
                </View>

                <View style={styles.activityContent}>
                  <View style={styles.activityHeader}>
                    <ThemedText variant="bodySmall" style={styles.activityTitle}>
                      {meta.label}
                    </ThemedText>
                    <ThemedText variant="caption" color={theme.colors.textTertiary}>
                      {formatDate(activity.activityDate || activity.createdOn || new Date().toISOString())}
                    </ThemedText>
                  </View>

                  <ThemedText variant="body" style={styles.activityDescription}>
                    {activity.activityDescription}
                  </ThemedText>

                  {(activity.parent?.firstName || activity.fK_ParentId) && (
                    <ThemedText variant="caption" color={theme.colors.textSecondary}>
                      {activity.parent?.firstName && activity.parent?.lastName
                        ? `${activity.parent.firstName} ${activity.parent.lastName}`
                        : `Parent #${activity.fK_ParentId}`}
                    </ThemedText>
                  )}

                  {!!activity.notes && (
                    <ThemedText variant="caption" color={theme.colors.textTertiary} style={styles.notes}>
                      {activity.notes}
                    </ThemedText>
                  )}
                </View>
              </View>
            </ThemedCard>
          );
        })
      )}
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
    marginLeft: 14,
    gap: 4,
  },
  activityCard: {
    marginBottom: 10,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconWrap: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 4,
  },
  activityTitle: {
    fontWeight: '700',
    flex: 1,
  },
  activityDescription: {
    marginBottom: 6,
  },
  notes: {
    marginTop: 4,
  },
});

export default AgentActivitiesScreen;
