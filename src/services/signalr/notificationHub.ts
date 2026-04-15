import * as signalR from '@microsoft/signalr';
import { store } from '../../store/store';
import { addNotification } from '../../store/slices/notificationSlice';
import { API_BASE_URL } from '../../constants';
import { AppNotification } from '../../types';

// Derive hub URL from API base: "http://....:5149/api" -> "http://....:5149/hubs/notifications"
const HUB_URL = API_BASE_URL.replace(/\/api\/?$/, '/hubs/notifications');

let connection: signalR.HubConnection | null = null;
let isConnecting = false;

function getToken(): string | null {
  return store.getState().auth.token;
}

export function startNotificationHub(): void {
  const token = getToken();
  if (!token || isConnecting || connection?.state === signalR.HubConnectionState.Connected) return;

  isConnecting = true;

  connection = new signalR.HubConnectionBuilder()
    .withUrl(HUB_URL, {
      accessTokenFactory: () => getToken() || '',
      // Skip negotiation for React Native (use WebSockets directly)
      skipNegotiation: true,
      transport: signalR.HttpTransportType.WebSockets,
    })
    .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
    .configureLogging(signalR.LogLevel.Warning)
    .build();

  // Keep-alive: send ping every 15s, tolerate 60s server silence
  connection.keepAliveIntervalInMilliseconds = 15_000;
  connection.serverTimeoutInMilliseconds = 60_000;

  // Listen for real-time notifications
  connection.on('ReceiveNotification', (notification: AppNotification) => {
    store.dispatch(addNotification(notification));
  });

  connection.onreconnecting((error) => {
    console.log('[SignalR] Reconnecting...', error?.message);
  });

  connection.onreconnected((connectionId) => {
    console.log('[SignalR] Reconnected:', connectionId);
  });

  connection.onclose((error) => {
    console.log('[SignalR] Connection closed', error?.message);
    isConnecting = false;
  });

  connection
    .start()
    .then(() => {
      console.log('[SignalR] Connected to notification hub');
      isConnecting = false;
    })
    .catch((err) => {
      console.error('[SignalR] Connection failed:', err);
      isConnecting = false;
    });
}

export function stopNotificationHub(): void {
  if (connection) {
    connection.stop().catch(() => {});
    connection = null;
  }
  isConnecting = false;
}

export function getConnectionState(): signalR.HubConnectionState | null {
  return connection?.state ?? null;
}
