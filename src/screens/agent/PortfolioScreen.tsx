import React, { useMemo, useState } from 'react';
import { View, StyleSheet, RefreshControl, ScrollView } from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useTheme } from '../../theme';
import { useAnimatedEntry, staggerDelay, useAppSelector } from '../../hooks';
import {
  ScreenContainer,
  ThemedText,
  ThemedCard,
  ThemedInput,
  Avatar,
  LoadingSkeleton,
  EmptyState,
  SectionHeader,
} from '../../components';
import { useGetAgentParentsQuery } from '../../services/api/apiSlice';
import type { Parent } from '../../types';

const AnimatedSection: React.FC<{
  index: number;
  children: React.ReactNode;
}> = ({ index, children }) => {
  const animatedStyle = useAnimatedEntry({
    type: 'slideUp',
    delay: staggerDelay(index, 60),
  });
  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
};

/**
 * "Mon portefeuille" — the parents the director has assigned to the
 * calling agent. Distinct from the global parents listing the director
 * sees (which shows every parent in the school). The data source is
 * `GET /collectingagent/GetCollectingAgentParents?collectingAgentId=…`,
 * which only returns approved + pending assignments tied to this agent.
 *
 * The previous version of this screen called `/parents/GetParentsListing`
 * by mistake — that returned every parent on the platform regardless of
 * who they were assigned to. Fixed by switching to the agent-scoped hook.
 */
export default function PortfolioScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const user = useAppSelector((state) => state.auth.user);

  // The agent's CollectingAgentId is exposed in the JWT as `entityUserId`.
  const collectingAgentId = parseInt(user?.entityUserId || '0', 10);

  const [searchQuery, setSearchQuery] = useState('');
  const [page] = useState(1);

  const {
    data: parentsData,
    isLoading,
    isFetching,
    refetch,
  } = useGetAgentParentsQuery(
    {
      collectingAgentId,
      pageNumber: page,
      pageSize: 50,
      search: searchQuery.trim() || undefined,
    },
    { skip: !collectingAgentId },
  );

  const parents = parentsData?.data ?? [];
  const totalCount = parentsData?.totalCount ?? parents.length;

  // Local filter on top of the server-side `search` param so typing is
  // instant — the API call only re-fires when the value persists for a
  // moment (RTK Query debounces at the cache key level).
  const filtered = useMemo<Parent[]>(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return parents;
    return parents.filter((p) => {
      const haystack =
        `${p.firstName ?? ''} ${p.lastName ?? ''} ${p.phoneNumber ?? ''} ${p.email ?? ''} ${p.civilId ?? ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [parents, searchQuery]);

  return (
    <ScreenContainer scrollable={false}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={refetch}
            tintColor={theme.colors.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <ThemedText variant="h2">
            {t('agent.myPortfolio', 'Mon portefeuille')}
          </ThemedText>
          {parents.length > 0 ? (
            <ThemedText variant="caption" color={theme.colors.textSecondary}>
              {t('agent.portfolio.assignedCount', {
                count: totalCount,
                defaultValue_one: '{{count}} parent assigné',
                defaultValue_other: '{{count}} parents assignés',
              })}
            </ThemedText>
          ) : null}
        </View>

        {/* Search */}
        <AnimatedSection index={0}>
          <ThemedInput
            placeholder={t('common.searchParents', 'Search parents...')}
            value={searchQuery}
            onChangeText={setSearchQuery}
            leftIcon={
              <Ionicons
                name="search"
                size={20}
                color={theme.colors.textTertiary}
              />
            }
            containerStyle={styles.searchContainer}
          />
        </AnimatedSection>

        {/* Parent List */}
        {isLoading ? (
          <>
            <LoadingSkeleton width="100%" height={100} borderRadius={12} style={{ marginBottom: 10 }} />
            <LoadingSkeleton width="100%" height={100} borderRadius={12} style={{ marginBottom: 10 }} />
            <LoadingSkeleton width="100%" height={100} borderRadius={12} style={{ marginBottom: 10 }} />
            <LoadingSkeleton width="100%" height={100} borderRadius={12} style={{ marginBottom: 10 }} />
          </>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title={
              searchQuery
                ? t('agent.portfolio.searchEmptyTitle', 'Aucun résultat')
                : t('agent.portfolio.emptyTitle', 'Aucun parent assigné')
            }
            description={
              searchQuery
                ? t(
                  'agent.portfolio.searchEmptyDesc',
                  'Aucun parent ne correspond à votre recherche.',
                )
                : t(
                  'agent.portfolio.emptyDesc',
                  'Le directeur ne vous a pas encore assigné de parent. Une fois assignés, ils apparaîtront ici.',
                )
            }
          />
        ) : (
          filtered.map((parent, index) => (
            <AnimatedSection key={parent.parentId} index={index + 1}>
              <ThemedCard
                variant="elevated"
                style={styles.parentCard}
                onPress={() =>
                  router.push({
                    pathname: '/(app)/agent-parent-detail',
                    params: { parentId: String(parent.parentId) },
                  })
                }
              >
                <View style={styles.parentHeader}>
                  <Avatar
                    firstName={parent.firstName}
                    lastName={parent.lastName}
                    size="md"
                  />
                  <View style={styles.parentInfo}>
                    <View style={styles.parentNameRow}>
                      <ThemedText
                        variant="bodySmall"
                        style={{ fontWeight: '600', flex: 1 }}
                        numberOfLines={1}
                      >
                        {parent.firstName} {parent.lastName}
                      </ThemedText>
                    </View>
                    {parent.phoneNumber ? (
                      <ThemedText
                        variant="caption"
                        color={theme.colors.textSecondary}
                      >
                        {parent.phoneNumber}
                      </ThemedText>
                    ) : null}
                  </View>
                </View>

                {(parent.email || parent.civilId) ? (
                  <View style={styles.parentDetails}>
                    {parent.email ? (
                      <View style={styles.detailItem}>
                        <Ionicons
                          name="mail-outline"
                          size={14}
                          color={theme.colors.textTertiary}
                        />
                        <ThemedText
                          variant="caption"
                          color={theme.colors.textSecondary}
                          style={styles.detailText}
                          numberOfLines={1}
                        >
                          {parent.email}
                        </ThemedText>
                      </View>
                    ) : null}
                    {parent.civilId ? (
                      <View style={styles.detailItem}>
                        <Ionicons
                          name="id-card-outline"
                          size={14}
                          color={theme.colors.textTertiary}
                        />
                        <ThemedText
                          variant="caption"
                          color={theme.colors.textSecondary}
                          style={styles.detailText}
                          numberOfLines={1}
                        >
                          {parent.civilId}
                        </ThemedText>
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </ThemedCard>
            </AnimatedSection>
          ))
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: 16,
  },
  header: {
    marginTop: 4,
    marginBottom: 8,
  },
  searchContainer: {
    marginTop: 8,
    marginBottom: 14,
  },
  parentCard: {
    marginBottom: 12,
  },
  parentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  parentInfo: {
    flex: 1,
    marginLeft: 12,
    minWidth: 0,
  },
  parentNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  parentDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    minWidth: 0,
  },
  detailText: {
    marginLeft: 4,
    flexShrink: 1,
  },
});
