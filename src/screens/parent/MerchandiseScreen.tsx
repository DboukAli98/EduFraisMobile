import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useTheme } from '../../theme';
import { useAppSelector, useAnimatedEntry, staggerDelay } from '../../hooks';
import {
  Alert,
  ScreenContainer,
  ThemedText,
  ThemedCard,
  ThemedButton,
  EmptyState,
} from '../../components';
import {
  useGetMerchandiseCategoriesQuery,
  useGetSchoolMerchandisesQuery,
  useInitiatePaymentMutation,
} from '../../services/api/apiSlice';
import type { SchoolMerchandise, SchoolMerchandiseCategory, MerchandiseItemDto } from '../../types';
import { CURRENCY_SYMBOL, API_BASE_URL } from '../../constants';

const getImageUrl = (schoolId: string, logo?: string) => {
  if (!logo) return null;
  const baseHost = API_BASE_URL.replace(/\/api\/?$/, '');
  return `${baseHost}/uploads/merchandises/${schoolId}/${logo}`;
};

const formatCurrency = (amount: number) =>
  `${amount.toLocaleString()} ${CURRENCY_SYMBOL}`;

// ─── Cart Item ──────────────────────────────────────────────────
interface CartItem {
  merchandise: SchoolMerchandise;
  quantity: number;
}

// ─── Merchandise Card ───────────────────────────────────────────
const MerchandiseCard: React.FC<{
  item: SchoolMerchandise;
  index: number;
  cartQty: number;
  schoolId: string;
  onAdd: () => void;
  onRemove: () => void;
  onPress: () => void;
}> = ({ item, index, cartQty, schoolId, onAdd, onRemove, onPress }) => {
  const { theme } = useTheme();
  const animStyle = useAnimatedEntry({
    type: 'slideUp',
    delay: staggerDelay(index, 50),
  });
  const imageUrl = getImageUrl(schoolId, item.schoolMerchandiseLogo);

  return (
    <Animated.View style={animStyle}>
      <Pressable onPress={onPress}>
        <ThemedCard style={styles.card}>
          <View style={styles.cardContent}>
            {/* Product Image */}
            <View style={[styles.productImage, { backgroundColor: theme.colors.primaryLight + '20', borderRadius: theme.borderRadius.md }]}>
              {imageUrl ? (
                <Image source={{ uri: imageUrl }} style={styles.productImg} resizeMode="cover" />
              ) : (
                <Ionicons name="pricetag-outline" size={24} color={theme.colors.primary} />
              )}
            </View>

            <View style={styles.itemInfo}>
              <ThemedText variant="subtitle" numberOfLines={2}>
                {item.schoolMerchandiseName}
              </ThemedText>
              {item.schoolMerchandiseDescription ? (
                <ThemedText
                  variant="caption"
                  color={theme.colors.textSecondary}
                  numberOfLines={2}
                  style={styles.desc}
                >
                  {item.schoolMerchandiseDescription}
                </ThemedText>
              ) : null}
              <ThemedText
                variant="body"
                color={theme.colors.primary}
                style={styles.price}
              >
                {formatCurrency(item.schoolMerchandisePrice)}
              </ThemedText>
            </View>

            <View style={styles.qtyControls}>
              {cartQty > 0 && (
                <Pressable
                  onPress={(e) => { e.stopPropagation(); onRemove(); }}
                  style={[styles.qtyBtn, { backgroundColor: theme.colors.disabled }]}
                >
                  <Ionicons name="remove" size={18} color={theme.colors.text} />
                </Pressable>
              )}
              {cartQty > 0 && (
                <ThemedText variant="body" style={[styles.qtyText, { fontWeight: '700' }]}>
                  {cartQty}
                </ThemedText>
              )}
              <Pressable
                onPress={(e) => { e.stopPropagation(); onAdd(); }}
                style={[styles.qtyBtn, { backgroundColor: theme.colors.primary }]}
              >
                <Ionicons name="add" size={18} color="#fff" />
              </Pressable>
            </View>
          </View>
        </ThemedCard>
      </Pressable>
    </Animated.View>
  );
};

