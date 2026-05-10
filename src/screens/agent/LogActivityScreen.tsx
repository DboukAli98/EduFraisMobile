import React, { useMemo, useState } from 'react';
import { View, StyleSheet, Pressable, ScrollView, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';

import {
  ScreenContainer,
  ThemedText,
  ThemedCard,
  Avatar,
  ThemedButton,
  useAlert,
  BackButton,
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

type LogActivitySectionKey = 'type' | 'parent' | 'details' | 'review';

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

const AccordionSection: React.FC<{
  id: LogActivitySectionKey;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  isOpen: boolean;
  isComplete?: boolean;
  onPress: (id: LogActivitySectionKey) => void;
  children: React.ReactNode;
}> = ({ id, title, description, icon, isOpen, isComplete = false, onPress, children }) => {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.accordionCard,
        {
          backgroundColor: theme.colors.surface,
          borderColor: isOpen ? theme.colors.primary : theme.colors.borderLight,
          borderRadius: theme.borderRadius.xl,
        },
      ]}
    >
      <Pressable
        onPress={() => onPress(id)}
        style={styles.accordionHeader}
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
      >
        <View style={[styles.accordionIcon, { backgroundColor: theme.colors.primary + '14' }]}>
          <Ionicons name={icon} size={20} color={theme.colors.primary} />
        </View>
        <View style={styles.accordionHeaderText}>
          <View style={styles.accordionTitleRow}>
            <ThemedText variant="body" style={styles.accordionTitle} numberOfLines={1}>
              {title}
            </ThemedText>
            {isComplete ? <Ionicons name="checkmark-circle" size={18} color={theme.colors.success} /> : null}
          </View>
          <ThemedText variant="caption" color={theme.colors.textSecondary} numberOfLines={1}>
            {description}
          </ThemedText>
        </View>
        <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={20} color={theme.colors.textSecondary} />
      </Pressable>
      {isOpen ? <View style={styles.accordionBody}>{children}</View> : null}
    </View>
  );
};

