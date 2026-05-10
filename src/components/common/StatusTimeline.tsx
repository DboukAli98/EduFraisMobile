import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ThemedText from './ThemedText';
import { useTheme } from '../../theme';
import { SUPPORT_REQUEST_STATUSES } from '../../constants';
import type { ActivityRequestStatus, ChildApprovalStatus, PaymentStatus } from '../../types';

export type TimelineTone = 'pending' | 'active' | 'success' | 'error' | 'neutral';

export type TimelineStep = {
    key: string;
    label: string;
    tone?: TimelineTone;
};

type StatusTimelineProps = {
    steps: TimelineStep[];
    currentKey: string;
    compact?: boolean;
};

const getToneColor = (tone: TimelineTone | undefined, colors: ReturnType<typeof useTheme>['theme']['colors']) => {
    switch (tone) {
        case 'success':
            return colors.success;
        case 'error':
            return colors.error;
        case 'active':
            return colors.info;
        case 'pending':
            return colors.warning;
        default:
            return colors.textTertiary;
    }
};

const StatusTimeline: React.FC<StatusTimelineProps> = ({ steps, currentKey, compact = false }) => {
    const { theme } = useTheme();
    const currentIndex = Math.max(0, steps.findIndex((step) => step.key === currentKey));

    return (
        <View style={[styles.container, compact && styles.compactContainer]}>
            {steps.map((step, index) => {
                const isDone = index < currentIndex;
                const isCurrent = index === currentIndex;
                const color = getToneColor(isCurrent ? step.tone : isDone ? 'success' : 'neutral', theme.colors);

                return (
                    <React.Fragment key={step.key}>
                        <View style={styles.step}>
                            <View
                                style={[
                                    styles.dot,
                                    {
                                        backgroundColor: isCurrent || isDone ? color : theme.colors.inputBackground,
                                        borderColor: color,
                                        borderRadius: theme.borderRadius.full,
                                    },
                                ]}
                            >
                                {isDone ? <Ionicons name="checkmark" size={10} color="#FFFFFF" /> : null}
                            </View>
                            <ThemedText
                                variant="caption"
                                color={isCurrent ? color : theme.colors.textSecondary}
                                numberOfLines={compact ? 1 : 2}
                                style={[styles.label, isCurrent && styles.activeLabel]}
                            >
                                {step.label}
                            </ThemedText>
                        </View>
                        {index < steps.length - 1 ? (
                            <View
                                style={[
                                    styles.line,
                                    { backgroundColor: index < currentIndex ? theme.colors.success : theme.colors.borderLight },
                                ]}
                            />
                        ) : null}
                    </React.Fragment>
                );
            })}
        </View>
    );
};

export const childApprovalTimeline = (status: ChildApprovalStatus): { steps: TimelineStep[]; currentKey: string } => ({
    currentKey: status,
    steps:
        status === 'Rejected'
            ? [
                { key: 'Pending', label: 'En attente', tone: 'pending' },
                { key: 'Rejected', label: 'Refusé', tone: 'error' },
            ]
            : [
                { key: 'Pending', label: 'En attente', tone: 'pending' },
                { key: 'Approved', label: 'Approuvé', tone: 'success' },
            ],
});

export const agentRequestTimeline = (status: 'Pending' | 'Approved' | 'Rejected'): { steps: TimelineStep[]; currentKey: string } => ({
    currentKey: status,
    steps:
        status === 'Rejected'
            ? [
                { key: 'Pending', label: 'En attente', tone: 'pending' },
                { key: 'Rejected', label: 'Refusé', tone: 'error' },
            ]
            : [
                { key: 'Pending', label: 'En attente', tone: 'pending' },
                { key: 'Approved', label: 'Approuvé', tone: 'success' },
            ],
});

export const supportRequestTimeline = (statusId: number): { steps: TimelineStep[]; currentKey: string } => ({
    currentKey: String(statusId),
    steps:
        statusId === SUPPORT_REQUEST_STATUSES.Cancelled
            ? [
                { key: String(SUPPORT_REQUEST_STATUSES.Pending), label: 'Ouvert', tone: 'pending' },
                { key: String(SUPPORT_REQUEST_STATUSES.Cancelled), label: 'Annulé', tone: 'error' },
            ]
            : statusId === SUPPORT_REQUEST_STATUSES.Stall
                ? [
                    { key: String(SUPPORT_REQUEST_STATUSES.Pending), label: 'Ouvert', tone: 'pending' },
                    { key: String(SUPPORT_REQUEST_STATUSES.InProgress), label: 'En cours', tone: 'active' },
                    { key: String(SUPPORT_REQUEST_STATUSES.Stall), label: 'En pause', tone: 'pending' },
                ]
                : [
                    { key: String(SUPPORT_REQUEST_STATUSES.Pending), label: 'Ouvert', tone: 'pending' },
                    { key: String(SUPPORT_REQUEST_STATUSES.InProgress), label: 'En cours', tone: 'active' },
                    { key: String(SUPPORT_REQUEST_STATUSES.Resolved), label: 'Résolu', tone: 'success' },
                ],
});

export const activityRequestTimeline = (status: ActivityRequestStatus): { steps: TimelineStep[]; currentKey: string } => ({
    currentKey: status,
    steps:
        status === 'Declined' || status === 'Cancelled'
            ? [
                { key: 'Requested', label: 'Demandé', tone: 'pending' },
                { key: status, label: status === 'Declined' ? 'Refusé' : 'Annulé', tone: 'error' },
            ]
            : [
                { key: 'Requested', label: 'Demandé', tone: 'pending' },
                { key: 'Accepted', label: 'Accepté', tone: 'active' },
                { key: 'Completed', label: 'Terminé', tone: 'success' },
            ],
});

export const paymentTimeline = (status: PaymentStatus): { steps: TimelineStep[]; currentKey: string } => ({
    currentKey: status,
    steps:
        status === 'Cancelled' || status === 'Failed'
            ? [
                { key: 'Pending', label: 'En attente', tone: 'pending' },
                { key: 'InProgress', label: 'En cours', tone: 'active' },
                { key: status, label: status === 'Failed' ? 'Échoué' : 'Annulé', tone: 'error' },
            ]
            : [
                { key: 'Pending', label: 'En attente', tone: 'pending' },
                { key: 'InProgress', label: 'En cours', tone: 'active' },
                { key: 'Processed', label: 'Traité', tone: 'success' },
            ],
});

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginTop: 12,
    },
    compactContainer: {
        marginTop: 10,
    },
    step: {
        width: 58,
        alignItems: 'center',
    },
    dot: {
        width: 18,
        height: 18,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    line: {
        flex: 1,
        height: 2,
        marginTop: 8,
        marginHorizontal: -8,
    },
    label: {
        marginTop: 5,
        fontSize: 10,
        lineHeight: 13,
        textAlign: 'center',
        fontWeight: '600',
    },
    activeLabel: {
        fontWeight: '800',
    },
});

export default StatusTimeline;