import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  Pressable,
  Dimensions,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter, useLocalSearchParams } from 'expo-router';

import {
  Alert,
  ScreenContainer,
  ThemedText,
  ThemedCard,
  ThemedButton,
  CommissionBreakdownCard,
} from '../../components';
import { useTheme } from '../../theme';
import { useAnimatedEntry, staggerDelay, useAppSelector } from '../../hooks';
import {
  useGetMerchandiseByIdQuery,
  useGetMerchandiseCategoriesQuery,
  useInitiatePaymentMutation,
} from '../../services/api/apiSlice';
import { CURRENCY_SYMBOL, API_BASE_URL } from '../../constants';
import { generatePaymentReference } from '../../utils';
import type { MerchandiseItemDto } from '../../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMAGE_HEIGHT = SCREEN_WIDTH * 0.75;

const formatCurrency = (amount: number) =>
  `${amount.toLocaleString()} ${CURRENCY_SYMBOL}`;

const getImageUrl = (schoolId: string, logo?: string) => {
  if (!logo) return null;
  const baseHost = API_BASE_URL.replace(/\/api\/?$/, '');
  return `${baseHost}/uploads/merchandises/${schoolId}/${logo}`;
};

export default function MerchandiseDetailScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const user = useAppSelector((state) => state.auth.user);
  const params = useLocalSearchParams<{ merchandiseId: string; schoolId?: string }>();
  const merchandiseId = parseInt(params.merchandiseId || '0');
  const schoolId = params.schoolId || user?.schoolId?.split(',')[0] || '0';

  const [quantity, setQuantity] = useState(1);

  const {
    data: merchandiseData,
    isLoading,
    refetch,
  } = useGetMerchandiseByIdQuery(
    { merchandiseId },
    { skip: !merchandiseId },
  );

  const {
    data: categoriesData,
  } = useGetMerchandiseCategoriesQuery({ pageNumber: 1, pageSize: 50 });

  const [initiatePayment, { isLoading: isPaying }] = useInitiatePaymentMutation();

  const item = merchandiseData?.data;
  const categories = categoriesData?.data ?? [];
  const category = useMemo(
    () => categories.find((c) => c.schoolMerchandiseCategoryId === item?.fK_SchoolMerchandiseCategory),
    [categories, item],
  );

  const imageUrl = item ? getImageUrl(schoolId, item.schoolMerchandiseLogo) : null;
  const totalPrice = (item?.schoolMerchandisePrice ?? 0) * quantity;

  const headerAnim = useAnimatedEntry({ type: 'slideUp', delay: staggerDelay(0) });
  const imageAnim = useAnimatedEntry({ type: 'fadeIn', delay: staggerDelay(1) });
  const infoAnim = useAnimatedEntry({ type: 'slideUp', delay: staggerDelay(2) });
  const actionAnim = useAnimatedEntry({ type: 'slideUp', delay: staggerDelay(3) });

  const handleBuyNow = useCallback(() => {
    if (!item || !user) return;

    Alert.alert(
      t('merchandiseDetail.confirmPurchaseTitle', 'Confirm purchase'),
      t(
        'merchandiseDetail.confirmPurchaseMessage',
        'Buy {{quantity}} item(s) for {{amount}} via Airtel Money?',
        { quantity, amount: formatCurrency(totalPrice) },
      ),
      [
        {
          text: t('common.cancel', 'Cancel'),
          style: 'cancel',
        },
        {
          text: t('merchandiseDetail.confirmPurchase', 'Buy'),
          onPress: async () => {
            const merchandiseItems: MerchandiseItemDto[] = [{
              merchandiseId: item.schoolMerchandiseId,
              quantity,
            }];

            // Airtel ESB validates reference as [A-Za-z0-9]{4,64}; we use a
            // 4-char alphanumeric generator to match Digipay UAT expectations.
            const reference = generatePaymentReference();

            try {
              const result = await initiatePayment({
                reference,
                subscriberMsisdn: user.phoneNumber,
                amount: totalPrice,
                paymentType: 'MERCHANDISEFEE',
                merchandiseItems,
                userId: user.id,
              }).unwrap();

              if (result.status === 'success' || result.status === 'Success') {
                setQuantity(1);
                // Hand off to the shared sleek payment-success screen, which will
                // poll CheckPaymentStatus and reveal the final outcome.
                router.push({
                  pathname: '/payment-success',
                  params: {
                    reference,
                    amount: String(totalPrice),
                    type: 'merchandisefee',
                  },
                } as any);
              } else {
                Alert.alert(t('common.error', 'Error'), result.message || t('payments.paymentFailed', 'Payment failed'));
              }
            } catch (err: any) {
              Alert.alert(
                t('common.error', 'Error'),
                err?.data?.message || t('payments.paymentFailed', 'Payment failed'),
              );
            }
          },
        },
      ],
    );
  }, [item, quantity, totalPrice, user, initiatePayment, router, t]);

  if (isLoading) {
    return (
      <ScreenContainer>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  if (!item) {
    return (
      <ScreenContainer>
        <View style={styles.loadingContainer}>
          <Pressable onPress={() => router.back()} style={styles.backBtnAbsolute}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </Pressable>
          <ThemedText variant="body" color={theme.colors.textSecondary}>
            {t('merchandiseDetail.notFound', 'Item not found')}
          </ThemedText>
        </View>
      </ScreenContainer>
    );
  }

  const isParent = user?.role === 'parent';

  return (
    <ScreenContainer scrollable={false} padding={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={refetch} tintColor={theme.colors.primary} colors={[theme.colors.primary]} />
        }
      >
        {/* Back Button */}
        <Animated.View style={[styles.header, headerAnim]}>
          <Pressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.full }]}>
            <Ionicons name="arrow-back" size={22} color={theme.colors.text} />
          </Pressable>
        </Animated.View>

        {/* Product Image */}
        <Animated.View style={imageAnim}>
          <View style={[styles.imageContainer, { backgroundColor: theme.colors.primaryLight + '15' }]}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.productImage} resizeMode="contain" />
            ) : (
              <View style={styles.placeholderImage}>
                <Ionicons name="pricetag-outline" size={64} color={theme.colors.primary + '40'} />
              </View>
            )}
          </View>
        </Animated.View>

        {/* Product Info */}
        <Animated.View style={[styles.infoSection, infoAnim]}>
          {/* Category Badge */}
          {category && (
            <View style={[styles.categoryBadge, { backgroundColor: theme.colors.primary, borderRadius: theme.borderRadius.sm }]}>
              <ThemedText variant="caption" color="#FFFFFF" style={{ fontWeight: '600' }}>
                {category.schoolMerchandiseCategoryName}
              </ThemedText>
            </View>
          )}

          {/* Name */}
          <ThemedText variant="h2" style={styles.productName}>
            {item.schoolMerchandiseName}
          </ThemedText>

          {/* Price */}
          <ThemedText variant="h2" color={theme.colors.primary} style={styles.productPrice}>
            {formatCurrency(item.schoolMerchandisePrice)}
          </ThemedText>

          {/* Description */}
          {item.schoolMerchandiseDescription ? (
            <ThemedCard style={styles.descCard}>
              <ThemedText variant="subtitle" style={styles.descTitle}>
                {t('merchandiseDetail.description', 'Description')}
              </ThemedText>
              <ThemedText variant="body" color={theme.colors.textSecondary} style={styles.descText}>
                {item.schoolMerchandiseDescription}
              </ThemedText>
            </ThemedCard>
          ) : null}

          {/* Details Card */}
          <ThemedCard style={styles.detailsCard}>
            <ThemedText variant="subtitle" style={styles.descTitle}>
              {t('merchandiseDetail.details', 'Details')}
            </ThemedText>
            <View style={styles.detailRow}>
              <View style={[styles.detailIcon, { backgroundColor: theme.colors.primaryLight + '20' }]}>
                <Ionicons name="folder-outline" size={16} color={theme.colors.primary} />
              </View>
              <ThemedText variant="caption" color={theme.colors.textSecondary} style={styles.detailLabel}>
                {t('merchandiseDetail.category', 'Category')}
              </ThemedText>
              <ThemedText variant="body" style={styles.detailValue}>
                {category?.schoolMerchandiseCategoryName || '—'}
              </ThemedText>
            </View>
            <View style={styles.detailRow}>
              <View style={[styles.detailIcon, { backgroundColor: theme.colors.primaryLight + '20' }]}>
                <Ionicons name="checkmark-circle-outline" size={16} color={theme.colors.primary} />
              </View>
              <ThemedText variant="caption" color={theme.colors.textSecondary} style={styles.detailLabel}>
                {t('merchandiseDetail.status', 'Status')}
              </ThemedText>
              <View style={[styles.statusBadge, { backgroundColor: theme.colors.success }]}>
                <ThemedText variant="caption" color="#FFFFFF" style={{ fontWeight: '600' }}>
                  {t('merchandiseDetail.available', 'Available')}
                </ThemedText>
              </View>
            </View>
          </ThemedCard>

          {/* Fee breakdown — parents see the platform + provider cut of what
              they're charged. Driven by the current quantity so it stays in
              sync with the Buy button total. */}
          {isParent && totalPrice > 0 && (
            <CommissionBreakdownCard
              grossAmount={totalPrice}
              providerCode="AirtelMoney"
              audience="parent"
            />
          )}

          {/* Purchase card — inline so it never overlaps content or the tab bar. */}
          {isParent && (
            <Animated.View style={[styles.inlineCheckoutPanel, actionAnim]}>
              <View
                style={[
                  styles.checkoutPanel,
                  {
                    backgroundColor: theme.colors.card,
                    borderColor: theme.colors.borderLight,
                    borderRadius: theme.borderRadius.lg,
                    ...theme.shadows.lg,
                  },
                ]}
              >
                <View style={styles.checkoutTopRow}>
                  <View style={styles.checkoutTotalBlock}>
                    <ThemedText variant="caption" color={theme.colors.textSecondary}>
                      {t('merchandiseDetail.total', 'Total')}
                    </ThemedText>
                    <ThemedText variant="subtitle" color={theme.colors.primary} style={styles.checkoutTotal}>
                      {formatCurrency(totalPrice)}
                    </ThemedText>
                  </View>

                  <View
                    style={[
                      styles.quantityRow,
                      {
                        backgroundColor: theme.colors.inputBackground,
                        borderColor: theme.colors.borderLight,
                        borderRadius: theme.borderRadius.full,
                      },
                    ]}
                  >
                    <Pressable
                      onPress={() => setQuantity((q) => Math.max(1, q - 1))}
                      style={[
                        styles.qtyBtn,
                        {
                          backgroundColor: quantity > 1 ? theme.colors.surface : 'transparent',
                          borderRadius: theme.borderRadius.full,
                          opacity: quantity > 1 ? 1 : 0.45,
                        },
                      ]}
                    >
                      <Ionicons name="remove" size={18} color={theme.colors.text} />
                    </Pressable>
                    <ThemedText variant="subtitle" style={styles.qtyText}>
                      {quantity}
                    </ThemedText>
                    <Pressable
                      onPress={() => setQuantity((q) => q + 1)}
                      style={[styles.qtyBtn, { backgroundColor: theme.colors.primary, borderRadius: theme.borderRadius.full }]}
                    >
                      <Ionicons name="add" size={18} color="#fff" />
                    </Pressable>
                  </View>
                </View>

                <Pressable
                  onPress={handleBuyNow}
                  disabled={isPaying}
                  style={[
                    styles.buyBtn,
                    {
                      backgroundColor: theme.colors.primary,
                      borderRadius: theme.borderRadius.lg,
                      opacity: isPaying ? 0.78 : 1,
                    },
                  ]}
                >
                  <View style={[styles.buyIconBubble, { backgroundColor: 'rgba(255,255,255,0.16)' }]}>
                    <Ionicons name={isPaying ? 'hourglass-outline' : 'cart-outline'} size={18} color="#fff" />
                  </View>
                  <ThemedText variant="button" color="#fff" style={styles.buyMainText} numberOfLines={1}>
                    {isPaying ? t('common.loading', 'Loading...') : t('merchandiseDetail.buyNow', 'Buy Now')}
                  </ThemedText>
                </Pressable>
              </View>
            </Animated.View>
          )}
        </Animated.View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    position: 'absolute',
    top: 16,
    left: 16,
    zIndex: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  backBtnAbsolute: {
    position: 'absolute',
    top: 16,
    left: 16,
  },
  imageContainer: {
    width: SCREEN_WIDTH,
    height: IMAGE_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productImage: {
    width: SCREEN_WIDTH,
    height: IMAGE_HEIGHT,
  },
  placeholderImage: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  infoSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 12,
  },
  productName: {
    marginBottom: 8,
  },
  productPrice: {
    fontWeight: '800',
    marginBottom: 20,
  },
  descCard: {
    marginBottom: 12,
  },
  descTitle: {
    marginBottom: 8,
  },
  descText: {
    lineHeight: 22,
  },
  detailsCard: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  detailIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  detailLabel: {
    flex: 1,
  },
  detailValue: {
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  inlineCheckoutPanel: {
    marginTop: 12,
    marginBottom: 28,
  },
  checkoutPanel: {
    borderWidth: StyleSheet.hairlineWidth,
    padding: 10,
  },
  checkoutTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  checkoutTotalBlock: {
    flex: 1,
    marginRight: 12,
  },
  checkoutTotal: {
    marginTop: 1,
    fontWeight: '800',
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 5,
    paddingVertical: 5,
    gap: 6,
  },
  qtyBtn: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: {
    minWidth: 24,
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 16,
  },
  buyBtn: {
    minHeight: 46,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  buyIconBubble: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  buyMainText: {
    fontWeight: '700',
  },
});
