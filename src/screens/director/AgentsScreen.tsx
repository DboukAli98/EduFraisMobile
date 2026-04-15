import React, { useMemo } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';

import {
  ScreenContainer,
  ThemedText,
  ThemedCard,
  ThemedButton,
  Avatar,
  ScreenSkeleton,
} from '../../components';
import { useTheme } from '../../theme';
import { useAnimatedEntry, staggerDelay, useResponsive, useAppSelector } from '../../hooks';
import { useGetAllAgentsQuery } from '../../services/api/apiSlice';
import type { CollectingAgent } from '../../types';

// ---------------------------------------------------------------------------
// SummaryCard
// ---------------------------------------------------------------------------

interface SummaryItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  color: string;
  index: number;
}

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
        <ThemedText variant="numeric" style={styles.summaryValue}>{value}</ThemedText>
        <ThemedText variant="caption" color={theme.colors.textSecondary}>{label}</ThemedText>
      </ThemedCard>
    </Animated.View>
  );
};

// ---------------------------------------------------------------------------
// AgentsScreen
// ---------------------------------------------------------------------------

const AgentsScreen: React.FC = () => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { isSmallDevice } = useResponsive();

  const user = useAppSelector((state) => state.auth.user);
  const schoolId = parseInt(user?.schoolId || '0');

  const { data: agentsRes, isLoading } = useGetAllAgentsQuery({ schoolId, pageNumber: 1, pageSize: 100 }, { skip: !schoolId });
  const agents = agentsRes?.data || [];

  const summary = useMemo(() => {
    const totalAgents = agents.length;
    const avgCommission = totalAgents > 0
      ? (agents.reduce((sum, a) => sum + (a.commissionPercentage || 0), 0) / totalAgents).toFixed(1)
      : '0';
    return { totalAgents, avgCommission: `${avgCommission}%` };
  }, [agents]);

  const headerAnim = useAnimatedEntry({ type: 'slideUp', delay: staggerDelay(0) });
  const listAnim = useAnimatedEntry({ type: 'slideUp', delay: staggerDelay(4) });

  const renderAgent = ({ item }: { item: CollectingAgent }) => (
    <ThemedCard variant="elevated" onPress={() => { }} style={styles.agentCard}>
      <View style={styles.agentRow}>
        <Avatar firstName={item.firstName} lastName={item.lastName} size="lg" />
        <View style={styles.agentInfo}>
          <ThemedText variant="subtitle">
            {item.firstName} {item.lastName}
          </ThemedText>
          <ThemedText variant="caption" color={theme.colors.textSecondary}>
            {item.phoneNumber}
          </ThemedText>
          <View style={styles.agentMeta}>
            {/* Commission badge */}
            <View
              style={[
                styles.commBadge,
                { backgroundColor: theme.colors.secondary, borderRadius: theme.borderRadius.full },
              ]}
            >
              <ThemedText variant="caption" color="#FFFFFF" style={styles.commTxt}>
                {item.commissionPercentage}%
              </ThemedText>
            </View>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={theme.colors.textTertiary} />
      </View>
    </ThemedCard>
  );

  if (isLoading) {
    return (
      <ScreenContainer scrollable={false}>
        <ScreenSkeleton />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scrollable={false}>
      {/* Header */}
      <Animated.View style={[styles.headerRow, headerAnim]}>
        <ThemedText variant="h1">{t('director.agents.title', 'Agents')}</ThemedText>
      </Animated.View>

      {/* Summary cards */}
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

      {/* Agent list */}
      <Animated.View style={[styles.listWrap, listAnim]}>
        <FlatList
          data={agents}
          keyExtractor={(item) => String(item.collectingAgentId)}
          renderItem={renderAgent}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      </Animated.View>

      {/* Add Agent button */}
      <View style={styles.fabContainer}>
        <ThemedButton
          title={t('director.agents.addAgent', 'Add Agent')}
          onPress={() => { }}
          variant="primary"
          size="lg"
          fullWidth
          icon={<Ionicons name="person-add-outline" size={20} color="#FFFFFF" />}
        />
      </View>
    </ScreenContainer>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

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
  summaryItem: { flex: 1, paddingHorizontal: 4 },
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
  summaryValue: { marginBottom: 2 },

  listWrap: { flex: 1 },
  list: { paddingHorizontal: 16, paddingBottom: 100 },

  agentCard: { marginBottom: 10 },
  agentRow: { flexDirection: 'row', alignItems: 'center' },
  agentInfo: { flex: 1, marginLeft: 14 },
  agentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 12,
  },
  commBadge: { paddingHorizontal: 10, paddingVertical: 2 },
  commTxt: { fontWeight: '700' },

  fabContainer: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
  },
});

export default AgentsScreen;
