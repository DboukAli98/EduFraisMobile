import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  withRepeat,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter, useLocalSearchParams } from 'expo-router';

import {
  ScreenContainer,
  ThemedText,
  ThemedCard,
  ThemedButton,
} from '../../components';
import { useTheme } from '../../theme';
import { useLazyCheckPaymentStatusQuery } from '../../services/api/apiSlice';
import { formatCurrency } from '../../utils';

// Backend status codes
const STATUS_PENDING = 11;
const STATUS_SUCCESS = 8;
const STATUS_FAILED = 10;

type ScreenState = 'pending' | 'success' | 'failed';

/**
 * Modern, celebratory payment-success screen shown to parents and
 * collecting agents after a payment has been initiated.
 *
 * Behaviour:
 *   - Opens in "pending" state immediately after the client calls
 *     `/payments/collect`.
 *   - Polls `CheckPaymentStatus` every 3 s (up to 2 minutes).
 *   - Transitions to "success" (congrats + checkmark burst) or
 *     "failed" (error + retry CTA) based on the backend status.
 *
 * Route params:
 *   reference       — transaction reference used in the initiate call
 *   amount          — gross amount charged (FCFA)
 *   type            — 'schoolfee' | 'merchandisefee'
 *   installmentId?  — for linking to the receipt on success
 *   childName?      — to display a personalised message
 *   backTo?         — pathname to navigate back to on completion
 */