// ─── Main Screen ────────────────────────────────────────────────
export default function MerchandiseScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const user = useAppSelector((state) => state.auth.user);
  const schoolId = user?.schoolId?.split(',')[0] || '0';

  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);

  const {
    data: categoriesData,
    isLoading: categoriesLoading,
  } = useGetMerchandiseCategoriesQuery({ pageNumber: 1, pageSize: 50 });

  const {
    data: merchandiseData,
    isLoading: merchandiseLoading,
    refetch,
  } = useGetSchoolMerchandisesQuery(
    {
      schoolId,
      categoryId: selectedCategoryId ?? undefined,
      pageNumber: 1,
      pageSize: 50,
    },
    { skip: !schoolId || schoolId === '0' },
  );

  const [initiatePayment, { isLoading: isPaying }] = useInitiatePaymentMutation();

  const categories = categoriesData?.data ?? [];
  const merchandises = merchandiseData?.data ?? [];

  const cartTotal = useMemo(
    () => cart.reduce((sum, c) => sum + c.merchandise.schoolMerchandisePrice * c.quantity, 0),
    [cart],
  );

  const getCartQty = useCallback(
    (id: number) => cart.find((c) => c.merchandise.schoolMerchandiseId === id)?.quantity || 0,
    [cart],
  );

  const addToCart = useCallback((item: SchoolMerchandise) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.merchandise.schoolMerchandiseId === item.schoolMerchandiseId);
      if (existing) {
        return prev.map((c) =>
          c.merchandise.schoolMerchandiseId === item.schoolMerchandiseId
            ? { ...c, quantity: c.quantity + 1 }
            : c,
        );
      }
      return [...prev, { merchandise: item, quantity: 1 }];
    });
  }, []);

  const removeFromCart = useCallback((id: number) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.merchandise.schoolMerchandiseId === id);
      if (!existing) return prev;
      if (existing.quantity <= 1) {
        return prev.filter((c) => c.merchandise.schoolMerchandiseId !== id);
      }
      return prev.map((c) =>
        c.merchandise.schoolMerchandiseId === id
          ? { ...c, quantity: c.quantity - 1 }
          : c,
      );
    });
  }, []);

  const handleCheckout = useCallback(async () => {
    if (cart.length === 0 || !user) return;

    const merchandiseItems: MerchandiseItemDto[] = cart.map((c) => ({
      merchandiseId: c.merchandise.schoolMerchandiseId,
      quantity: c.quantity,
    }));

    const reference = `MERCH-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    try {
      const result = await initiatePayment({
        reference,
        subscriberMsisdn: user.phoneNumber,
        amount: cartTotal,
        paymentType: 'MERCHANDISEFEE',
        merchandiseItems,
        userId: user.id,
      }).unwrap();

      if (result.status === 'success' || result.status === 'Success') {
        Alert.alert(
          t('common.success', 'Success'),
          t('payments.processing', 'Payment is being processed. You will receive a prompt on your phone.'),
        );
        setCart([]);
      } else {
        Alert.alert(t('common.error', 'Error'), result.message || t('payments.paymentFailed', 'Payment failed'));
      }
    } catch (err: any) {
      Alert.alert(
        t('common.error', 'Error'),
        err?.data?.message || t('payments.paymentFailed', 'Payment failed'),
      );
    }
  }, [cart, cartTotal, user, initiatePayment, t]);

  const isLoading = categoriesLoading || merchandiseLoading;

  return (
    <ScreenContainer scrollable={false} padding={false}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <ThemedText variant="h2">
            {t('schools.merchandise', 'School Shop')}
          </ThemedText>
        </View>

        {/* Category Filters */}
        {categories.length > 0 && (
          <View style={styles.categoryFilterWrapper}>
            <FlatList
              horizontal
              data={[{ schoolMerchandiseCategoryId: 0, schoolMerchandiseCategoryName: t('payments.filter.all', 'All') } as any, ...categories]}
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
                        cat.schoolMerchandiseCategoryId === 0
                          ? null
                          : cat.schoolMerchandiseCategoryId,
                      )
                    }
                    style={[
                      styles.categoryChip,
                      {
                        backgroundColor: isActive
                          ? theme.colors.primary
                          : theme.colors.surface,
                        borderRadius: theme.borderRadius.full,
                      },
                    ]}
                  >
                    <ThemedText
                      variant="bodySmall"
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

        {/* Merchandise List */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : merchandises.length === 0 ? (
          <EmptyState
            icon="pricetag-outline"
            title={t('merchandise.empty', 'No Items Available')}
            description={t('merchandise.emptyDesc', 'No merchandise items are available for your school at this time.')}
          />
        ) : (
          <FlatList
            data={merchandises}
            keyExtractor={(item) => String(item.schoolMerchandiseId)}
            renderItem={({ item, index }) => (
              <MerchandiseCard
                item={item}
                index={index}
                cartQty={getCartQty(item.schoolMerchandiseId)}
                schoolId={schoolId}
                onAdd={() => addToCart(item)}
                onRemove={() => removeFromCart(item.schoolMerchandiseId)}
                onPress={() => router.push({
                  pathname: '/(app)/merchandise-detail',
                  params: { merchandiseId: String(item.schoolMerchandiseId), schoolId },
                })}
              />
            )}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={false}
                onRefresh={refetch}
                tintColor={theme.colors.primary}
                colors={[theme.colors.primary]}
              />
            }
          />
        )}

        {/* Cart Summary Bar */}
        {cart.length > 0 && (
          <View
            style={[
              styles.cartBar,
              {
                backgroundColor: theme.colors.primary,
                borderRadius: theme.borderRadius.lg,
              },
            ]}
          >
            <View>
              <ThemedText variant="bodySmall" color="#fff">
                {cart.reduce((s, c) => s + c.quantity, 0)} {t('merchandise.items', 'items')}
              </ThemedText>
              <ThemedText variant="body" color="#fff" style={{ fontWeight: '700' }}>
                {formatCurrency(cartTotal)}
              </ThemedText>
            </View>
            <Pressable
              onPress={handleCheckout}
              disabled={isPaying}
              style={[
                styles.checkoutBtn,
                { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: theme.borderRadius.md },
              ]}
            >
              <ThemedText variant="body" color="#fff" style={{ fontWeight: '700' }}>
                {isPaying
                  ? t('common.loading', 'Loading...')
                  : t('merchandise.checkout', 'Pay Now')}
              </ThemedText>
              <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 4 }} />
            </Pressable>
          </View>
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  categoryFilterWrapper: {
    height: 48,
    marginBottom: 4,
  },
  categoryList: {
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  card: {
    marginBottom: 12,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  productImage: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  productImg: {
    width: 56,
    height: 56,
  },
  itemInfo: {
    flex: 1,
    marginRight: 12,
  },
  desc: {
    marginTop: 4,
  },
  price: {
    marginTop: 6,
    fontWeight: '700',
  },
  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: {
    minWidth: 20,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartBar: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  checkoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
});
