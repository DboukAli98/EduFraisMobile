import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import {
    BackButton,
    ScreenContainer,
    ScreenSkeleton,
    SectionHeader,
    StatusTimeline,
    ThemedCard,
    ThemedText,
    activityRequestTimeline,
} from '../../components';
import { useTheme } from '../../theme';
import { useGetMyActivityRequestsQuery } from '../../services/api/apiSlice';
import { formatDateTimeCongo } from '../../utils';
import type { ActivityRequestStatus, CollectingAgentActivity } from '../../types';

type BadgeTheme = { bg: string; fg: string; label: string };

const useRequestStatusTheme = (): Record<ActivityRequestStatus, BadgeTheme> => {
    const { theme } = useTheme();
    const { t } = useTranslation();

    return {
        Requested: {
            bg: theme.colors.warning + '22',
            fg: theme.colors.warning,
            label: t('parent.requestActivity.status.Requested', 'Pending'),
        },
        Accepted: {
            bg: theme.colors.primary + '22',
            fg: theme.colors.primary,
            label: t('parent.requestActivity.status.Accepted', 'Accepted'),
        },
        Declined: {
            bg: theme.colors.error + '22',
            fg: theme.colors.error,
            label: t('parent.requestActivity.status.Declined', 'Declined'),
        },
        Completed: {
            bg: theme.colors.success + '22',
            fg: theme.colors.success,
            label: t('parent.requestActivity.status.Completed', 'Completed'),
        },
        Cancelled: {
            bg: theme.colors.textTertiary + '22',
            fg: theme.colors.textTertiary,
            label: t('parent.requestActivity.status.Cancelled', 'Cancelled'),
        },
    };
};

const getAgentName = (request: CollectingAgentActivity) => {
    const firstName = request.collectingAgent?.firstName;
    const lastName = request.collectingAgent?.lastName;

    if (firstName || lastName) {
        return [firstName, lastName].filter(Boolean).join(' ');
    }

    return request.agentName || null;
};

