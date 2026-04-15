import React, { useMemo, useState } from 'react';
import { View, StyleSheet, Pressable, Alert } from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useTheme } from '../../theme';
import { useAnimatedEntry, staggerDelay, useAppSelector } from '../../hooks';
import {
  ScreenContainer,
  ThemedText,
  ThemedButton,
  ThemedInput,
  SectionHeader,
} from '../../components';
import { useAddSupportRequestMutation, useGetSchoolDirectorQuery } from '../../services/api/apiSlice';
import {
  SUPPORT_PRIORITIES,
  SUPPORT_REQUEST_DIRECTIONS,
  SUPPORT_REQUEST_STATUSES,
} from '../../constants';

type RequestType = 'General' | 'Payment' | 'Help';
type Priority = keyof typeof SUPPORT_PRIORITIES;

const REQUEST_TYPES: { key: RequestType; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'General', icon: 'chatbubble-outline' },
  { key: 'Payment', icon: 'card-outline' },
  { key: 'Help', icon: 'help-circle-outline' },
];

const PRIORITIES: { key: Priority; color: (colors: any) => string }[] = [
  { key: 'Low', color: (c) => c.info },
  { key: 'Medium', color: (c) => c.warning },
  { key: 'High', color: (c) => c.accent },
  { key: 'Urgent', color: (c) => c.error },
];

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