const PaymentSuccessScreen: React.FC = () => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{
    reference?: string;
    amount?: string;
    type?: string;
    installmentId?: string;
    childName?: string;
    backTo?: string;
  }>();

  const reference = String(params.reference || '');
  const amount = Number(params.amount || 0);
  const type = String(params.type || 'schoolfee');
  const childName = String(params.childName || '');

  const [state, setState] = useState<ScreenState>('pending');
  const [attempts, setAttempts] = useState(0);

  const [checkStatus] = useLazyCheckPaymentStatusQuery();

  // ---------- polling ----------
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!reference) {
      setState('failed');
      return;
    }

    let cancelled = false;
    const maxAttempts = 40; // 40 × 3s ≈ 2 min

    const tick = async (n: number) => {
      if (cancelled) return;
      try {
        const res = await checkStatus({ transactionId: reference }).unwrap();
        const statusId =
          (res as any)?.data?.fK_StatusId ??
          (res as any)?.fK_StatusId ??
          (res as any)?.statusId ??
          (res as any)?.data?.statusId;

        if (statusId === STATUS_SUCCESS) {
          if (!cancelled) setState('success');
          return;
        }
        if (statusId === STATUS_FAILED) {
          if (!cancelled) setState('failed');
          return;
        }
      } catch {
        // Network hiccup — keep trying until we hit maxAttempts.
      }

      if (n >= maxAttempts) {
        if (!cancelled) setState('failed');
        return;
      }
      setAttempts(n + 1);
      pollRef.current = setTimeout(() => tick(n + 1), 3000);
    };

    tick(0);
    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [reference, checkStatus, stopPolling]);

  // ---------- Animations ----------
  const pulse = useSharedValue(0);
  const badgeScale = useSharedValue(0.4);
  const badgeOpacity = useSharedValue(0);
  const contentFade = useSharedValue(0);

  useEffect(() => {
    if (state === 'pending') {
      pulse.value = withRepeat(withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }), -1, true);
    } else {
      pulse.value = withTiming(0, { duration: 300 });
      badgeScale.value = withSequence(
        withTiming(0.4, { duration: 0 }),
        withSpring(1.08, { damping: 10, stiffness: 140 }),
        withSpring(1, { damping: 14, stiffness: 160 }),
      );
      badgeOpacity.value = withTiming(1, { duration: 400 });
      contentFade.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) });
    }
  }, [state, pulse, badgeScale, badgeOpacity, contentFade]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pulse.value, [0, 1], [1, 1.15]) }],
    opacity: interpolate(pulse.value, [0, 1], [0.9, 0.55]),
  }));

  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: badgeScale.value }],
    opacity: badgeOpacity.value,
  }));

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentFade.value,
    transform: [{ translateY: interpolate(contentFade.value, [0, 1], [20, 0]) }],
  }));

  // ---------- Copy ----------
  const title = useMemo(() => {
    if (state === 'success') return t('payment.success.title', 'Paiement réussi !');
    if (state === 'failed') return t('payment.success.failedTitle', 'Paiement échoué');
    return t('payment.success.pendingTitle', 'Paiement en cours…');
  }, [state, t]);

  const subtitle = useMemo(() => {
    if (state === 'success') {
      return childName
        ? t('payment.success.subtitleNamed', 'Merci ! Votre paiement pour {{name}} a bien été confirmé.', { name: childName })
        : t('payment.success.subtitle', 'Merci ! Votre paiement a bien été confirmé.');
    }
    if (state === 'failed') {
      return t(
        'payment.success.failedSubtitle',
        "Nous n'avons pas pu confirmer votre paiement. Veuillez réessayer ou contacter le support.",
      );
    }
    return t(
      'payment.success.pendingSubtitle',
      'Confirmez la demande sur votre téléphone. Nous mettons à jour automatiquement.',
    );
  }, [state, childName, t]);

  // ---------- Colours ----------
  const accent = state === 'success'
    ? theme.colors.success
    : state === 'failed'
      ? theme.colors.error
      : theme.colors.primary;

  const iconName: keyof typeof Ionicons.glyphMap =
    state === 'success' ? 'checkmark-circle' : state === 'failed' ? 'close-circle' : 'time';

  // ---------- Navigation ----------
  const goBackHome = useCallback(() => {
    stopPolling();
    if (params.backTo) {
      router.replace(params.backTo as any);
      return;
    }
    // Defaults: parent → payments tab, agent → dashboard.
    router.replace('/(app)/dashboard' as any);
  }, [router, params.backTo, stopPolling]);

  const goReceipt = useCallback(() => {
    stopPolling();
    if (!params.installmentId) {
      goBackHome();
      return;
    }
    router.replace({
      pathname: '/payment-invoice',
      params: {
        installmentId: String(params.installmentId),
        type: type === 'merchandisefee' ? 'merchandisefee' : 'schoolfee',
      },
    } as any);
  }, [router, params.installmentId, type, goBackHome, stopPolling]);

  // ---------- Render ----------
  return (
    <ScreenContainer>
      {/* Top area with animated badge */}
      <View style={styles.badgeArea}>
        {/* Pulsing halo (pending only) */}
        {state === 'pending' && (
          <Animated.View style={[styles.halo, { backgroundColor: accent + '22' }, pulseStyle]} />
        )}

        <Animated.View style={[styles.badgeOuter, badgeStyle]}>
          <LinearGradient
            colors={
              state === 'success'
                ? [theme.colors.success, theme.colors.successLight || theme.colors.success]
                : state === 'failed'
                  ? [theme.colors.error, theme.colors.errorLight || theme.colors.error]
                  : (theme.colors.gradient?.primary as readonly [string, string, ...string[]]) ||
                    [theme.colors.primary, theme.colors.primary]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.badgeInner}
          >
            <Ionicons name={iconName} size={72} color="#FFFFFF" />
          </LinearGradient>
        </Animated.View>
      </View>

      {/* Title + subtitle */}
      <Animated.View style={contentStyle}>
        <ThemedText variant="h1" align="center" style={styles.title}>
          {title}
        </ThemedText>
        <ThemedText
          variant="body"
          color={theme.colors.textSecondary}
          align="center"
          style={styles.subtitle}
        >
          {subtitle}
        </ThemedText>
      </Animated.View>

      {/* Amount card (success + pending) */}
      {state !== 'failed' && amount > 0 && (
        <Animated.View style={contentStyle}>
          <ThemedCard variant="elevated" style={styles.amountCard}>
            <ThemedText variant="caption" color={theme.colors.textSecondary} align="center">
              {t('payment.success.amountLabel', 'Montant')}
            </ThemedText>
            <ThemedText
              variant="display"
              color={accent}
              align="center"
              style={styles.amountValue}
            >
              {formatCurrency(amount)}
            </ThemedText>
            {!!reference && (
              <ThemedText
                variant="caption"
                color={theme.colors.textTertiary}
                align="center"
                style={styles.referenceLabel}
              >
                {t('payment.success.referenceLabel', 'Référence')}: {reference}
              </ThemedText>
            )}
          </ThemedCard>
        </Animated.View>
      )}

      {/* Pending progress hint */}
      {state === 'pending' && (
        <View style={styles.progressRow}>
          <ThemedText variant="caption" color={theme.colors.textTertiary} align="center">
            {t('payment.success.pendingAttempts', 'Vérification… ({{attempt}}/40)', { attempt: attempts })}
          </ThemedText>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        {state === 'success' && (
          <>
            {!!params.installmentId && (
              <ThemedButton
                title={t('payment.success.viewReceipt', 'Voir le reçu')}
                onPress={goReceipt}
                variant="primary"
                size="lg"
                fullWidth
                icon={<Ionicons name="document-text-outline" size={20} color="#FFFFFF" />}
              />
            )}
            <ThemedButton
              title={t('payment.success.backHome', "Retour à l'accueil")}
              onPress={goBackHome}
              variant="secondary"
              size="lg"
              fullWidth
              style={styles.secondaryBtn}
            />
          </>
        )}

        {state === 'failed' && (
          <>
            <ThemedButton
              title={t('payment.success.tryAgain', 'Réessayer')}
              onPress={() => router.back()}
              variant="primary"
              size="lg"
              fullWidth
              icon={<Ionicons name="refresh" size={20} color="#FFFFFF" />}
            />
            <ThemedButton
              title={t('payment.success.backHome', "Retour à l'accueil")}
              onPress={goBackHome}
              variant="secondary"
              size="lg"
              fullWidth
              style={styles.secondaryBtn}
            />
          </>
        )}

        {state === 'pending' && (
          <Pressable onPress={goBackHome} style={styles.continueLink} hitSlop={8}>
            <ThemedText variant="body" color={theme.colors.primary}>
              {t('payment.success.continueInBackground', 'Continuer en arrière-plan')}
            </ThemedText>
          </Pressable>
        )}
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  badgeArea: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    marginBottom: 16,
    height: 200,
  },
  halo: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
  },
  badgeOuter: {
    width: 140,
    height: 140,
    borderRadius: 70,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  badgeInner: {
    flex: 1,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '700',
  },
  subtitle: {
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 12,
    lineHeight: 22,
  },
  amountCard: {
    marginTop: 20,
    paddingVertical: 20,
  },
  amountValue: {
    marginTop: 4,
    fontWeight: '800',
  },
  referenceLabel: {
    marginTop: 8,
  },
  progressRow: {
    marginTop: 16,
    alignItems: 'center',
  },
  actions: {
    marginTop: 'auto',
    paddingTop: 24,
    paddingBottom: 12,
  },
  secondaryBtn: {
    marginTop: 10,
  },
  continueLink: {
    alignItems: 'center',
    paddingVertical: 12,
  },
});

export default PaymentSuccessScreen;
