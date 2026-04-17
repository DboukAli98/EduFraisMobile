import { useEffect, useRef } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import i18n from 'i18next';

import { useAppDispatch, useAppSelector } from '../store/store';
import { useRegisterPushTokenMutation } from '../services/api/apiSlice';
import { setPushRegistered } from '../store/slices/notificationSlice';
import { setPushNotificationsEnabled } from '../store/slices/appSlice';
import { ONESIGNAL_APP_ID } from '../constants';
import type { UserRole } from '../types';

// react-native-onesignal is a native module — it crashes Expo Go which
// has no OneSignal binary. Import lazily so the bundle still loads in
// Expo Go for any QA who doesn't yet have a dev build.
let OneSignal: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  OneSignal = require('react-native-onesignal').OneSignal;
} catch {
  OneSignal = null;
}

const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/**
 * Map our lowercase frontend roles to the case-sensitive role strings
 * the backend's RegisterDevicePushToken endpoint switches on.
 * See User.Core/Helpers/Constants/RolesConstants.cs.
 */
function mapRole(role: UserRole | undefined): string | null {
  switch (role) {
    case 'parent':
      return 'Parent';
    case 'agent':
      return 'Agent';
    case 'director':
      return 'Director';
    case 'manager':
      return 'Manager';
    case 'superadmin':
      return 'SuperAdmin';
    default:
      return null;
  }
}

let oneSignalInitialized = false;

/**
 * Initialise OneSignal once per process. Does NOT request permission —
 * that's a separate explicit step the user triggers via the settings
 * toggle or the post-login popup so we never silently surprise them
 * with a system prompt.
 */
function ensureOneSignalReady() {
  if (oneSignalInitialized || !OneSignal || isExpoGo) return;
  try {
    OneSignal.initialize(ONESIGNAL_APP_ID);
    oneSignalInitialized = true;
  } catch (err) {
    // Native module missing or failed to start — log and continue so
    // the app still works (just without push delivery).
    // eslint-disable-next-line no-console
    console.warn('[OneSignal] init failed:', err);
  }
}

/**
 * Read the current OneSignal player id (subscription id). Returns
 * null if the SDK isn't ready or the user denied permission.
 *
 * Across the v5 SDK there have been a few accessor names; try them
 * in order so we work whether you're on 5.0.x or 5.2+.
 */
function readPlayerId(): string | null {
  if (!OneSignal) return null;
  try {
    const sub = OneSignal.User?.pushSubscription;
    if (!sub) return null;
    if (typeof sub.getPushSubscriptionId === 'function') {
      return sub.getPushSubscriptionId() ?? null;
    }
    if (typeof sub.getId === 'function') {
      return sub.getId() ?? null;
    }
    if (sub.id) return sub.id;
    return null;
  } catch {
    return null;
  }
}

/**
 * Wait up to `timeoutMs` for OneSignal to publish a player id.
 * Subscribes to the SDK's change event for a fast resolve and falls
 * back to the timer so we never hang forever.
 */
function waitForPlayerId(timeoutMs: number): Promise<string | null> {
  const immediate = readPlayerId();
  if (immediate) return Promise.resolve(immediate);

  return new Promise((resolve) => {
    let resolved = false;
    const handler = (event: any) => {
      const id =
        event?.current?.id ??
        event?.current?.subscriptionId ??
        readPlayerId();
      if (id && !resolved) {
        resolved = true;
        cleanup();
        resolve(id);
      }
    };
    const cleanup = () => {
      try {
        OneSignal.User?.pushSubscription?.removeEventListener?.(
          'change',
          handler,
        );
      } catch {
        // ignore
      }
    };
    try {
      OneSignal.User?.pushSubscription?.addEventListener?.('change', handler);
    } catch {
      // SDK shape mismatch — rely on the timer below.
    }
    setTimeout(() => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve(readPlayerId());
    }, timeoutMs);
  });
}

/**
 * Result of asking the user to enable push notifications.
 *  - `unavailable`: SDK isn't loaded (Expo Go) or hard-failed.
 *  - `denied`: user explicitly declined the OS prompt — or had
 *     previously denied it, in which case iOS resolves immediately
 *     without showing a prompt and the only fix is system Settings.
 *  - `granted`: permission was granted. `playerId` is the id we got
 *     back from OneSignal (may still be `null` on first launch — the
 *     id often arrives a few seconds later via the change listener
 *     and the registration hook will POST it then).
 */