const ActivityRequestDetailScreen: React.FC = () => {
    const { theme } = useTheme();
    const { t } = useTranslation();
    const params = useLocalSearchParams<{ activityId?: string }>();
    const activityId = parseInt(params.activityId || '0', 10);
    const statusTheme = useRequestStatusTheme();

    const { data, isLoading } = useGetMyActivityRequestsQuery({
        pageNumber: 1,
        pageSize: 100,
    });

    const request = useMemo(
        () => (data?.data ?? []).find((item) => item.activityId === activityId),
        [activityId, data],
    );

    if (isLoading) {
        return (
            <ScreenContainer>
                <ScreenSkeleton count={4} />
            </ScreenContainer>
        );
    }

    if (!request) {
        return (
            <ScreenContainer>
                <View style={styles.headerRow}>
                    <BackButton showLabel={false} />
                    <ThemedText variant="h1">
                        {t('parent.requestActivity.detailTitle', 'Request Details')}
                    </ThemedText>
                </View>
                <ThemedCard variant="outlined">
                    <ThemedText variant="body" color={theme.colors.textSecondary}>
                        {t('parent.requestActivity.notFound', 'Request not found')}
                    </ThemedText>
                </ThemedCard>
            </ScreenContainer>
        );
    }

    const status =
        (typeof request.requestStatus === 'string' ? request.requestStatus : undefined) ||
        'Requested';
    const badge = statusTheme[status as ActivityRequestStatus];
    const timeline = activityRequestTimeline(status as ActivityRequestStatus);
    const agentName = getAgentName(request);
    const dateRows = [
        {
            label: t('parent.requestActivity.requestedOn', 'Requested on'),
            value: request.requestedAt || request.createdOn,
        },
        {
            label: t('parent.requestActivity.acceptedOn', 'Accepted on'),
            value: request.acceptedAt,
        },
        {
            label: t('parent.requestActivity.completedOn', 'Completed on'),
            value: request.completedAt,
        },
        {
            label: t('parent.requestActivity.cancelledOn', 'Cancelled on'),
            value: request.cancelledAt,
        },
    ].filter((row) => Boolean(row.value));

    return (
        <ScreenContainer>
            <View style={styles.headerRow}>
                <BackButton showLabel={false} />
                <ThemedText variant="h1" style={styles.headerTitle}>
                    {t('parent.requestActivity.detailTitle', 'Request Details')}
                </ThemedText>
            </View>

            <ThemedCard variant="elevated" style={styles.summaryCard}>
                <View style={styles.summaryHeader}>
                    <View
                        style={[
                            styles.iconWrap,
                            {
                                backgroundColor: theme.colors.primary + '15',
                                borderRadius: theme.borderRadius.md,
                            },
                        ]}
                    >
                        <Ionicons name="clipboard-outline" size={20} color={theme.colors.primary} />
                    </View>
                    <View style={styles.summaryText}>
                        <ThemedText variant="h2">
                            {request.activityTypeDisplayName || String(request.activityType)}
                        </ThemedText>
                        {agentName ? (
                            <ThemedText variant="caption" color={theme.colors.textSecondary}>
                                {t('parent.requestActivity.agentSection', 'Agent')}: {agentName}
                            </ThemedText>
                        ) : null}
                    </View>
                    <View
                        style={[
                            styles.badge,
                            { backgroundColor: badge.bg, borderRadius: theme.borderRadius.full },
                        ]}
                    >
                        <ThemedText variant="caption" color={badge.fg} style={styles.badgeLabel}>
                            {badge.label}
                        </ThemedText>
                    </View>
                </View>

                <ThemedText variant="body" style={styles.description}>
                    {request.activityDescription}
                </ThemedText>

                {request.notes ? (
                    <ThemedText variant="caption" color={theme.colors.textSecondary} style={styles.notes}>
                        {request.notes}
                    </ThemedText>
                ) : null}
            </ThemedCard>

            <SectionHeader title={t('parent.requestActivity.timelineTitle', 'Timeline')} style={styles.section} />
            <ThemedCard variant="outlined">
                <StatusTimeline steps={timeline.steps} currentKey={timeline.currentKey} />
            </ThemedCard>

            <SectionHeader title={t('parent.requestActivity.requestInfo', 'Information')} style={styles.section} />
            <ThemedCard variant="outlined" style={styles.infoCard}>
                {dateRows.map((row) => (
                    <View key={row.label} style={styles.infoRow}>
                        <ThemedText variant="caption" color={theme.colors.textSecondary}>
                            {row.label}
                        </ThemedText>
                        <ThemedText variant="bodySmall" style={styles.infoValue}>
                            {formatDateTimeCongo(row.value || new Date().toISOString())}
                        </ThemedText>
                    </View>
                ))}

                {status === 'Declined' && request.declineReason ? (
                    <View style={styles.infoRow}>
                        <ThemedText variant="caption" color={theme.colors.error}>
                            {t('parent.requestActivity.declinedReason', 'Reason')}
                        </ThemedText>
                        <ThemedText variant="bodySmall" color={theme.colors.error} style={styles.infoValue}>
                            {request.declineReason}
                        </ThemedText>
                    </View>
                ) : null}
            </ThemedCard>
        </ScreenContainer>
    );
};

const styles = StyleSheet.create({
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 16,
        marginTop: 8,
    },
    headerTitle: {
        flex: 1,
    },
    summaryCard: {
        marginBottom: 12,
    },
    summaryHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    iconWrap: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    summaryText: {
        flex: 1,
    },
    badge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    badgeLabel: {
        fontWeight: '700',
    },
    description: {
        marginTop: 14,
    },
    notes: {
        marginTop: 8,
    },
    section: {
        marginTop: 8,
    },
    infoCard: {
        gap: 12,
    },
    infoRow: {
        gap: 4,
    },
    infoValue: {
        fontWeight: '600',
    },
});

export default ActivityRequestDetailScreen;