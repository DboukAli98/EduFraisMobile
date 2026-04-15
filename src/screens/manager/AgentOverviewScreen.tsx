import React from 'react';
import { View, StyleSheet } from 'react-native';
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
  Avatar,
  SectionHeader,
  LoadingSkeleton,
} from '../../components';
import { useGetAllAgentsQuery } from '../../services/api/apiSlice';
import { useAppSelector } from '../../store/store';

const AnimatedSection: React.FC<{
  index: number;
  children: React.ReactNode;
}> = ({ index, children }) => {
  const animatedStyle = useAnimatedEntry({
    type: 'slideUp',
    delay: staggerDelay(index, 80),
  });
  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
};

export default function AgentOverviewScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const user = useAppSelector((state) => state.auth.user);
  const schoolId = parseInt(user?.schoolId || '0');

  const { data: agentsData, isLoading } = useGetAllAgentsQuery({ schoolId, pageNumber: 1, pageSize: 100 }, { skip: !schoolId });
  const agents = agentsData?.data ?? [];

  return (
    <ScreenContainer>
      <AnimatedSection index={0}>
        <SectionHeader
          title={t('manager.agentPerformance', 'Agent Performance')}
          style={styles.headerSpacing}
        />
      </AnimatedSection>

      {isLoading ? (
        <>
          <LoadingSkeleton width="100%" height={140} borderRadius={16} style={{ marginBottom: 12 }} />
          <LoadingSkeleton width="100%" height={140} borderRadius={16} style={{ marginBottom: 12 }} />
          <LoadingSkeleton width="100%" height={140} borderRadius={16} style={{ marginBottom: 12 }} />
        </>
      ) : (
        agents.map((agent, index) => (
          <AnimatedSection key={agent.collectingAgentId} index={index + 1}>
            <ThemedCard
              variant="elevated"
              style={styles.agentCard}
            >
              {/* Agent Header */}
              <View style={styles.agentHeader}>
                <Avatar
                  firstName={agent.firstName}
                  lastName={agent.lastName}
                  size="lg"
                />
                <View style={styles.agentHeaderInfo}>
                  <ThemedText variant="subtitle">
                    {agent.firstName} {agent.lastName}
                  </ThemedText>
                  <View style={styles.commissionBadge}>
                    <Ionicons
                      name="trending-up"
                      size={12}
                      color={theme.colors.primary}
                    />
                    <ThemedText
                      variant="caption"
                      color={theme.colors.primary}
                      style={{ fontWeight: '600', marginLeft: 4 }}
                    >
                      {agent.commissionPercentage}%{' '}
                      {t('agent.commission', 'commission')}
                    </ThemedText>
                  </View>
                </View>
              </View>

              {/* Stats Row */}
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Ionicons
                    name="call-outline"
                    size={14}
                    color={theme.colors.textTertiary}
                  />
                  <ThemedText
                    variant="caption"
                    color={theme.colors.textSecondary}
                    style={{ marginLeft: 4 }}
                  >
                    {agent.phoneNumber}
                  </ThemedText>
                </View>
                <View style={styles.statItem}>
                  <Ionicons
                    name="school-outline"
                    size={14}
                    color={theme.colors.textTertiary}
                  />
                  <ThemedText
                    variant="caption"
                    color={theme.colors.textSecondary}
                    style={{ marginLeft: 4 }}
                  >
                    {t('manager.schoolId', 'School')}: {agent.fK_SchoolId}
                  </ThemedText>
                </View>
              </View>
            </ThemedCard>
          </AnimatedSection>
        ))
      )}

      {/* Assign Agent Button */}
      <AnimatedSection index={agents.length + 1}>
        <ThemedButton
          title={t('manager.manageParents', 'Manage Parents')}
          onPress={() => router.push('/(app)/parents')}
          variant="primary"
          size="lg"
          fullWidth
          icon={<Ionicons name="people" size={20} color="#FFFFFF" />}
          style={styles.assignButton}
        />
      </AnimatedSection>

      <View style={{ height: 32 }} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerSpacing: {
    marginTop: 8,
  },
  agentCard: {
    marginBottom: 12,
  },
  agentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  agentHeaderInfo: {
    flex: 1,
    marginLeft: 12,
  },
  commissionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  assignButton: {
    marginTop: 16,
  },
});
