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
    ThemedButton,
    ThemedCard,
    ThemedText,
    activityRequestTimeline,
    useAlert,
} from '../../components';
import { useTheme } from '../../theme';
import {
    useAcceptActivityRequestMutation,
    useCompleteActivityRequestMutation,
    useDeclineActivityRequestMutation,
    useGetAgentActivityRequestsQuery,
    useGetMyActivitiesQuery,
} from '../../services/api/apiSlice';
import { formatDateTimeCongo, normalizeRequestStatus } from '../../utils';
import type { ActivityRequestStatus, CollectingAgentActivity } from '../../types';

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
    'PaymentHelp',
] as const;

type ActivityKey = (typeof ACTIVITY_TYPE_KEYS)[number];
type BadgeTheme = { bg: string; fg: string; label: string };

const normalizeActivityType = (value: string | number | undefined): ActivityKey => {
    if (typeof value === 'number') {
        return ACTIVITY_TYPE_KEYS[value] ?? 'Other';
    }

    if (value && (ACTIVITY_TYPE_KEYS as readonly string[]).includes(value)) {
        return value as ActivityKey;
    }

    return 'Other';
};

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

const getParentName = (activity: CollectingAgentActivity, fallback: string) => {
    const firstName = activity.parent?.firstName;
    const lastName = activity.parent?.lastName;

    if (firstName || lastName) {
        return [firstName, lastName].filter(Boolean).join(' ');
    }

    return activity.parentName || fallback;
};

