import React, { useMemo, useState } from 'react';
import { View, StyleSheet, Pressable, ScrollView, Alert, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';

import {
  ScreenContainer,
  ThemedText,
  ThemedCard,
  Avatar,
  ThemedButton,
  SectionHeader,
} from '../../components';
import { useTheme } from '../../theme';
import { useAppSelector } from '../../hooks';
import {
  useGetAgentParentsQuery,
  useLogMyActivityMutation,
} from '../../services/api/apiSlice';

type ActivityKey =
  | 'PaymentCollected'
  | 'PaymentAttempted'
  | 'ParentContact'
  | 'FieldVisit'
  | 'PhoneCall'
  | 'Other';

const TYPE_OPTIONS: {
  key: ActivityKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  requiresParent: boolean;
}[] = [
  { key: 'PhoneCall', label: 'Phone Call', icon: 'call-outline', requiresParent: true },
  { key: 'FieldVisit', label: 'Field Visit', icon: 'navigate-outline', requiresParent: true },
  { key: 'ParentContact', label: 'Parent Contact', icon: 'chatbubble-ellipses-outline', requiresParent: true },
  { key: 'PaymentAttempted', label: 'Payment Attempt', icon: 'alert-circle-outline', requiresParent: true },
  { key: 'PaymentCollected', label: 'Payment Collected', icon: 'cash-outline', requiresParent: true },
  { key: 'Other', label: 'Other', icon: 'ellipse-outline', requiresParent: false },
];

const LogActivityScreen: React.FC = () => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const user = useAppSelector((state) => state.auth.user);
  const agentId = parseInt(user?.entityUserId || '0');

  const [selectedType, setSelectedType] = useState<ActivityKey>('PhoneCall');
  const [selectedParentId, setSelectedParentId] = useState<number | null>(null);
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');

  const { data: parentsData, isLoading: parentsLoading } = useGetAgentParentsQuery(
    { collectingAgentId: agentId, pageNumber: 1, pageSize: 100 },
    { skip: !agentId },
  );

  const assignedParents = useMemo(() => parentsData?.data ?? [], [parentsData]);

  const [logMyActivity, { isLoading: submitting }] = useLogMyActivityMutation();

  const selectedTypeMeta = useMemo(
    () => TYPE_OPTIONS.find((o) => o.key === selectedType) ?? TYPE_OPTIONS[0],
    [selectedType],
  );

  const selectedParent = useMemo(
    () => assignedParents.find((p) => p.parentId === selectedParentId) || null,
    [assignedParents, selectedParentId],
  );

  const handleSubmit = async () => {
    const trimmedDescription = description.trim();

    if (!trimmedDescription) {
      Alert.alert(
        t('common.error', 'Error'),
        t('agent.logActivity.descriptionRequired', 'Please describe the activity'),
      );
      return;
    }

    if (selectedTypeMeta.requiresParent && !selectedParentId) {
      Alert.alert(
        t('common.error', 'Error'),
        t('agent.logActivity.parentRequired', 'Please pick which parent this activity is for'),
      );
      return;
    }

    try {
      const result = await logMyActivity({
        parentId: selectedParentId ?? undefined,
        activityType: selectedType,
        activityDescription: trimmedDescription,
        notes: notes.trim() || undefined,
      }).unwrap();

      if (result.status === 'Success') {
        Alert.alert(
          t('common.success', 'Success'),
          result.message ||
            t('agent.logActivity.saved', 'Activity saved'),
          [{ text: t('common.ok', 'OK'), onPress: () => router.back() }],
        );
      } else {
        Alert.alert(
          t('common.error', 'Error'),
          result.error || t('common.genericError', 'Something went wrong'),
        );
      }
    } catch (err: any) {
      const msg = err?.data?.error || err?.message || t('common.genericError', 'Something went wrong');
      Alert.alert(t('common.error', 'Error'), msg);
    }
  };

  return (
    <ScreenContainer>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </Pressable>
        <ThemedText variant="h1" style={styles.headerTitle}>
          {t('agent.logActivity.title', 'Log Activity')}
        </ThemedText>
      </View>

      <SectionHeader title={t('agent.logActivity.typeSection', 'Activity Type')} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeRow}>
        {TYPE_OPTIONS.map((opt) => {
          const selected = selectedType === opt.key;
          return (
            <Pressable
              key={opt.key}
              onPress={() => setSelectedType(opt.key)}
              style={[
                styles.typeChip,
                {
                  borderRadius: theme.borderRadius.md,
                  borderColor: selected ? theme.colors.primary : theme.colors.border,
                  backgroundColor: selected ? theme.colors.primary + '15' : theme.colors.surface,
                },
              ]}
            >
              <Ionicons
                name={opt.icon}
                size={18}
                color={selected ? theme.colors.primary : theme.colors.textSecondary}
              />
              <ThemedText
                variant="caption"
                color={selected ? theme.colors.primary : theme.colors.text}
                style={styles.typeLabel}
              >
                {t(`agent.activities.types.${opt.key}`, opt.label)}
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>

      {selectedTypeMeta.requiresParent ? (
        <>
          <SectionHeader
            title={t('agent.logActivity.parentSection', 'Parent')}
            style={styles.sectionSpacing}
          />
          {parentsLoading ? (
            <ThemedText variant="caption" color={theme.colors.textSecondary}>
              {t('common.loading', 'Loading…')}
            </ThemedText>
          ) : assignedParents.length === 0 ? (
            <ThemedCard variant="outlined" style={styles.emptyParents}>
              <ThemedText variant="bodySmall" color={theme.colors.textSecondary}>
                {t(
                  'agent.logActivity.noParents',
                  'You have no assigned parents yet. Ask your director to assign you before logging activities tied to a parent.',
                )}
              </ThemedText>
            </ThemedCard>
          ) : (
            <View style={styles.parentList}>
              {assignedParents.map((p) => {
                const selected = selectedParentId === p.parentId;
                return (
                  <Pressable key={p.parentId} onPress={() => setSelectedParentId(p.parentId)}>
                    <ThemedCard
                      variant={selected ? 'elevated' : 'outlined'}
                      style={{
                        ...styles.parentCard,
                        ...(selected
                          ? { borderColor: theme.colors.primary, borderWidth: 2 }
                          : {}),
                      }}
                    >
                      <View style={styles.parentRow}>
                        <Avatar firstName={p.firstName} lastName={p.lastName} size="sm" />
                        <View style={styles.parentInfo}>
                          <ThemedText variant="bodySmall" style={{ fontWeight: '600' }}>
                            {p.firstName} {p.lastName}
                          </ThemedText>
                          {p.phoneNumber ? (
                            <ThemedText variant="caption" color={theme.colors.textSecondary}>
                              {p.countryCode} {p.phoneNumber}
                            </ThemedText>
                          ) : null}
                        </View>
                        <Ionicons
                          name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                          size={22}
                          color={selected ? theme.colors.primary : theme.colors.textTertiary}
                        />
                      </View>
                    </ThemedCard>
                  </Pressable>
                );
              })}
            </View>
          )}
        </>
      ) : null}

      <SectionHeader
        title={t('agent.logActivity.descriptionSection', 'Description')}
        style={styles.sectionSpacing}
      />
      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder={t(
          'agent.logActivity.descriptionPlaceholder',
          'What happened? (required)',
        )}
        placeholderTextColor={theme.colors.textTertiary}
        multiline
        style={[
          styles.input,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            color: theme.colors.text,
            borderRadius: theme.borderRadius.md,
          },
        ]}
      />

      <SectionHeader
        title={t('agent.logActivity.notesSection', 'Notes (optional)')}
        style={styles.sectionSpacing}
      />
      <TextInput
        value={notes}
        onChangeText={setNotes}
        placeholder={t(
          'agent.logActivity.notesPlaceholder',
          'Any extra context for your records',
        )}
        placeholderTextColor={theme.colors.textTertiary}
        multiline
        style={[
          styles.input,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            color: theme.colors.text,
            borderRadius: theme.borderRadius.md,
          },
        ]}
      />

      <ThemedButton
        title={t('agent.logActivity.submit', 'Save Activity')}
        variant="primary"
        onPress={handleSubmit}
        loading={submitting}
        disabled={selectedTypeMeta.requiresParent && assignedParents.length === 0}
        style={styles.submitBtn}
      />

      {selectedParent ? (
        <ThemedText variant="caption" color={theme.colors.textTertiary} style={styles.footerHint}>
          {t('agent.logActivity.forParent', 'For')} {selectedParent.firstName} {selectedParent.lastName}
        </ThemedText>
      ) : null}
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
    gap: 8,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 8,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    gap: 6,
  },
  typeLabel: {
    fontWeight: '600',
  },
  sectionSpacing: {
    marginTop: 16,
  },
  parentList: {
    gap: 8,
  },
  parentCard: {
    marginBottom: 0,
  },
  parentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  parentInfo: {
    flex: 1,
  },
  emptyParents: {
    paddingVertical: 16,
  },
  input: {
    minHeight: 70,
    borderWidth: 1,
    padding: 10,
    textAlignVertical: 'top',
    marginTop: 8,
  },
  submitBtn: {
    marginTop: 20,
  },
  footerHint: {
    marginTop: 8,
    textAlign: 'center',
  },
});

export default LogActivityScreen;