const LogActivityScreen: React.FC = () => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { showAlert } = useAlert();

  const user = useAppSelector((state) => state.auth.user);
  const agentId = parseInt(user?.entityUserId || '0');

  const [selectedType, setSelectedType] = useState<ActivityKey>('PhoneCall');
  const [selectedParentId, setSelectedParentId] = useState<number | null>(null);
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [activeSection, setActiveSection] = useState<LogActivitySectionKey>('type');

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

  const selectedTypeLabel = t(`agent.activities.types.${selectedTypeMeta.key}`, selectedTypeMeta.label);
  const parentComplete = !selectedTypeMeta.requiresParent || !!selectedParentId;
  const detailsComplete = Boolean(description.trim());
  const activityComplete = parentComplete && detailsComplete;

  const handleToggleSection = (section: LogActivitySectionKey) => {
    setActiveSection((current) => (current === section ? current : section));
  };

  const handleSelectType = (type: ActivityKey) => {
    const meta = TYPE_OPTIONS.find((o) => o.key === type) ?? TYPE_OPTIONS[0];
    setSelectedType(type);
    setActiveSection(meta.requiresParent ? 'parent' : 'details');
  };

  const handleSelectParent = (parentId: number) => {
    setSelectedParentId(parentId);
    setActiveSection('details');
  };

  const handleSubmit = async () => {
    const trimmedDescription = description.trim();

    if (!trimmedDescription) {
      setActiveSection('details');
      showAlert({
        type: 'warning',
        title: t('common.error', 'Error'),
        message: t('agent.logActivity.descriptionRequired', 'Please describe the activity'),
      });
      return;
    }

    if (selectedTypeMeta.requiresParent && !selectedParentId) {
      setActiveSection('parent');
      showAlert({
        type: 'warning',
        title: t('common.error', 'Error'),
        message: t('agent.logActivity.parentRequired', 'Please pick which parent this activity is for'),
      });
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
        showAlert({
          type: 'success',
          title: t('common.success', 'Success'),
          message: result.message || t('agent.logActivity.saved', 'Activity saved'),
          buttons: [{ text: t('common.ok', 'OK'), onPress: () => router.back() }],
        });
      } else {
        showAlert({
          type: 'error',
          title: t('common.error', 'Error'),
          message: result.error || t('common.genericError', 'Something went wrong'),
        });
      }
    } catch (err: any) {
      const msg = err?.data?.error || err?.message || t('common.genericError', 'Something went wrong');
      showAlert({
        type: 'error',
        title: t('common.error', 'Error'),
        message: msg,
      });
    }
  };

  return (
    <ScreenContainer>
      <View style={styles.headerRow}>
        <BackButton label={t('common.back', 'Retour')} showLabel={false} style={styles.backBtn} />
        <ThemedText variant="h1" style={styles.headerTitle}>
          {t('agent.logActivity.title', 'Log Activity')}
        </ThemedText>
      </View>

      <AccordionSection
        id="type"
        title={t('agent.logActivity.typeSection', 'Activity Type')}
        description={selectedTypeLabel}
        icon="options-outline"
        isOpen={activeSection === 'type'}
        isComplete
        onPress={handleToggleSection}
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeRow}>
          {TYPE_OPTIONS.map((opt) => {
            const selected = selectedType === opt.key;
            return (
              <Pressable
                key={opt.key}
                onPress={() => handleSelectType(opt.key)}
                style={[
                  styles.typeChip,
                  {
                    borderRadius: theme.borderRadius.md,
                    borderColor: selected ? theme.colors.primary : theme.colors.border,
                    backgroundColor: selected ? theme.colors.primary + '15' : theme.colors.surface,
                  },
                ]}
              >
                <Ionicons name={opt.icon} size={18} color={selected ? theme.colors.primary : theme.colors.textSecondary} />
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
      </AccordionSection>

      <AccordionSection
        id="parent"
        title={t('agent.logActivity.parentSection', 'Parent')}
        description={selectedParent ? `${selectedParent.firstName} ${selectedParent.lastName}` : selectedTypeMeta.requiresParent ? t('agent.logActivity.pickParentStep', 'Choose the parent') : t('agent.logActivity.parentOptionalStep', 'Parent is optional for this type')}
        icon="person-outline"
        isOpen={activeSection === 'parent'}
        isComplete={parentComplete}
        onPress={handleToggleSection}
      >
        {parentsLoading ? (
          <ThemedText variant="caption" color={theme.colors.textSecondary}>
            {t('common.loading', 'Loading…')}
          </ThemedText>
        ) : assignedParents.length === 0 ? (
          <ThemedCard variant="outlined" style={styles.emptyParents}>
            <ThemedText variant="bodySmall" color={theme.colors.textSecondary}>
              {selectedTypeMeta.requiresParent
                ? t(
                  'agent.logActivity.noParents',
                  'You have no assigned parents yet. Ask your director to assign you before logging activities tied to a parent.',
                )
                : t(
                  'agent.logActivity.noParentsOptional',
                  'You have no assigned parents yet. You can still save this activity without linking it to a parent.',
                )}
            </ThemedText>
          </ThemedCard>
        ) : (
          <View style={styles.parentList}>
            {assignedParents.map((p) => {
              const selected = selectedParentId === p.parentId;
              return (
                <Pressable key={p.parentId} onPress={() => handleSelectParent(p.parentId)}>
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
      </AccordionSection>

      <AccordionSection
        id="details"
        title={t('agent.logActivity.descriptionSection', 'Description')}
        description={detailsComplete ? description.trim() : t('agent.logActivity.detailsStep', 'Describe the activity')}
        icon="document-text-outline"
        isOpen={activeSection === 'details'}
        isComplete={detailsComplete}
        onPress={handleToggleSection}
      >
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder={t('agent.logActivity.descriptionPlaceholder', 'What happened? (required)')}
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

        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder={t('agent.logActivity.notesPlaceholder', 'Any extra context for your records')}
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
          title={t('agent.logActivity.reviewActivity', 'Review Activity')}
          variant="secondary"
          onPress={() => setActiveSection('review')}
          disabled={!detailsComplete}
        />
      </AccordionSection>

      <AccordionSection
        id="review"
        title={t('agent.logActivity.reviewActivity', 'Review Activity')}
        description={activityComplete ? t('agent.logActivity.readyToSave', 'Ready to save') : t('agent.logActivity.reviewStep', 'Check required fields')}
        icon="checkmark-done-outline"
        isOpen={activeSection === 'review'}
        isComplete={activityComplete}
        onPress={handleToggleSection}
      >
        <View style={[styles.reviewBox, { backgroundColor: theme.colors.inputBackground, borderRadius: theme.borderRadius.lg }]}>
          <ThemedText variant="caption" color={theme.colors.textSecondary}>{t('agent.logActivity.typeSection', 'Activity Type')}</ThemedText>
          <ThemedText variant="bodySmall" style={styles.reviewValue}>{selectedTypeLabel}</ThemedText>
          <ThemedText variant="caption" color={theme.colors.textSecondary} style={styles.reviewLabel}>{t('agent.logActivity.parentSection', 'Parent')}</ThemedText>
          <ThemedText variant="bodySmall" style={styles.reviewValue}>{selectedParent ? `${selectedParent.firstName} ${selectedParent.lastName}` : '-'}</ThemedText>
          <ThemedText variant="caption" color={theme.colors.textSecondary} style={styles.reviewLabel}>{t('agent.logActivity.descriptionSection', 'Description')}</ThemedText>
          <ThemedText variant="bodySmall" style={styles.reviewValue}>{description.trim() || '-'}</ThemedText>
        </View>
        <ThemedButton
          title={t('agent.logActivity.submit', 'Save Activity')}
          variant="primary"
          onPress={handleSubmit}
          loading={submitting}
          disabled={selectedTypeMeta.requiresParent && assignedParents.length === 0}
          style={styles.submitBtn}
        />
      </AccordionSection>

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
  accordionCard: {
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  accordionIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  accordionHeaderText: {
    flex: 1,
    marginRight: 8,
  },
  accordionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  accordionTitle: {
    flex: 1,
    fontWeight: '700',
  },
  accordionBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    minHeight: 38,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    gap: 6,
  },
  typeLabel: {
    fontWeight: '600',
    includeFontPadding: false,
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
  reviewBox: {
    padding: 12,
    marginBottom: 14,
  },
  reviewLabel: {
    marginTop: 10,
  },
  reviewValue: {
    marginTop: 2,
    fontWeight: '700',
  },
  footerHint: {
    marginTop: 8,
    textAlign: 'center',
  },
});

export default LogActivityScreen;
