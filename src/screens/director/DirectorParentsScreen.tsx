import React, { useCallback, useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  FlatList,
  RefreshControl,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';

import {
  Alert,
  ScreenContainer,
  ThemedText,
  ThemedCard,
  ThemedButton,
  ThemedInput,
  Avatar,
  EmptyState,
  ScreenSkeleton,
} from '../../components';
import { useTheme } from '../../theme';
import { useAnimatedEntry, staggerDelay, useAppSelector } from '../../hooks';
import {
  useGetParentsQuery,
  useAddParentMutation,
} from '../../services/api/apiSlice';
import { COUNTRY_CODE } from '../../constants';
import type { Parent } from '../../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ParentForm {
  firstName: string;
  lastName: string;
  fatherName: string;
  phoneNumber: string;
  email: string;
  civilId: string;
}

const EMPTY_FORM: ParentForm = {
  firstName: '',
  lastName: '',
  fatherName: '',
  phoneNumber: '',
  email: '',
  civilId: '',
};

// ---------------------------------------------------------------------------
// ParentCard
// ---------------------------------------------------------------------------

interface ParentCardProps {
  parent: Parent;
  index: number;
  onPress: () => void;
}

const ParentCard: React.FC<ParentCardProps> = ({ parent, index, onPress }) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const anim = useAnimatedEntry({ type: 'slideUp', delay: staggerDelay(index + 1) });

  return (
    <Animated.View style={anim}>
      <ThemedCard variant="elevated" onPress={onPress} style={styles.card}>
        <View style={styles.cardRow}>
          <Avatar firstName={parent.firstName} lastName={parent.lastName} size="md" />
          <View style={styles.cardInfo}>
            <ThemedText variant="subtitle">
              {parent.firstName} {parent.lastName}
            </ThemedText>
            {parent.fatherName ? (
              <ThemedText variant="caption" color={theme.colors.textSecondary}>
                {t('director.parents.fatherName', 'Father')}: {parent.fatherName}
              </ThemedText>
            ) : null}
            <ThemedText variant="caption" color={theme.colors.textTertiary}>
              +{parent.countryCode} {parent.phoneNumber}
            </ThemedText>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.textTertiary} />
        </View>
      </ThemedCard>
    </Animated.View>
  );
};

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

