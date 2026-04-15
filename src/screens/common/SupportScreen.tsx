import React, { useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useTheme } from '../../theme';
import { useAnimatedEntry, staggerDelay } from '../../hooks';
import {
  ScreenContainer,
  ThemedText,
  ThemedCard,
  ThemedButton,
  EmptyState,
  LoadingSkeleton,
} from '../../components';
import { useGetAllSupportRequestsQuery } from '../../services/api/apiSlice';
import { formatDate } from '../../utils';
import type { SupportRequest } from '../../types';

// --- Types ---
type SupportFilter = 'all' | 'open' | 'inProgress' | 'resolved';

const FILTERS: { key: SupportFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'inProgress', label: 'In Progress' },
  { key: 'resolved', label: 'Resolved' },
];

// statusId mapping: 1 = Open, 2 = In Progress, 3 = Resolved
const getStatusLabel = (statusId: number): string => {
  switch (statusId) {
    case 1: return 'Open';
    case 2: return 'In Progress';
    case 3: return 'Resolved';
    default: return 'Open';
  }
};

const getStatusColor = (statusId: number, colors: any): string => {
  switch (statusId) {
    case 1: return colors.warning;
    case 2: return colors.info;
    case 3: return colors.success;
    default: return colors.warning;
  }
};

const getPriorityColor = (priority: string, colors: any): string => {
  switch (priority) {
    case 'Low': return colors.info;
    case 'Medium': return colors.warning;
    case 'High': return colors.accent;
    case 'Urgent': return colors.error;
    default: return colors.info;
  }
};

const AnimatedSection: React.FC<{
  index: number;
  children: React.ReactNode;
}> = ({ index, children }) => {
  const animatedStyle = useAnimatedEntry({
    type: 'slideUp',
    delay: staggerDelay(index, 70),
  });
  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
};

export default function SupportScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<SupportFilter>('all');

  const { data: supportData, isLoading } = useGetAllSupportRequestsQuery({
    pageNumber: 1,
    pageSize: 20,
    filterByCurrentUser: true,
  });

  const requests = supportData?.data ?? [];

  const filteredRequests = requests.filter((r: SupportRequest) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'open') return r.fK_StatusId === 1;
    if (activeFilter === 'inProgress') return r.fK_StatusId === 2;
    return r.fK_StatusId === 3;
  });

  return (
    <ScreenContainer>
      {/* New Request Button */}
      <AnimatedSection index={0}>
        <ThemedButton
          title={t('support.newRequest', 'New Request')}
          onPress={() => { }}
          variant="primary"
          size="md"
          fullWidth
          icon={<Ionicons name="add-circle" size={20} color="#FFFFFF" />}
          style={styles.newRequestBtn}
        />
      </AnimatedSection>

      {/* Filter Chips */}
      <AnimatedSection index={1}>
        <View style={styles.filterRow}>
          {FILTERS.map((filter) => {
            const isActive = activeFilter === filter.key;
            return (
              <Pressable
                key={filter.key}
                onPress={() => setActiveFilter(filter.key)}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: isActive
                      ? theme.colors.primary
                      : theme.colors.inputBackground,
                    borderRadius: theme.borderRadius.full,
                  },
                ]}
              >
                <ThemedText
                  variant="caption"
                  color={isActive ? '#FFFFFF' : theme.colors.textSecondary}
                  style={{ fontWeight: '600' }}
                >
                  {t(`support.filter.${filter.key}`, filter.label)}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </AnimatedSection>

      {/* Request List */}
      {isLoading ? (
        <>
          <LoadingSkeleton width="100%" height={80} borderRadius={12} style={{ marginBottom: 10 }} />
          <LoadingSkeleton width="100%" height={80} borderRadius={12} style={{ marginBottom: 10 }} />
          <LoadingSkeleton width="100%" height={80} borderRadius={12} style={{ marginBottom: 10 }} />
        </>
      ) : filteredRequests.length === 0 ? (
        <EmptyState
          icon="chatbubbles-outline"
          title={t('support.noRequests', 'No Support Requests')}
          description={t(
            'support.noRequestsDescription',
            'You have no support requests matching this filter.',
          )}
        />
      ) : (
        filteredRequests.map((request: SupportRequest, index: number) => {
          const priorityColor = getPriorityColor(request.priority, theme.colors);
          const statusColor = getStatusColor(request.fK_StatusId, theme.colors);
          const statusLabel = getStatusLabel(request.fK_StatusId);

          return (
            <AnimatedSection key={request.supportRequestId} index={index + 2}>
              <ThemedCard
                variant="elevated"
                style={styles.requestCard}
                onPress={() => { }}
              >
                <View style={styles.requestHeader}>
                  <ThemedText
                    variant="bodySmall"
                    style={{ fontWeight: '600', flex: 1 }}
                    numberOfLines={1}
                  >
                    {request.title}
                  </ThemedText>
                  <ThemedText
                    variant="caption"
                    color={theme.colors.textTertiary}
                  >
                    {formatDate(request.createdOn ?? '')}
                  </ThemedText>
                </View>

                <View style={styles.badgeRow}>
                  {/* Type Badge */}
                  <View
                    style={[
                      styles.badge,
                      {
                        backgroundColor: theme.colors.primary,
                        borderRadius: theme.borderRadius.full,
                      },
                    ]}
                  >
                    <ThemedText
                      variant="caption"
                      color="#FFFFFF"
                      style={{ fontWeight: '600' }}
                    >
                      {request.supportRequestType}
                    </ThemedText>
                  </View>

                  {/* Priority Badge */}
                  <View
                    style={[
                      styles.badge,
                      {
                        backgroundColor: priorityColor,
                        borderRadius: theme.borderRadius.full,
                      },
                    ]}
                  >
                    <ThemedText
                      variant="caption"
                      color="#FFFFFF"
                      style={{ fontWeight: '600' }}
                    >
                      {request.priority}
                    </ThemedText>
                  </View>

                  {/* Status Badge */}
                  <View
                    style={[
                      styles.badge,
                      {
                        backgroundColor: statusColor,
                        borderRadius: theme.borderRadius.full,
                      },
                    ]}
                  >
                    <ThemedText
                      variant="caption"
                      color="#FFFFFF"
                      style={{ fontWeight: '600' }}
                    >
                      {statusLabel}
                    </ThemedText>
                  </View>
                </View>
              </ThemedCard>
            </AnimatedSection>
          );
        })
      )}

      <View style={{ height: 32 }} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  newRequestBtn: {
    marginTop: 8,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    marginBottom: 16,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  requestCard: {
    marginBottom: 10,
  },
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
});
