import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  FlatList,
  Modal,
  RefreshControl,
  Image,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';

import {
  Alert,
  ScreenContainer,
  ThemedText,
  ThemedCard,
  ThemedInput,
  ThemedButton,
  EmptyState,
  ScreenSkeleton,
} from '../../components';
import { useTheme } from '../../theme';
import { useAnimatedEntry, staggerDelay, useAppSelector } from '../../hooks';
import {
  useGetMerchandiseCategoriesQuery,
  useGetSchoolMerchandisesQuery,
  useAddMerchandiseCategoryMutation,
  useAddSchoolMerchandiseMutation,
} from '../../services/api/apiSlice';
import { CURRENCY_SYMBOL, API_BASE_URL } from '../../constants';
import type { SchoolMerchandise, SchoolMerchandiseCategory } from '../../types';

const formatCurrency = (amount: number) =>
  `${amount.toLocaleString()} ${CURRENCY_SYMBOL}`;

const getImageUrl = (schoolId: number, logo?: string) => {
  if (!logo) return null;
  const baseHost = API_BASE_URL.replace(/\/api\/?$/, '');
  return `${baseHost}/uploads/merchandises/${schoolId}/${logo}`;
};

type Tab = 'items' | 'categories';

// ─── Item Card Component ────────────────────────────────────────
const ItemCard: React.FC<{
  item: SchoolMerchandise;
  index: number;
  categories: SchoolMerchandiseCategory[];
  schoolId: number;
}> = ({ item, index, categories, schoolId }) => {
  const { theme } = useTheme();
  const anim = useAnimatedEntry({ type: 'slideUp', delay: staggerDelay(index, 50) });
  const cat = categories.find((c) => c.schoolMerchandiseCategoryId === item.fK_SchoolMerchandiseCategory);
  const imageUrl = getImageUrl(schoolId, item.schoolMerchandiseLogo);

  return (
    <Animated.View style={anim}>
      <ThemedCard style={styles.itemCard}>
        <View style={styles.itemRow}>
          <View style={[styles.itemIcon, { backgroundColor: theme.colors.primaryLight + '20', overflow: 'hidden' }]}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={{ width: 40, height: 40 }} resizeMode="cover" />
            ) : (
              <Ionicons name="pricetag" size={20} color={theme.colors.primary} />
            )}
          </View>
          <View style={styles.itemInfo}>
            <ThemedText variant="subtitle" numberOfLines={1}>
              {item.schoolMerchandiseName}
            </ThemedText>
            {item.schoolMerchandiseDescription ? (
              <ThemedText variant="caption" color={theme.colors.textSecondary} numberOfLines={2}>
                {item.schoolMerchandiseDescription}
              </ThemedText>
            ) : null}
            {cat ? (
              <ThemedText variant="caption" color={theme.colors.textTertiary}>
                {cat.schoolMerchandiseCategoryName}
              </ThemedText>
            ) : null}
          </View>
          <ThemedText variant="body" color={theme.colors.primary} style={styles.price}>
            {formatCurrency(item.schoolMerchandisePrice)}
          </ThemedText>
        </View>
      </ThemedCard>
    </Animated.View>
  );
};

// ─── Category Card Component ────────────────────────────────────
const CategoryCard: React.FC<{
  item: SchoolMerchandiseCategory;
  index: number;
}> = ({ item, index }) => {
  const { theme } = useTheme();
  const anim = useAnimatedEntry({ type: 'slideUp', delay: staggerDelay(index, 50) });

  return (
    <Animated.View style={anim}>
      <ThemedCard style={styles.itemCard}>
        <View style={styles.itemRow}>
          <View style={[styles.itemIcon, { backgroundColor: theme.colors.primaryLight + '20' }]}>
            <Ionicons name="folder-outline" size={20} color={theme.colors.primary} />
          </View>
          <View style={styles.itemInfo}>
            <ThemedText variant="subtitle" numberOfLines={1}>
              {item.schoolMerchandiseCategoryName}
            </ThemedText>
            {item.schoolMerchandiseCategoryDescription ? (
              <ThemedText variant="caption" color={theme.colors.textSecondary} numberOfLines={2}>
                {item.schoolMerchandiseCategoryDescription}
              </ThemedText>
            ) : null}
          </View>
        </View>
      </ThemedCard>
    </Animated.View>
  );
};

