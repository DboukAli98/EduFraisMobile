import React, { useState } from 'react';
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
  ThemedInput,
  Avatar,
  LoadingSkeleton,
} from '../../components';
import { useGetParentsQuery } from '../../services/api/apiSlice';

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

export default function PortfolioScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [page] = useState(1);

  const { data: parentsData, isLoading } = useGetParentsQuery({
    pageNumber: page,
    pageSize: 20,
    search: searchQuery || undefined,
  });

  const parents = parentsData?.data ?? [];

  return (
    <ScreenContainer>
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
      ) : (
        parents.map((parent, index) => (
          <AnimatedSection key={parent.parentId} index={index + 1}>
            <ThemedCard variant="elevated" style={styles.parentCard}>
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
                    >
                      {parent.firstName} {parent.lastName}
                    </ThemedText>
                  </View>
                  <ThemedText
                    variant="caption"
                    color={theme.colors.textSecondary}
                  >
                    {parent.phoneNumber}
                  </ThemedText>
                </View>
              </View>

              <View style={styles.parentDetails}>
                <View style={styles.detailItem}>
                  <Ionicons
                    name="mail-outline"
                    size={14}
                    color={theme.colors.textTertiary}
                  />
                  <ThemedText
                    variant="caption"
                    color={theme.colors.textSecondary}
                    style={{ marginLeft: 4 }}
                  >
                    {parent.email}
                  </ThemedText>
                </View>
                <View style={styles.detailItem}>
                  <Ionicons
                    name="id-card-outline"
                    size={14}
                    color={theme.colors.textTertiary}
                  />
                  <ThemedText
                    variant="caption"
                    color={theme.colors.textSecondary}
                    style={{ marginLeft: 4 }}
                  >
                    {parent.civilId}
                  </ThemedText>
                </View>
              </View>
            </ThemedCard>
          </AnimatedSection>
        ))
      )}

      <View style={{ height: 32 }} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  searchContainer: {
    marginTop: 8,
    marginBottom: 4,
  },
  parentCard: {
    marginBottom: 10,
  },
  parentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  parentInfo: {
    flex: 1,
    marginLeft: 12,
  },
  parentNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  parentDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