export default function SupportRequestFormScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const [addSupportRequest, { isLoading: isSubmitting }] = useAddSupportRequestMutation();
  const user = useAppSelector((state) => state.auth.user);
  const role = user?.role;
  const schoolId = user?.schoolId ? parseInt(user.schoolId.split(',')[0], 10) : 0;
  const entityId = user?.entityUserId ? parseInt(user.entityUserId, 10) : 0;
  const isParent = role === 'parent';
  const isAgent = role === 'agent';
  const isSupportedRole = isParent || isAgent;

  const {
    data: directorData,
  } = useGetSchoolDirectorQuery(
    { schoolId },
    { skip: !isAgent || !schoolId },
  );

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedType, setSelectedType] = useState<RequestType | null>(null);
  const [selectedPriority, setSelectedPriority] = useState<Priority | null>('Medium');

  const requestDirection = useMemo(() => {
    if (isAgent) {
      return SUPPORT_REQUEST_DIRECTIONS.AgentToDirector;
    }

    return SUPPORT_REQUEST_DIRECTIONS.ParentToDirector;
  }, [isAgent]);

  const canSubmit =
    isSupportedRole &&
    !!title.trim() &&
    !!description.trim() &&
    !!selectedType &&
    !!selectedPriority &&
    !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) {
      return;
    }

    if (!schoolId || !entityId) {
      Alert.alert(
        t('common.error', 'Error'),
        t('support.missingIdentity', 'Your account is missing the required support request details.'),
      );
      return;
    }

    if (isAgent && !directorData?.data?.directorId) {
      Alert.alert(
        t('common.error', 'Error'),
        t('support.missingDirector', 'No director is configured for this school yet.'),
      );
      return;
    }

    try {
      await addSupportRequest({
        requestDirection,
        supportRequestModel: {
          title: title.trim(),
          description: description.trim(),
          supportRequestType: selectedType!,
          statusId: SUPPORT_REQUEST_STATUSES.Pending,
          schoolId,
          parentId: isParent ? entityId : undefined,
          collectingAgentId: isAgent ? entityId : undefined,
          directorId: isAgent ? directorData?.data?.directorId : undefined,
          priority: selectedPriority!,
        },
      }).unwrap();

      Alert.alert(
        t('common.success', 'Success'),
        t('support.requestSubmitted', 'Your support request has been submitted.'),
        [{ text: t('common.ok', 'OK'), onPress: () => router.back() }],
      );
    } catch (error: any) {
      Alert.alert(
        t('common.error', 'Error'),
        error?.data?.message ||
          error?.data?.error ||
          t('support.submitError', 'Failed to submit support request.'),
      );
    }
  };

  if (!isSupportedRole) {
    return (
      <ScreenContainer>
        <ThemedText variant="h2" style={styles.unsupportedTitle}>
          {t('support.newRequest', 'New Request')}
        </ThemedText>
        <ThemedText variant="body" color={theme.colors.textSecondary}>
          {t('support.unsupportedRole', 'Support request creation is currently available for parent and agent accounts.')}
        </ThemedText>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <AnimatedSection index={0}>
        <ThemedInput
          label={t('support.title', 'Title')}
          value={title}
          onChangeText={setTitle}
          placeholder={t('support.titlePlaceholder', 'Briefly describe your issue')}
          containerStyle={styles.topInput}
        />
      </AnimatedSection>

      <AnimatedSection index={1}>
        <SectionHeader title={t('support.type', 'Type')} style={styles.sectionLabel} />
        <View style={styles.chipRow}>
          {REQUEST_TYPES.map((type) => {
            const isSelected = selectedType === type.key;
            return (
              <Pressable
                key={type.key}
                onPress={() => setSelectedType(type.key)}
                style={[
                  styles.typeChip,
                  {
                    backgroundColor: isSelected
                      ? theme.colors.primary
                      : theme.colors.inputBackground,
                    borderRadius: theme.borderRadius.lg,
                    borderWidth: isSelected ? 0 : 1,
                    borderColor: theme.colors.borderLight,
                  },
                ]}
              >
                <Ionicons
                  name={type.icon}
                  size={18}
                  color={isSelected ? '#FFFFFF' : theme.colors.textSecondary}
                />
                <ThemedText
                  variant="bodySmall"
                  color={isSelected ? '#FFFFFF' : theme.colors.textSecondary}
                  style={{ fontWeight: '600', marginLeft: 6 }}
                >
                  {t(`support.type.${type.key.toLowerCase()}`, type.key)}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </AnimatedSection>

      <AnimatedSection index={2}>
        <SectionHeader title={t('support.priority', 'Priority')} style={styles.sectionLabel} />
        <View style={styles.chipRow}>
          {PRIORITIES.map((priority) => {
            const isSelected = selectedPriority === priority.key;
            const color = priority.color(theme.colors);
            return (
              <Pressable
                key={priority.key}
                onPress={() => setSelectedPriority(priority.key)}
                style={[
                  styles.priorityChip,
                  {
                    backgroundColor: isSelected ? color : color + '12',
                    borderRadius: theme.borderRadius.full,
                    borderWidth: isSelected ? 0 : 1,
                    borderColor: color + '30',
                  },
                ]}
              >
                <ThemedText
                  variant="caption"
                  color={isSelected ? '#FFFFFF' : color}
                  style={{ fontWeight: '700' }}
                >
                  {t(`support.priority.${priority.key.toLowerCase()}`, priority.key)}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </AnimatedSection>

      <AnimatedSection index={3}>
        <ThemedInput
          label={t('support.description', 'Description')}
          value={description}
          onChangeText={setDescription}
          placeholder={t(
            'support.descriptionPlaceholder',
            'Provide details about your issue...',
          )}
          multiline
          numberOfLines={5}
          containerStyle={styles.descriptionInput}
        />
      </AnimatedSection>

      <AnimatedSection index={4}>
        <ThemedButton
          title={isSubmitting ? t('common.loading', 'Submitting...') : t('support.submitRequest', 'Submit Request')}
          onPress={handleSubmit}
          variant="primary"
          size="lg"
          fullWidth
          disabled={!canSubmit}
          icon={<Ionicons name="send" size={18} color="#FFFFFF" />}
          style={styles.submitButton}
        />
      </AnimatedSection>

      <View style={{ height: 32 }} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  unsupportedTitle: {
    marginTop: 8,
    marginBottom: 12,
  },
  topInput: {
    marginTop: 8,
  },
  sectionLabel: {
    marginTop: 8,
    marginBottom: 0,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 4,
    marginBottom: 8,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flex: 1,
    justifyContent: 'center',
  },
  priorityChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  descriptionInput: {
    marginTop: 8,
  },
  submitButton: {
    marginTop: 16,
  },
});