export type EnablePushResult =
  | { status: 'unavailable' }
  | { status: 'denied' }
  | { status: 'granted'; playerId: string | null };

/**
 * Imperatively request notification permission and opt the device into
 * the OneSignal subscription. Used by the settings toggle and the
 * post-login popup so the OS prompt is always tied to a user gesture.
 *
 * Always tied to a user gesture so iOS will actually present the
 * prompt the first time. On subsequent calls iOS returns the cached
 * decision instantly.
 */
export async function enableOneSignalPush(): Promise<EnablePushResult> {
  if (!OneSignal || isExpoGo) return { status: 'unavailable' };
  ensureOneSignalReady();
  try {
    const result = await OneSignal.Notifications.requestPermission(true);
    // SDK v5 resolves to a boolean. Older builds resolve to undefined
    // when they can't tell — assume granted in that case so we don't
    // false-positive a denial.
    const granted = result !== false;
    if (!granted) return { status: 'denied' };

    try {
      OneSignal.User?.pushSubscription?.optIn?.();
    } catch {
      // optIn isn't always required — some SDK builds opt-in implicitly
      // once permission is granted.
    }

    // Give the SDK up to 5 s to publish the player id. Real devices
    // often need 1–3 s on first launch (APNS/FCM handshake). iOS
    // Simulator never produces one, in which case we still return
    // `granted` with a null id — the listener inside the registration
    // hook will pick it up later if the user moves to a real device.
    const playerId = await waitForPlayerId(5000);
    return { status: 'granted', playerId };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[OneSignal] enableOneSignalPush failed:', err);
    return { status: 'unavailable' };
  }
}

/**
 * Imperatively opt the device out of OneSignal pushes. Used when the
 * user toggles push notifications OFF in settings.
 */
export function disableOneSignalPush(): void {
  if (!OneSignal || isExpoGo) return;
  try {
    OneSignal.User?.pushSubscription?.optOut?.();
  } catch {
    // ignore — older SDKs don't expose optOut
  }
}

/**
 * Hook that:
 *   1) Initialises OneSignal once on mount.
 *   2) When the user is authenticated, sends their device's player id
 *      to the backend so future SendPushAsync() calls can target them.
 *   3) Re-tries when the player id arrives asynchronously (the SDK
 *      may take a few hundred ms after init to publish one).
 *   4) Re-registers if the user logs out and a different user logs in.
 *   5) Keeps notifications.pushRegistered in redux in sync so the
 *      settings screen can mirror the actual SDK state.
 *   6) Once per login, if the device has no player id (permission
 *      never granted), surfaces a popup asking the user to enable
 *      push notifications.
 *
 * Mount this once near the app root (e.g. inside the (app) layout) —
 * mounting it twice is safe but pointless.
 */
