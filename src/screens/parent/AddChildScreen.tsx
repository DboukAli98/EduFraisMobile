import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  ScrollView,
  Pressable,
  FlatList,
  Modal,
  Platform,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useTheme } from '../../theme';
import { useAppSelector } from '../../hooks';
import {
  ScreenContainer,
  ThemedText,
  ThemedInput,
  ThemedButton,
} from '../../components';
import {
  useAddChildMutation,
  useGetSchoolsQuery,
} from '../../services/api/apiSlice';
import type { School } from '../../types';

export default function AddChildScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const user = useAppSelector((state) => state.auth.user);
  const parentId = parseInt(user?.entityUserId || '0', 10);

  const { data: schoolsData, isLoading: schoolsLoading } = useGetSchoolsQuery({
    pageNumber: 1,
    pageSize: 200,
    onlyEnabled: true,
  });
  const schools = schoolsData?.data ?? [];

  const [addChild, { isLoading }] = useAddChildMutation();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // School picker state
  const [showSchoolPicker, setShowSchoolPicker] = useState(false);
  const [schoolSearch, setSchoolSearch] = useState('');

  const filteredSchools = useMemo(() => {
    if (!schoolSearch.trim()) return schools;
    const q = schoolSearch.toLowerCase();
    return schools.filter(
      (s) =>
        s.schoolName.toLowerCase().includes(q) ||
        s.schoolAddress?.toLowerCase().includes(q),
    );
  }, [schools, schoolSearch]);

  const validate = useCallback(() => {
    const e: Record<string, string> = {};
    if (!firstName.trim()) e.firstName = t('auth.firstNameRequired', 'First name is required');
    if (!lastName.trim()) e.lastName = t('auth.lastNameRequired', 'Last name is required');
    if (!dateOfBirth) e.dateOfBirth = t('children.dobRequired', 'Date of birth is required');
    if (!selectedSchool) e.school = t('children.schoolRequired', 'Please select a school');
    setErrors(e);
    return Object.keys(e).length === 0;
  }, [firstName, lastName, dateOfBirth, selectedSchool, t]);

  const handleSubmit = useCallback(async () => {
    if (!validate()) return;
    try {
      const payload = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        dateOfBirth: dateOfBirth!.toISOString().split('T')[0], // "YYYY-MM-DD" for C# DateOnly
        fatherName: fatherName.trim() || undefined,
        parentId,
        schoolId: selectedSchool!.schoolId,
      };
      console.log('[AddChild] payload:', payload);
      const result = await addChild(payload).unwrap();
      console.log('[AddChild] success:', result);
      Alert.alert(
        t('common.success', 'Success'),
        t('children.addSuccess', 'Child added successfully. Pending director approval.'),
        [{ text: t('common.done', 'Done'), onPress: () => router.back() }],
      );
    } catch (err: any) {
      console.log('[AddChild] error:', JSON.stringify(err, null, 2));
      // Backend sets response.Error → serialized as `error` (camelCase).
      // Also handle ASP.NET model-binding errors at err.data.errors.
      const validationErrors = err?.data?.errors
        ? Object.values(err.data.errors).flat().join('\n')
        : null;
      const message =
        validationErrors ||
        err?.data?.error ||
        err?.data?.Error ||
        err?.data?.message ||
        err?.data?.title ||
        err?.error ||
        err?.message ||
        (err?.status === 401
          ? t('children.authError', 'You are not authorized. Please sign out and sign in again.')
          : err?.status === 'FETCH_ERROR'
          ? t('common.networkError', 'Network error. Check your connection.')
          : t('children.addError', 'Failed to add child.'));
      Alert.alert(t('common.error', 'Error'), String(message));
    }
  }, [validate, addChild, firstName, lastName, dateOfBirth, fatherName, parentId, selectedSchool, router, t]);

  const handleSelectSchool = useCallback((school: School) => {
    setSelectedSchool(school);
    setShowSchoolPicker(false);
    setSchoolSearch('');
  }, []);

  const renderSchoolItem = useCallback(
    ({ item }: { item: School }) => (
      <Pressable
        onPress={() => handleSelectSchool(item)}
        style={[
          styles.schoolItem,
          {
            backgroundColor:
              selectedSchool?.schoolId === item.schoolId
                ? theme.colors.primaryLight + '30'
                : 'transparent',
            borderBottomColor: theme.colors.borderLight,
          },
        ]}
      >
        <View style={styles.schoolItemContent}>
          <View
            style={[
              styles.schoolIcon,
              { backgroundColor: theme.colors.primaryLight + '20' },
            ]}
          >
            <Ionicons name="school-outline" size={20} color={theme.colors.primary} />
          </View>
          <View style={styles.schoolItemText}>
            <ThemedText variant="body" numberOfLines={1}>
              {item.schoolName}
            </ThemedText>
            {item.schoolAddress ? (
              <ThemedText
                variant="caption"
                color={theme.colors.textSecondary}
                numberOfLines={1}
              >
                {item.schoolAddress}
              </ThemedText>
            ) : null}
          </View>
          {selectedSchool?.schoolId === item.schoolId && (
            <Ionicons name="checkmark-circle" size={22} color={theme.colors.primary} />
          )}
        </View>
      </Pressable>
    ),
    [handleSelectSchool, selectedSchool, theme],
  );

  return (
    <ScreenContainer scrollable={false} padding={false}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <ThemedText variant="h2" style={styles.title}>
          {t('children.addChild', 'Add Child')}
        </ThemedText>

        <ThemedInput
          label={t('auth.firstName', 'First Name')}
          value={firstName}
          onChangeText={setFirstName}
          placeholder={t('auth.firstName', 'First Name')}
          error={errors.firstName}
        />

        <ThemedInput
          label={t('auth.lastName', 'Last Name')}
          value={lastName}
          onChangeText={setLastName}
          placeholder={t('auth.lastName', 'Last Name')}
          error={errors.lastName}
        />

        <ThemedInput
          label={t('children.fatherName', 'Father Name')}
          value={fatherName}
          onChangeText={setFatherName}
          placeholder={t('children.fatherName', 'Father Name')}
        />

        {/* Date of Birth Picker */}
        <ThemedText
          variant="bodySmall"
          color={theme.colors.textSecondary}
          style={styles.label}
        >
          {t('children.dateOfBirth', 'Date of Birth')}
        </ThemedText>
        <Pressable
          onPress={() => setShowDatePicker(true)}
          style={[
            styles.dateSelector,
            {
              backgroundColor: theme.colors.inputBackground,
              borderColor: errors.dateOfBirth ? theme.colors.error : theme.colors.border,
              borderRadius: theme.borderRadius.md,
            },
          ]}
        >
          <Ionicons
            name="calendar-outline"
            size={20}
            color={dateOfBirth ? theme.colors.text : theme.colors.textTertiary}
            style={styles.selectorIcon}
          />
          <ThemedText
            variant="body"
            color={dateOfBirth ? theme.colors.text : theme.colors.textTertiary}
            style={styles.selectorText}
          >
            {dateOfBirth
              ? dateOfBirth.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })
              : t('children.selectDate', 'Select date')}
          </ThemedText>
        </Pressable>
        {errors.dateOfBirth && (
          <ThemedText variant="caption" color={theme.colors.error} style={styles.errorText}>
            {errors.dateOfBirth}
          </ThemedText>
        )}

        {showDatePicker && (
          Platform.OS === 'ios' ? (
            <Modal transparent animationType="fade" onRequestClose={() => setShowDatePicker(false)}>
              <Pressable style={styles.dateModalOverlay} onPress={() => setShowDatePicker(false)}>
                <View
                  style={[
                    styles.dateModalContent,
                    { backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.xl },
                  ]}
                >
                  <View style={[styles.dateModalHeader, { borderBottomColor: theme.colors.borderLight }]}>
                    <Pressable onPress={() => setShowDatePicker(false)}>
                      <ThemedText variant="body" color={theme.colors.textSecondary}>
                        {t('common.cancel', 'Cancel')}
                      </ThemedText>
                    </Pressable>
                    <ThemedText variant="subtitle">
                      {t('children.dateOfBirth', 'Date of Birth')}
                    </ThemedText>
                    <Pressable onPress={() => setShowDatePicker(false)}>
                      <ThemedText variant="body" color={theme.colors.primary}>
                        {t('common.done', 'Done')}
                      </ThemedText>
                    </Pressable>
                  </View>
                  <DateTimePicker
                    value={dateOfBirth || new Date(2010, 0, 1)}
                    mode="date"
                    display="spinner"
                    maximumDate={new Date()}
                    onChange={(_event: DateTimePickerEvent, selected?: Date) => {
                      if (selected) setDateOfBirth(selected);
                    }}
                  />
                </View>
              </Pressable>
            </Modal>
          ) : (
            <DateTimePicker
              value={dateOfBirth || new Date(2010, 0, 1)}
              mode="date"
              display="default"
              maximumDate={new Date()}
              onChange={(_event: DateTimePickerEvent, selected?: Date) => {
                setShowDatePicker(false);
                if (selected) setDateOfBirth(selected);
              }}
            />
          )
        )}

        {/* School Selection */}
        <ThemedText variant="bodySmall" style={styles.label}>
          {t('children.school', 'School')}
        </ThemedText>
        <Pressable
          onPress={() => setShowSchoolPicker(true)}
          style={[
            styles.schoolSelector,
            {
              backgroundColor: theme.colors.inputBackground,
              borderColor: errors.school ? theme.colors.error : theme.colors.border,
              borderRadius: theme.borderRadius.md,
            },
          ]}
        >
          <Ionicons
            name="school-outline"
            size={20}
            color={selectedSchool ? theme.colors.text : theme.colors.textTertiary}
            style={styles.selectorIcon}
          />
          <ThemedText
            variant="body"
            color={selectedSchool ? theme.colors.text : theme.colors.textTertiary}
            style={styles.selectorText}
            numberOfLines={1}
          >
            {selectedSchool
              ? selectedSchool.schoolName
              : t('children.selectSchool', 'Select a school...')}
          </ThemedText>
          <Ionicons name="chevron-down" size={20} color={theme.colors.textTertiary} />
        </Pressable>
        {errors.school && (
          <ThemedText variant="caption" color={theme.colors.error} style={styles.errorText}>
            {errors.school}
          </ThemedText>
        )}

        <View style={styles.spacer} />

        <ThemedButton
          title={isLoading ? t('common.loading', 'Loading...') : t('children.addChild', 'Add Child')}
          onPress={handleSubmit}
          disabled={isLoading}
          variant="primary"
          size="lg"
        />

        <ThemedButton
          title={t('common.cancel', 'Cancel')}
          onPress={() => router.back()}
          variant="ghost"
          size="md"
          style={styles.cancelBtn}
        />
      </ScrollView>

      {/* School Picker Modal */}
      <Modal
        visible={showSchoolPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowSchoolPicker(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
          {/* Modal Header */}
          <View style={[styles.modalHeader, { borderBottomColor: theme.colors.borderLight }]}>
            <ThemedText variant="subtitle">
              {t('children.selectSchool', 'Select a school')}
            </ThemedText>
            <Pressable
              onPress={() => {
                setShowSchoolPicker(false);
                setSchoolSearch('');
              }}
              hitSlop={12}
            >
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </Pressable>
          </View>

          {/* Search Input */}
          <View style={[styles.searchContainer, { borderBottomColor: theme.colors.borderLight }]}>
            <ThemedInput
              value={schoolSearch}
              onChangeText={setSchoolSearch}
              placeholder={t('children.searchSchool', 'Search schools...')}
              leftIcon={
                <Ionicons name="search" size={18} color={theme.colors.textTertiary} />
              }
              containerStyle={styles.searchInputContainer}
            />
          </View>

          {/* School List */}
          {schoolsLoading ? (
            <View style={styles.loadingContainer}>
              <ThemedText variant="body" color={theme.colors.textSecondary}>
                {t('common.loading', 'Loading...')}
              </ThemedText>
            </View>
          ) : filteredSchools.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="school-outline" size={48} color={theme.colors.textTertiary} />
              <ThemedText
                variant="body"
                color={theme.colors.textSecondary}
                style={styles.emptyText}
              >
                {schoolSearch
                  ? t('children.noSchoolsFound', 'No schools found')
                  : t('children.noSchools', 'No schools available')}
              </ThemedText>
            </View>
          ) : (
            <FlatList
              data={filteredSchools}
              keyExtractor={(item) => String(item.schoolId)}
              renderItem={renderSchoolItem}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.schoolListContent}
            />
          )}
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  title: {
    marginTop: 16,
    marginBottom: 24,
  },
  label: {
    marginBottom: 8,
    fontWeight: '600',
  },
  schoolSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 52,
    marginBottom: 4,
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 52,
    marginBottom: 4,
  },
  dateModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  dateModalContent: {
    paddingBottom: 20,
  },
  dateModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  selectorIcon: {
    marginRight: 10,
  },
  selectorText: {
    flex: 1,
  },
  errorText: {
    marginTop: 4,
    marginBottom: 4,
  },
  spacer: {
    height: 24,
  },
  cancelBtn: {
    marginTop: 8,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  searchInputContainer: {
    marginBottom: 0,
  },
  schoolListContent: {
    paddingBottom: 40,
  },
  schoolItem: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  schoolItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  schoolIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  schoolItemText: {
    flex: 1,
    marginRight: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    marginTop: 12,
    textAlign: 'center',
  },
});
