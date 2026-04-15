import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAppSelector } from '../store/store';
import { startNotificationHub, stopNotificationHub } from '../services/signalr/notificationHub';

/**
 * Hook that starts/stops the SignalR notification hub based on auth state
 * and push notification preference.
 * Also handles app foreground/background transitions.
 * Should be called ONCE in the app layout.
 */
export function useNotificationHub() {
  const token = useAppSelector((state) => state.auth.token);
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  const pushEnabled = useAppSelector((state) => state.app.pushNotificationsEnabled);
  const appState = useRef(AppState.currentState);

  const shouldConnect = isAuthenticated && !!token && pushEnabled;

  useEffect(() => {
    if (shouldConnect) {
      startNotificationHub();
    } else {
      stopNotificationHub();
    }

    return () => {
      stopNotificationHub();
    };
  }, [shouldConnect]);

  // Reconnect when app comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        if (shouldConnect) {
          startNotificationHub();
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [shouldConnect]);
}