const AgentActivityDetailScreen: React.FC = () => {
    const { theme } = useTheme();
    const { t } = useTranslation();
    const { showAlert } = useAlert();
    const params = useLocalSearchParams<{ activityId?: string }>();
    const activityId = parseInt(params.activityId || '0', 10);
    const statusTheme = useRequestStatusTheme();

    const {
        data: requestsData,
        isLoading: loadingRequests,
        refetch: refetchRequests,
    } = useGetAgentActivityRequestsQuery({ pageNumber: 1, pageSize: 100 });
    const {
        data: activitiesData,
        isLoading: loadingActivities,
        refetch: refetchActivities,
    } = useGetMyActivitiesQuery({ pageNumber: 1, pageSize: 100 });

    const [acceptRequest, { isLoading: accepting }] = useAcceptActivityRequestMutation();
    const [declineRequest, { isLoading: declining }] = useDeclineActivityRequestMutation();
    const [completeRequest, { isLoading: completing }] = useCompleteActivityRequestMutation();

    const activity = useMemo(() => {
        const requestRows = Array.isArray(requestsData?.data) ? requestsData!.data : [];
        const activityRows = Array.isArray(activitiesData?.data) ? activitiesData!.data : [];

        return (
            requestRows.find((item) => item.activityId === activityId) ??
            activityRows.find((item) => item.activityId === activityId)
        );
    }, [activityId, activitiesData, requestsData]);

    const refresh = () => {
        refetchRequests();
        refetchActivities();
    };

    const handleAccept = async () => {
        if (!activity) return;

        try {
            const result = await acceptRequest({ activityId: activity.activityId }).unwrap();
            if (result.status === 'Success') {
                refresh();
                return;
            }

            showAlert({
                type: 'error',
                title: t('common.error', 'Error'),
                message: result.error || t('common.genericError', 'Something went wrong'),
            });
        } catch (err: any) {
            showAlert({
                type: 'error',
                title: t('common.error', 'Error'),
                message: err?.data?.error || err?.message || t('common.genericError', 'Something went wrong'),
            });
        }
    };

    const handleDecline = () => {
        if (!activity) return;

        showAlert({
            type: 'warning',
            title: t('agent.activities.declineTitle', 'Decline Request'),
            message: t(
                'agent.activities.declinePrompt',
                'The parent will be notified that you cannot handle this request.',
            ),
            buttons: [
                { text: t('common.cancel', 'Cancel'), style: 'cancel' },
                {
                    text: t('agent.activities.decline', 'Decline'),
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const result = await declineRequest({ activityId: activity.activityId }).unwrap();
                            if (result.status === 'Success') {
                                refresh();
                                return;
                            }

                            showAlert({
                                type: 'error',
                                title: t('common.error', 'Error'),
                                message: result.error || t('common.genericError', 'Something went wrong'),
                            });
                        } catch (err: any) {
                            showAlert({
                                type: 'error',
                                title: t('common.error', 'Error'),
                                message: err?.data?.error || err?.message || t('common.genericError', 'Something went wrong'),
                            });
                        }
                    },
                },
            ],
        });
    };

    const handleComplete = () => {
        if (!activity) return;

        showAlert({
            type: 'info',
            title: t('agent.activities.completeTitle', 'Mark as completed?'),
            message: t(
                'agent.activities.completePrompt',
                'The parent will be notified that this activity is done.',
            ),
            buttons: [
                { text: t('common.cancel', 'Cancel'), style: 'cancel' },
                {
                    text: t('agent.activities.complete', 'Complete'),
                    onPress: async () => {
                        try {
                            const result = await completeRequest({ activityId: activity.activityId }).unwrap();
                            if (result.status === 'Success') {
                                refresh();
                                return;
                            }

                            showAlert({
                                type: 'error',
                                title: t('common.error', 'Error'),
                                message: result.error || t('common.genericError', 'Something went wrong'),
                            });
                        } catch (err: any) {
                            showAlert({
                                type: 'error',
                                title: t('common.error', 'Error'),
                                message: err?.data?.error || err?.message || t('common.genericError', 'Something went wrong'),
                            });
                        }
                    },
                },
            ],
        });
    };

    if ((loadingRequests || loadingActivities) && !activity) {
        return (
            <ScreenContainer>
                <ScreenSkeleton count={4} />
            </ScreenContainer>
        );
    }

    if (!activity) {
        return (
            <ScreenContainer>
                <View style={styles.headerRow}>
                    <BackButton showLabel={false} />
                    <ThemedText variant="h1" style={styles.headerTitle}>
                        {t('agent.activities.detailTitle', 'Activity Details')}
                    </ThemedText>
                </View>
                <ThemedCard variant="outlined">
                    <ThemedText variant="body" color={theme.colors.textSecondary}>
                        {t('agent.activities.notFound', 'Activity not found')}
                    </ThemedText>
                </ThemedCard>
            </ScreenContainer>
        );
    }

    const activityKey = normalizeActivityType(activity.activityType);
    // Normalize so we accept either the string ("Requested") or the
    // numeric enum (1) the backend may return depending on the path.
    const status = normalizeRequestStatus(activity.requestStatus);
    const badge = status ? statusTheme[status] : null;
    const timeline = status ? activityRequestTimeline(status) : null;
    const parentName = getParentName(activity, t('agent.activities.parentAnonymous', 'Parent'));
    const canAcceptOrDecline = status === 'Requested';
    const canComplete = status === 'Accepted';
    const dateRows = [
        {
            label: t('agent.activities.activityDate', 'Activity date'),
            value: activity.activityDate || activity.createdOn,
        },
        {
            label: t('agent.activities.requestedOn', 'Requested on'),
            value: activity.requestedAt,
        },
        {
            label: t('agent.activities.acceptedOn', 'Accepted on'),
            value: activity.acceptedAt,
        },
        {
            label: t('agent.activities.completedOn', 'Completed on'),
            value: activity.completedAt,
        },
        {
            label: t('agent.activities.cancelledOn', 'Cancelled on'),
            value: activity.cancelledAt,
        },
    ].filter((row) => Boolean(row.value));

    return (
        <ScreenContainer>
            <View style={styles.headerRow}>
                <BackButton showLabel={false} />
                <ThemedText variant="h1" style={styles.headerTitle}>
                    {t('agent.activities.detailTitle', 'Activity Details')}
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
                            {t(`agent.activities.types.${activityKey}`, activity.activityTypeDisplayName || activityKey)}
                        </ThemedText>
                        <ThemedText variant="caption" color={theme.colors.textSecondary}>
                            {t('agent.activities.from', 'From')}: {parentName}
                        </ThemedText>
                    </View>
                    {badge ? (
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
                    ) : null}
                </View>

                <ThemedText variant="body" style={styles.description}>
                    {activity.activityDescription}
                </ThemedText>

                {activity.notes ? (
                    <ThemedText variant="caption" color={theme.colors.textSecondary} style={styles.notes}>
                        {activity.notes}
                    </ThemedText>
                ) : null}
            </ThemedCard>

            {timeline ? (
                <>
                    <SectionHeader title={t('agent.activities.timelineTitle', 'Timeline')} style={styles.section} />
                    <ThemedCard variant="outlined">
                        <StatusTimeline steps={timeline.steps} currentKey={timeline.currentKey} />
                    </ThemedCard>
                </>
            ) : null}

            {canAcceptOrDecline || canComplete ? (
                <View style={styles.actionsRow}>
                    {canAcceptOrDecline ? (
                        <>
                            <ThemedButton
                                title={t('agent.activities.accept', 'Accept')}
                                variant="primary"
                                onPress={handleAccept}
                                loading={accepting}
                                style={styles.actionBtn}
                            />
                            <ThemedButton
                                title={t('agent.activities.decline', 'Decline')}
                                variant="ghost"
                                onPress={handleDecline}
                                loading={declining}
                                style={styles.actionBtn}
                            />
                        </>
                    ) : null}
                    {canComplete ? (
                        <ThemedButton
                            title={t('agent.activities.markComplete', 'Mark Completed')}
                            variant="primary"
                            onPress={handleComplete}
                            loading={completing}
                            fullWidth
                        />
                    ) : null}
                </View>
            ) : null}

            <SectionHeader title={t('agent.activities.activityInfo', 'Information')} style={styles.section} />
            <ThemedCard variant="outlined" style={styles.infoCard}>
                {status ? (
                    <View style={styles.infoRow}>
                        <ThemedText variant="caption" color={theme.colors.textSecondary}>
                            {t('agent.activities.requestStatus', 'Status')}
                        </ThemedText>
                        <ThemedText variant="bodySmall" style={styles.infoValue}>
                            {badge?.label}
                        </ThemedText>
                    </View>
                ) : null}

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

                {status === 'Declined' && activity.declineReason ? (
                    <View style={styles.infoRow}>
                        <ThemedText variant="caption" color={theme.colors.error}>
                            {t('parent.requestActivity.declinedReason', 'Reason')}
                        </ThemedText>
                        <ThemedText variant="bodySmall" color={theme.colors.error} style={styles.infoValue}>
                            {activity.declineReason}
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
    actionsRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 12,
    },
    actionBtn: {
        flex: 1,
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

export default AgentActivityDetailScreen;