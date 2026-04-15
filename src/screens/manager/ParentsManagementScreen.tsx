import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  Alert,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { useAnimatedEntry, staggerDelay, useAppSelector } from '../../hooks';
import {
  ScreenContainer,
  ThemedText,
  ThemedCard,
  ThemedButton,
  ThemedInput,
  Avatar,
  LoadingSkeleton,
} from '../../components';
import {
  useAddParentMutation,
  useGetParentsQuery,
} from '../../services/api/apiSlice';
import { COUNTRY_CODE } from '../../constants';

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

interface ParentFormState {
  firstName: string;
  lastName: string;
  fatherName: string;
  phoneNumber: string;
  email: string;
  civilId: string;
}

const INITIAL_FORM_STATE: ParentFormState = {
  firstName: '',
  lastName: '',
  fatherName: '',
  phoneNumber: '',
  email: '',
  civilId: '',
};

export default function ParentsManagementScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [page] = useState(1);
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [form, setForm] = useState<ParentFormState>(INITIAL_FORM_STATE);

  const user = useAppSelector((state) => state.auth.user);
  const schoolId = parseInt((user?.schoolId ?? '0').split(',')[0], 10);

  const { data: parentsData, isLoading } = useGetParentsQuery({
    schoolId,
    pageNumber: page,
    pageSize: 20,
    search: searchQuery || undefined,
  });
  const [addParent, { isLoading: isAddingParent }] = useAddParentMutation();

  const parents = parentsData?.data ?? [];
  const totalCount = parentsData?.totalCount ?? 0;

  const updateForm = (field: keyof ParentFormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const closeModal = () => {
    setIsAddModalVisible(false);
    setForm(INITIAL_FORM_STATE);
  };

  const handleAddParent = async () => {
    if (!schoolId) {
      Alert.alert(
        t('common.error', 'Error'),
        t('manager.missingSchool', 'Your account is not linked to a school.'),
      );
      return;
    }

    if (!form.firstName.trim() || !form.lastName.trim() || !form.phoneNumber.trim()) {
      Alert.alert(
        t('common.error', 'Error'),
        t(
          'manager.parentRequiredFields',
          'First name, last name, and phone number are required.',
        ),
      );
      return;
    }

    try {
      await addParent({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        fatherName: form.fatherName.trim() || undefined,
        schoolId,
        civilId: form.civilId.trim() || undefined,
        countryCode: COUNTRY_CODE,
        phoneNumber: form.phoneNumber.trim(),
        email: form.email.trim() || undefined,
      }).unwrap();

      closeModal();

      Alert.alert(
        t('common.success', 'Success'),
        t('manager.parentAdded', 'Parent added successfully.'),
      );
    } catch (error: any) {
      Alert.alert(
        t('common.error', 'Error'),
        error?.data?.message ||
          error?.data?.error ||
          t('manager.parentAddError', 'Failed to add parent.'),
      );
    }
  };

  return (
    <ScreenContainer>
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
                    +{parent.countryCode} {parent.phoneNumber}
                  </ThemedText>
                  <ThemedText
                    variant="caption"
                    color={theme.colors.textTertiary}
                    style={{ marginTop: 4 }}
                  >
                    {parent.email || t('manager.noEmail', 'No email provided')}
                  </ThemedText>
                </View>
              </View>
            </ThemedCard>
          </AnimatedSection>
        ))
      )}

      <AnimatedSection index={parents.length + 2}>
        <ThemedButton
          title={t('manager.addParent', 'Add Parent')}
          onPress={() => setIsAddModalVisible(true)}
          variant="primary"
          size="lg"
          fullWidth
          icon={<Ionicons name="person-add" size={20} color="#FFFFFF" />}
          style={styles.addButton}
        />
      </AnimatedSection>

      <Modal
        visible={isAddModalVisible}
        animationType="fade"
        transparent
        onRequestClose={closeModal}
      >
        <Pressable style={styles.modalOverlay} onPress={closeModal}>
          <Pressable
            style={[
              styles.modalContent,
              { backgroundColor: theme.colors.card, borderRadius: theme.borderRadius.lg },
            ]}
            onPress={(event) => event.stopPropagation()}
          >
            <ThemedText variant="subtitle" style={styles.modalTitle}>
              {t('manager.addParent', 'Add Parent')}
            </ThemedText>
            <ThemedText
              variant="caption"
              color={theme.colors.textSecondary}
              style={styles.modalDescription}
            >
              {t(
                'manager.addParentDescription',
                'Create a parent record for your school. You can fill in extra fields now or later.',
              )}
            </ThemedText>

            <ThemedInput
              label={t('auth.firstName', 'First Name')}
              value={form.firstName}
              onChangeText={(value) => updateForm('firstName', value)}
              placeholder={t('auth.firstName', 'First Name')}
            />
            <ThemedInput
              label={t('auth.lastName', 'Last Name')}
              value={form.lastName}
              onChangeText={(value) => updateForm('lastName', value)}
              placeholder={t('auth.lastName', 'Last Name')}
            />
            <ThemedInput
              label={t('auth.fatherName', 'Father Name')}
              value={form.fatherName}
              onChangeText={(value) => updateForm('fatherName', value)}
              placeholder={t('auth.fatherName', 'Father Name')}
            />
            <ThemedInput
              label={t('auth.phone', 'Phone Number')}
              value={form.phoneNumber}
              onChangeText={(value) =>
                updateForm('phoneNumber', value.replace(/[^\d]/g, ''))
              }
              placeholder="812345678"
              keyboardType="phone-pad"
              leftIcon={
                <ThemedText variant="bodySmall" color={theme.colors.textSecondary}>
                  +{COUNTRY_CODE}
                </ThemedText>
              }
            />
            <ThemedInput
              label={t('auth.email', 'Email')}
              value={form.email}
              onChangeText={(value) => updateForm('email', value)}
              placeholder="email@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <ThemedInput
              label={t('auth.civilId', 'Civil ID')}
              value={form.civilId}
              onChangeText={(value) => updateForm('civilId', value)}
              placeholder={t('auth.civilIdPlaceholder', 'Civil ID')}
            />

            <View style={styles.modalActions}>
              <ThemedButton
                title={t('common.cancel', 'Cancel')}
                onPress={closeModal}
                variant="ghost"
                size="md"
                style={styles.modalButton}
              />
              <ThemedButton
                title={t('manager.addParent', 'Add Parent')}
                onPress={handleAddParent}
                variant="primary"
                size="md"
                style={styles.modalButton}
                loading={isAddingParent}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalContent: {
    width: '100%',
    padding: 24,
  },
  modalTitle: {
    marginBottom: 8,
  },
  modalDescription: {
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
  },
});
