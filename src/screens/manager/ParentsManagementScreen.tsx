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
  ThemedButton,
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

export default function ParentsManagementScreen() {
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
  const totalCount = parentsData?.totalCount ?? 0;

  return (
    <ScreenContainer>
      {/* Stats Row */}
      <AnimatedSection index={0}>
        <View style={styles.statsRow}>
          <View
            style={[
              styles.statChip,
              { backgroundColor: theme.colors.primaryLight + '15' },
            ]}
          >
            <Ionicons
              name="people"
              size={16}
              color={theme.colors.primary}
            />
            <ThemedText
              variant="bodySmall"
              style={{ fontWeight: '600', marginLeft: 6 }}
            >
              {totalCount} {t('manager.parents', 'Parents')}
            </ThemedText>
          </View>
        </View>
      </AnimatedSection>

      {/* Search */}
      <AnimatedSection index={1}>
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
          containerStyle={styles.searchInput}
        />
      </AnimatedSection>

      {/* Parent List */}
      {isLoading ? (
        <>
          <LoadingSkeleton width="100%" height={72} borderRadius={12} style={{ marginBottom: 8 }} />
          <LoadingSkeleton width="100%" height={72} borderRadius={12} style={{ marginBottom: 8 }} />
          <LoadingSkeleton width="100%" height={72} borderRadius={12} style={{ marginBottom: 8 }} />
          <LoadingSkeleton width="100%" height={72} borderRadius={12} style={{ marginBottom: 8 }} />
        </>
      ) : (
        parents.map((parent, index) => (
          <AnimatedSection key={parent.parentId} index={index + 2}>
            <ThemedCard
              variant="elevated"
              style={styles.parentCard}
              onPress={() => {}}
            >
              <View style={styles.parentRow}>
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
                  <ThemedText
                    variant="caption"
                    color={theme.colors.textTertiary}
                    style={{ marginTop: 4 }}
                  >
                    {parent.email}
                  </ThemedText>
                </View>
              </View>
            </ThemedCard>
          </AnimatedSection>
        ))
      )}

      {/* Add Parent Button */}
      <AnimatedSection index={parents.length + 2}>
        <ThemedButton
          title={t('manager.addParent', 'Add Parent')}
          onPress={() => {}}
          variant="primary"
          size="lg"
          fullWidth
          icon={<Ionicons name="person-add" size={20} color="#FFFFFF" />}
          style={styles.addButton}
        />
      </AnimatedSection>

      <View style={{ height: 32 }} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    marginBottom: 16,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  searchInput: {
    marginBottom: 8,
  },
  parentCard: {
    marginBottom: 8,
  },
  parentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  parentInfo: {
    flex: 1,
    marginLeft: 12,
  },
  parentNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  addButton: {
    marginTop: 16,
  },
});