export function useOneSignalRegistration() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  const pushEnabled = useAppSelector((state) => state.app.pushNotificationsEnabled);
  const [registerPushToken] = useRegisterPushTokenMutation();

  // Track the (userId, playerId) pair we've already pushed to the
  // backend so we don't spam the endpoint on every re-render.
  const lastSent = useRef<{ userId: string; playerId: string } | null>(null);

  // Track which user we've already shown the "enable push" popup to in
  // the current process so we don't nag on every re-render.
  const promptedFor = useRef<string | null>(null);

  // ── 1) Init OneSignal once ────────────────────────────────────
  useEffect(() => {
    ensureOneSignalReady();
  }, []);

  // ── 2) Register player id when both user and id are available ─
  useEffect(() => {
    if (!isAuthenticated || !user?.id || !OneSignal || isExpoGo) return;

    const role = mapRole(user.role);
    if (!role) return;

    const sendToBackend = async (playerId: string) => {
      // Skip if the same pair was already registered this session.
      if (
        lastSent.current &&
        lastSent.current.userId === user.id &&
        lastSent.current.playerId === playerId
      ) {
        return;
      }
      try {
        await registerPushToken({
          UserId: user.id,
          Role: role,
          DevicePushToken: playerId,
        }).unwrap();
        lastSent.current = { userId: user.id, playerId };
        dispatch(setPushRegistered(true));
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[OneSignal] RegisterDevicePushToken failed:', err);
        dispatch(setPushRegistered(false));
      }
    };

    // Try immediately — usually the id is already there a moment
    // after initialize() resolves on a returning device.
    const immediate = readPlayerId();
    if (immediate) {
      sendToBackend(immediate);
    } else {
      // Make sure stale "registered" state from a previous session is cleared.
      dispatch(setPushRegistered(false));
    }

    // Subscribe to subscription changes so we catch the first id (or
    // any later refresh, e.g. after the user re-grants permission).
    let unsubscribe: (() => void) | null = null;
    try {
      const handler = (event: any) => {
        const id =
          event?.current?.id ??
          event?.current?.subscriptionId ??
          readPlayerId();
        if (id) sendToBackend(id);
        else dispatch(setPushRegistered(false));
      };
      OneSignal.User?.pushSubscription?.addEventListener?.('change', handler);
      unsubscribe = () => {
        try {
          OneSignal.User?.pushSubscription?.removeEventListener?.(
            'change',
            handler,
          );
        } catch {
          // ignore
        }
      };
    } catch {
      // SDK shape mismatch — fall back to a one-shot timer poll so we
      // still pick up the id on first launch.
      const t = setTimeout(() => {
        const id = readPlayerId();
        if (id) sendToBackend(id);
      }, 1500);
      unsubscribe = () => clearTimeout(t);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [isAuthenticated, user?.id, user?.role, registerPushToken, dispatch]);

  // ── 3) On logout, forget the last-sent pair so the next login
  //       triggers a fresh registration even if the player id is the
  //       same physical device.
  useEffect(() => {
    if (!isAuthenticated) {
      lastSent.current = null;
      promptedFor.current = null;
      dispatch(setPushRegistered(false));
    }
  }, [isAuthenticated, dispatch]);

  // ── 4) Post-login: if the device has no player id (permission
  //       never granted, or this is a brand-new install), prompt the
  //       user once to enable push notifications. We give the SDK a
  //       short delay to publish a cached id before deciding to ask.
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;
    if (!OneSignal || isExpoGo) return;
    if (promptedFor.current === user.id) return;

    const t = setTimeout(() => {
      // If we already got a player id by now there's nothing to ask.
      if (readPlayerId()) return;
      // Don't prompt if the user has explicitly turned push off in
      // settings — respect their choice.
      if (!pushEnabled) return;
      promptedFor.current = user.id;

      Alert.alert(
        i18n.t('push.enableTitle', 'Enable Push Notifications'),
        i18n.t(
          'push.enableMessage',
          'Your device is not registered to receive push notifications. Enable them now to get real-time updates on payments and approvals.',
        ),
        [
          {
            text: i18n.t('common.notNow', 'Not now'),
            style: 'cancel',
            onPress: () => {
              // Reflect the user's choice in the settings toggle.
              dispatch(setPushNotificationsEnabled(false));
            },
          },
          {
            text: i18n.t('push.enableAction', 'Enable'),
            onPress: async () => {
              const result = await enableOneSignalPush();
              if (result.status === 'granted') {
                // Permission granted — even if the player id hasn't
                // arrived yet, the change listener in this hook will
                // pick it up and POST it, flipping pushRegistered.
                return;
              }
              dispatch(setPushNotificationsEnabled(false));
              if (result.status === 'denied') {
                Alert.alert(
                  i18n.t('push.deniedTitle', 'Permission denied'),
                  i18n.t(
                    'push.deniedMessageOpenSettings',
                    'Push notifications are blocked. Open Settings to allow them.',
                  ),
                  [
                    {
                      text: i18n.t('common.cancel', 'Cancel'),
                      style: 'cancel',
                    },
                    {
                      text: i18n.t('push.openSettings', 'Open Settings'),
                      onPress: () => {
                        Linking.openSettings().catch(() => {});
                      },
                    },
                  ],
                );
              }
              // status === 'unavailable' means SDK isn't loaded
              // (Expo Go). Silent — they'll see the toggle stay off.
            },
          },
        ],
      );
    }, 1500);

    return () => clearTimeout(t);
  }, [isAuthenticated, user?.id, pushEnabled, dispatch]);

  // Suppress an "unused" warning on Platform — keeping it imported
  // makes future per-platform branching cheap.
  void Platform;
}