const DirectorParentsScreen: React.FC = () => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const user = useAppSelector((state) => state.auth.user);
  const schoolId = parseInt((user?.schoolId ?? '0').split(',')[0], 10);

  const [search, setSearch] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState<ParentForm>(EMPTY_FORM);

  const { data, isLoading, refetch } = useGetParentsQuery(
    { schoolId, pageNumber: 1, pageSize: 100, search: search || undefined },
    { skip: !schoolId },
  );
  const [addParent, { isLoading: adding }] = useAddParentMutation();

  const parents = data?.data ?? [];
  const total = data?.totalCount ?? 0;

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const updateForm = (key: keyof ParentForm, val: string) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const closeModal = () => {
    setModalVisible(false);
    setForm(EMPTY_FORM);
  };

  const handleAdd = async () => {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.phoneNumber.trim()) {
      Alert.alert(
        t('common.error', 'Error'),
        t('director.parents.requiredFields', 'First name, last name and phone are required.'),
      );
      return;
    }
    // Preserve the leading 0 — see ParentsManagementScreen note.
    const localPhone = form.phoneNumber.replace(/\D/g, '');
    if (!localPhone) {
      Alert.alert(
        t('common.error', 'Error'),
        t('director.parents.requiredFields', 'First name, last name and phone are required.'),
      );
      return;
    }

    try {
      await addParent({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        fatherName: form.fatherName.trim() || '',
        schoolId,
        countryCode: COUNTRY_CODE,
        phoneNumber: localPhone,
        email: form.email.trim() || '',
        civilId: form.civilId.trim() || '',
      }).unwrap();
      closeModal();
      Alert.alert(t('common.success', 'Success'), t('director.parents.added', 'Parent added successfully.'));
    } catch (err: any) {
      Alert.alert(
        t('common.error', 'Error'),
        err?.data?.error || err?.data?.message || t('common.genericError', 'Something went wrong'),
      );
    }
  };

  const headerAnim = useAnimatedEntry({ type: 'slideUp', delay: staggerDelay(0) });

  return (
    <ScreenContainer scrollable={false}>
      {/* Header */}
      <Animated.View style={[styles.header, headerAnim]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </Pressable>
        <ThemedText variant="h1">{t('director.parents.title', 'Parents')}</ThemedText>
        <Pressable
          onPress={() => setModalVisible(true)}
          style={[
            styles.addBtn,
            { backgroundColor: theme.colors.primary, borderRadius: theme.borderRadius.full },
          ]}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </Pressable>
      </Animated.View>

      {/* Stats chip */}
      <View style={styles.statsRow}>
        <View style={[styles.chip, { backgroundColor: theme.colors.primary + '15' }]}>
          <Ionicons name="people" size={14} color={theme.colors.primary} />
          <ThemedText variant="caption" style={styles.chipTxt}>
            {total} {t('director.parents.title', 'Parents')}
          </ThemedText>
        </View>
      </View>

      {/* Search */}
      <ThemedInput
        placeholder={t('common.search', 'Search...')}
        value={search}
        onChangeText={setSearch}
        leftIcon={<Ionicons name="search" size={18} color={theme.colors.textTertiary} />}
        containerStyle={styles.search}
      />

      {/* List */}
      {isLoading ? (
        <ScreenSkeleton count={5} />
      ) : parents.length === 0 ? (
        <EmptyState
          icon="people-outline"
          title={t('director.parents.emptyTitle', 'No Parents Yet')}
          description={t('director.parents.emptyDesc', 'Add the first parent to this school.')}
          actionLabel={t('director.parents.addParent', 'Add Parent')}
          onAction={() => setModalVisible(true)}
        />
      ) : (
        <FlatList
          data={parents}
          keyExtractor={(item) => String(item.parentId)}
          renderItem={({ item, index }) => (
            <ParentCard
              parent={item}
              index={index}
              onPress={() =>
                router.push({
                  pathname: '/(app)/director-parent-detail',
                  params: { parentId: String(item.parentId) },
                })
              }
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.primary}
            />
          }
        />
      )}

      {/* Add Parent Modal */}
      <Modal visible={modalVisible} animationType="fade" transparent onRequestClose={closeModal}>
        <Pressable style={styles.overlay} onPress={closeModal}>
          <Pressable
            style={[
              styles.modalBox,
              { backgroundColor: theme.colors.card, borderRadius: theme.borderRadius.lg },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <ThemedText variant="subtitle" style={styles.modalTitle}>
              {t('director.parents.addParent', 'Add Parent')}
            </ThemedText>

            <ThemedInput
              label={t('auth.firstName', 'First Name')}
              value={form.firstName}
              onChangeText={(v) => updateForm('firstName', v)}
              placeholder={t('auth.firstName', 'First Name')}
            />
            <ThemedInput
              label={t('auth.lastName', 'Last Name')}
              value={form.lastName}
              onChangeText={(v) => updateForm('lastName', v)}
              placeholder={t('auth.lastName', 'Last Name')}
            />
            <ThemedInput
              label={t('auth.fatherName', 'Father Name')}
              value={form.fatherName}
              onChangeText={(v) => updateForm('fatherName', v)}
              placeholder={t('auth.fatherName', 'Father Name')}
            />
            <ThemedInput
              label={t('auth.phone', 'Phone')}
              value={form.phoneNumber}
              onChangeText={(v) => updateForm('phoneNumber', v.replace(/\D/g, ''))}
              placeholder="812345678"
              keyboardType="phone-pad"
              leftIcon={
                <ThemedText variant="caption" color={theme.colors.textSecondary}>
                  {COUNTRY_CODE}
                </ThemedText>
              }
            />
            <ThemedInput
              label={t('auth.email', 'Email')}
              value={form.email}
              onChangeText={(v) => updateForm('email', v)}
              placeholder="email@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <ThemedInput
              label={t('auth.civilId', 'Civil ID')}
              value={form.civilId}
              onChangeText={(v) => updateForm('civilId', v)}
              placeholder={t('auth.civilIdPlaceholder', 'Civil ID')}
            />

            <View style={styles.modalActions}>
              <ThemedButton
                title={t('common.cancel', 'Cancel')}
                variant="ghost"
                onPress={closeModal}
                style={styles.modalBtn}
              />
              <ThemedButton
                title={t('director.parents.addParent', 'Add Parent')}
                variant="primary"
                onPress={handleAdd}
                loading={adding}
                style={styles.modalBtn}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
    paddingHorizontal: 16,
    gap: 8,
  },
  backBtn: { padding: 4 },
  addBtn: {
    marginLeft: 'auto',
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  chipTxt: { fontWeight: '600' },
  search: { marginHorizontal: 16, marginBottom: 8 },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  card: { marginBottom: 10 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardInfo: { flex: 1 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalBox: { padding: 20 },
  modalTitle: { marginBottom: 16, fontWeight: '700' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  modalBtn: { flex: 1 },
});

export default DirectorParentsScreen;