// ─── Main Screen ────────────────────────────────────────────────
export default function MerchandiseManageScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const user = useAppSelector((state) => state.auth.user);
  const schoolId = parseInt(user?.schoolId || '0');

  const [activeTab, setActiveTab] = useState<Tab>('items');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);

  // Add category modal
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Add item modal
  const [showItemModal, setShowItemModal] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemDesc, setNewItemDesc] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemCategoryId, setNewItemCategoryId] = useState<number | null>(null);
  const [newItemImage, setNewItemImage] = useState<ImagePicker.ImagePickerAsset | null>(null);

  const {
    data: categoriesData,
    isLoading: categoriesLoading,
    refetch: refetchCategories,
  } = useGetMerchandiseCategoriesQuery({ pageNumber: 1, pageSize: 50 });

  const {
    data: merchandiseData,
    isLoading: merchandiseLoading,
    refetch: refetchItems,
  } = useGetSchoolMerchandisesQuery(
    {
      schoolId: String(schoolId),
      categoryId: selectedCategoryId ?? undefined,
      pageNumber: 1,
      pageSize: 50,
    },
    { skip: !schoolId },
  );

  const [addCategory, { isLoading: isAddingCategory }] = useAddMerchandiseCategoryMutation();
  const [addMerchandise, { isLoading: isAddingItem }] = useAddSchoolMerchandiseMutation();

  const categories = categoriesData?.data ?? [];
  const merchandises = merchandiseData?.data ?? [];

  const headerAnim = useAnimatedEntry({ type: 'slideUp', delay: staggerDelay(0) });

  // ─── Add Category ─────────────────────────────────────────
  const handleAddCategory = useCallback(async () => {
    if (!newCategoryName.trim()) {
      Alert.alert(t('common.error', 'Error'), t('director.merchandise.categoryNameRequired', 'Category name is required'));
      return;
    }
    try {
      await addCategory({
        schoolMerchandiseCategoryName: newCategoryName.trim(),
      }).unwrap();
      setShowCategoryModal(false);
      setNewCategoryName('');
      Alert.alert(t('common.success', 'Success'), t('director.merchandise.categoryAdded', 'Category added successfully'));
      refetchCategories();
    } catch (err: any) {
      Alert.alert(t('common.error', 'Error'), err?.data?.message || t('director.merchandise.categoryAddFailed', 'Failed to add category'));
    }
  }, [newCategoryName, addCategory, refetchCategories, t]);

  // ─── Add Item ─────────────────────────────────────────────
  const pickImage = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setNewItemImage(result.assets[0]);
    }
  }, []);

  const openAddItem = useCallback(() => {
    setNewItemName('');
    setNewItemDesc('');
    setNewItemPrice('');
    setNewItemImage(null);
    setNewItemCategoryId(categories.length > 0 ? categories[0].schoolMerchandiseCategoryId : null);
    setShowItemModal(true);
  }, [categories]);

  const handleAddItem = useCallback(async () => {
    if (!newItemName.trim()) {
      Alert.alert(t('common.error', 'Error'), t('director.merchandise.itemNameRequired', 'Item name is required'));
      return;
    }
    const price = parseFloat(newItemPrice);
    if (isNaN(price) || price <= 0) {
      Alert.alert(t('common.error', 'Error'), t('director.merchandise.priceRequired', 'Please enter a valid price'));
      return;
    }
    if (!newItemCategoryId) {
      Alert.alert(t('common.error', 'Error'), t('director.merchandise.categoryRequired', 'Please select a category'));
      return;
    }
    try {
      const logoPayload = newItemImage ? {
        uri: newItemImage.uri,
        name: newItemImage.fileName || `merchandise_${Date.now()}.jpg`,
        type: newItemImage.mimeType || 'image/jpeg',
      } : undefined;
      await addMerchandise({
        schoolMerchandiseName: newItemName.trim(),
        schoolMerchandiseDescription: newItemDesc.trim() || undefined,
        schoolMerchandisePrice: price,
        fk_SchoolId: schoolId,
        fk_SchoolMerchandiseCategory: newItemCategoryId,
        logo: logoPayload,
      }).unwrap();
      setShowItemModal(false);
      Alert.alert(t('common.success', 'Success'), t('director.merchandise.itemAdded', 'Item added successfully'));
      refetchItems();
    } catch (err: any) {
      Alert.alert(t('common.error', 'Error'), err?.data?.message || t('director.merchandise.itemAddFailed', 'Failed to add item'));
    }
  }, [newItemName, newItemDesc, newItemPrice, newItemCategoryId, newItemImage, schoolId, addMerchandise, refetchItems, t]);

  const isLoading = categoriesLoading || merchandiseLoading;

  const renderItem = useCallback(
    ({ item, index }: { item: SchoolMerchandise; index: number }) => (
      <ItemCard item={item} index={index} categories={categories} schoolId={schoolId} />
    ),
    [categories, schoolId],
  );

  const renderCategory = useCallback(
    ({ item, index }: { item: SchoolMerchandiseCategory; index: number }) => (
      <CategoryCard item={item} index={index} />
    ),
    [],
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
        <ThemedText variant="h1">{t('director.merchandise.title', 'Merchandise')}</ThemedText>
        <Pressable
          onPress={activeTab === 'items' ? openAddItem : () => { setNewCategoryName(''); setShowCategoryModal(true); }}
          style={[styles.addBtn, { backgroundColor: theme.colors.primary, borderRadius: theme.borderRadius.full }]}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </Pressable>
      </Animated.View>

      {/* Tab Switcher */}
      <View style={styles.tabRow}>
        <Pressable
          onPress={() => setActiveTab('items')}
          style={[
            styles.tab,
            {
              backgroundColor: activeTab === 'items' ? theme.colors.primary : 'transparent',
              borderColor: theme.colors.primary,
              borderRadius: theme.borderRadius.md,
            },
          ]}
        >
          <Ionicons
            name="pricetag-outline"
            size={16}
            color={activeTab === 'items' ? '#fff' : theme.colors.primary}
            style={styles.tabIcon}
          />
          <ThemedText
            variant="caption"
            color={activeTab === 'items' ? '#fff' : theme.colors.primary}
            style={styles.tabLabel}
          >
            {t('director.merchandise.items', 'Items')} ({merchandises.length})
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab('categories')}
          style={[
            styles.tab,
            {
              backgroundColor: activeTab === 'categories' ? theme.colors.primary : 'transparent',
              borderColor: theme.colors.primary,
              borderRadius: theme.borderRadius.md,
            },
          ]}
        >
          <Ionicons
            name="folder-outline"
            size={16}
            color={activeTab === 'categories' ? '#fff' : theme.colors.primary}
            style={styles.tabIcon}
          />
          <ThemedText
            variant="caption"
            color={activeTab === 'categories' ? '#fff' : theme.colors.primary}
            style={styles.tabLabel}
          >
            {t('director.merchandise.categories', 'Categories')} ({categories.length})
          </ThemedText>
        </Pressable>
      </View>

      {/* Category filter chips (items tab only) */}
      {activeTab === 'items' && categories.length > 0 && (
        <View style={styles.categoryFilterWrapper}>
          <FlatList
            horizontal
            data={[
              { schoolMerchandiseCategoryId: 0, schoolMerchandiseCategoryName: t('payments.filter.all', 'All') } as any,
              ...categories,
            ]}
            keyExtractor={(c) => String(c.schoolMerchandiseCategoryId)}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryList}
            renderItem={({ item: cat }) => {
              const isActive =
                (cat.schoolMerchandiseCategoryId === 0 && selectedCategoryId === null) ||
                cat.schoolMerchandiseCategoryId === selectedCategoryId;
              return (
                <Pressable
                  onPress={() =>
                    setSelectedCategoryId(
                      cat.schoolMerchandiseCategoryId === 0 ? null : cat.schoolMerchandiseCategoryId,
                    )
                  }
                  style={[
                    styles.categoryChip,
                    {
                      backgroundColor: isActive ? theme.colors.primary : theme.colors.surface,
                      borderRadius: theme.borderRadius.full,
                    },
                  ]}
                >
                  <ThemedText
                    variant="caption"
                    color={isActive ? '#fff' : theme.colors.text}
                    style={{ fontWeight: isActive ? '600' : '400' }}
                  >
                    {cat.schoolMerchandiseCategoryName}
                  </ThemedText>
                </Pressable>
              );
            }}
          />
        </View>
      )}

      {/* Items List */}
      {activeTab === 'items' && (
        merchandises.length === 0 ? (
          <EmptyState
            icon="pricetag-outline"
            title={t('director.merchandise.emptyItems', 'No Items Yet')}
            description={t('director.merchandise.emptyItemsDesc', 'Add your first merchandise item for parents to purchase.')}
            actionLabel={t('director.merchandise.addItem', 'Add Item')}
            onAction={openAddItem}
          />
        ) : (
          <FlatList
            data={merchandises}
            keyExtractor={(item) => String(item.schoolMerchandiseId)}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={false} onRefresh={refetchItems} tintColor={theme.colors.primary} colors={[theme.colors.primary]} />
            }
          />
        )
      )}

      {/* Categories List */}
      {activeTab === 'categories' && (
        categories.length === 0 ? (
          <EmptyState
            icon="folder-outline"
            title={t('director.merchandise.emptyCategories', 'No Categories Yet')}
            description={t('director.merchandise.emptyCategoriesDesc', 'Create a category first, then add items to it.')}
            actionLabel={t('director.merchandise.addCategory', 'Add Category')}
            onAction={() => { setNewCategoryName(''); setShowCategoryModal(true); }}
          />
        ) : (
          <FlatList
            data={categories}
            keyExtractor={(item) => String(item.schoolMerchandiseCategoryId)}
            renderItem={renderCategory}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={false} onRefresh={refetchCategories} tintColor={theme.colors.primary} colors={[theme.colors.primary]} />
            }
          />
        )
      )}

      {/* ─── Add Category Modal ──────────────────────────────── */}
      <Modal visible={showCategoryModal} animationType="fade" transparent onRequestClose={() => setShowCategoryModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowCategoryModal(false)}>
          <Pressable style={[styles.modalContent, { backgroundColor: theme.colors.card, borderRadius: theme.borderRadius.lg }]} onPress={() => {}}>
            <ThemedText variant="subtitle" style={styles.modalTitle}>
              {t('director.merchandise.addCategory', 'Add Category')}
            </ThemedText>
            <ThemedInput
              label={t('director.merchandise.categoryName', 'Category Name')}
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              placeholder={t('director.merchandise.categoryNamePlaceholder', 'e.g. Uniforms, Books...')}
            />
            <View style={styles.modalActions}>
              <ThemedButton
                title={t('common.cancel', 'Cancel')}
                variant="ghost"
                size="md"
                onPress={() => setShowCategoryModal(false)}
                style={styles.modalBtn}
              />
              <ThemedButton
                title={isAddingCategory ? t('common.loading', 'Loading...') : t('common.save', 'Save')}
                variant="primary"
                size="md"
                onPress={handleAddCategory}
                disabled={isAddingCategory}
                style={styles.modalBtn}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ─── Add Item Modal ──────────────────────────────────── */}
      <Modal visible={showItemModal} animationType="fade" transparent onRequestClose={() => setShowItemModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowItemModal(false)}>
          <Pressable style={[styles.modalContent, { backgroundColor: theme.colors.card, borderRadius: theme.borderRadius.lg }]} onPress={() => {}}>
            <ThemedText variant="subtitle" style={styles.modalTitle}>
              {t('director.merchandise.addItem', 'Add Item')}
            </ThemedText>
            <ThemedInput
              label={t('director.merchandise.itemName', 'Item Name')}
              value={newItemName}
              onChangeText={setNewItemName}
              placeholder={t('director.merchandise.itemNamePlaceholder', 'e.g. School Uniform')}
            />
            <ThemedInput
              label={t('director.merchandise.itemDesc', 'Description (optional)')}
              value={newItemDesc}
              onChangeText={setNewItemDesc}
              placeholder={t('director.merchandise.itemDescPlaceholder', 'Brief description...')}
            />
            <ThemedInput
              label={`${t('director.merchandise.price', 'Price')} (${CURRENCY_SYMBOL})`}
              value={newItemPrice}
              onChangeText={setNewItemPrice}
              placeholder="0"
              keyboardType="numeric"
            />

            {/* Image picker */}
            <ThemedText variant="bodySmall" style={styles.label}>
              {t('director.merchandise.image', 'Image (optional)')}
            </ThemedText>
            <Pressable onPress={pickImage} style={[styles.imagePicker, { borderColor: theme.colors.border, borderRadius: theme.borderRadius.md }]}>
              {newItemImage ? (
                <View style={styles.imagePreviewContainer}>
                  <Image source={{ uri: newItemImage.uri }} style={styles.imagePreview} />
                  <Pressable
                    onPress={() => setNewItemImage(null)}
                    style={[styles.imageRemoveBtn, { backgroundColor: theme.colors.error }]}
                  >
                    <Ionicons name="close" size={14} color="#fff" />
                  </Pressable>
                </View>
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Ionicons name="camera-outline" size={28} color={theme.colors.textTertiary} />
                  <ThemedText variant="caption" color={theme.colors.textTertiary}>
                    {t('director.merchandise.tapToAddImage', 'Tap to add image')}
                  </ThemedText>
                </View>
              )}
            </Pressable>

            {/* Category selector */}
            <ThemedText variant="bodySmall" style={styles.label}>
              {t('director.merchandise.category', 'Category')}
            </ThemedText>
            <View style={styles.categorySelectorRow}>
              {categories.map((cat) => {
                const isActive = newItemCategoryId === cat.schoolMerchandiseCategoryId;
                return (
                  <Pressable
                    key={cat.schoolMerchandiseCategoryId}
                    onPress={() => setNewItemCategoryId(cat.schoolMerchandiseCategoryId)}
                    style={[
                      styles.categorySelectorChip,
                      {
                        backgroundColor: isActive ? theme.colors.primary : theme.colors.surface,
                        borderColor: isActive ? theme.colors.primary : theme.colors.border,
                        borderRadius: theme.borderRadius.md,
                      },
                    ]}
                  >
                    <ThemedText
                      variant="caption"
                      color={isActive ? '#fff' : theme.colors.text}
                      style={{ fontWeight: isActive ? '600' : '400' }}
                    >
                      {cat.schoolMerchandiseCategoryName}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
            {categories.length === 0 && (
              <ThemedText variant="caption" color={theme.colors.warning} style={styles.noCatWarning}>
                {t('director.merchandise.noCategoriesWarning', 'Create a category first before adding items.')}
              </ThemedText>
            )}

            <View style={styles.modalActions}>
              <ThemedButton
                title={t('common.cancel', 'Cancel')}
                variant="ghost"
                size="md"
                onPress={() => setShowItemModal(false)}
                style={styles.modalBtn}
              />
              <ThemedButton
                title={isAddingItem ? t('common.loading', 'Loading...') : t('common.save', 'Save')}
                variant="primary"
                size="md"
                onPress={handleAddItem}
                disabled={isAddingItem || categories.length === 0}
                style={styles.modalBtn}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}

// ─── Styles ─────────────────────────────────────────────────────
const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  addBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 12,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
  },
  tabIcon: { marginRight: 6 },
  tabLabel: { fontWeight: '600' },
  categoryFilterWrapper: {
    height: 44,
  },
  categoryList: {
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginRight: 8,
  },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  itemCard: { marginBottom: 10 },
  itemRow: { flexDirection: 'row', alignItems: 'center' },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  itemInfo: { flex: 1, marginRight: 8 },
  price: { fontWeight: '700' },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalContent: { width: '100%', padding: 24 },
  modalTitle: { marginBottom: 16 },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 16,
  },
  modalBtn: { minWidth: 100 },
  label: { marginBottom: 8, marginTop: 8, fontWeight: '600' },
  categorySelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categorySelectorChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    marginBottom: 4,
  },
  noCatWarning: { marginTop: 4 },
  imagePicker: {
    borderWidth: 1,
    borderStyle: 'dashed',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
  },
  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 4,
  },
  imagePreviewContainer: {
    position: 'relative',
    width: '100%',
    alignItems: 'center',
    padding: 8,
  },
  imagePreview: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  imageRemoveBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
