import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { AppNotification } from '../../types';

interface NotificationState {
  notifications: AppNotification[];
  unreadCount: number;
  /**
   * Whether the device has successfully registered an OneSignal player id
   * with the backend for the *currently signed-in user*. Cleared on
   * logout. Lives here (not in `app`) because it's runtime-only — we
   * don't want it persisted across app reinstalls or device wipes
   * where the player id is no longer valid.
   */
  pushRegistered: boolean;
}

const initialState: NotificationState = {
  notifications: [],
  unreadCount: 0,
  pushRegistered: false,
};

const notificationSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    setNotifications(state, action: PayloadAction<AppNotification[]>) {
      state.notifications = action.payload;
      state.unreadCount = action.payload.filter((n) => !n.isRead).length;
    },
    addNotification(state, action: PayloadAction<AppNotification>) {
      state.notifications.unshift(action.payload);
      if (!action.payload.isRead) {
        state.unreadCount += 1;
      }
    },
    markAsRead(state, action: PayloadAction<number>) {
      const notification = state.notifications.find((n) => n.notificationId === action.payload);
      if (notification && !notification.isRead) {
        notification.isRead = true;
        state.unreadCount = Math.max(0, state.unreadCount - 1);
      }
    },
    markAllRead(state) {
      state.notifications.forEach((n) => {
        n.isRead = true;
      });
      state.unreadCount = 0;
    },
    clearNotifications(state) {
      state.notifications = [];
      state.unreadCount = 0;
    },
    setPushRegistered(state, action: PayloadAction<boolean>) {
      state.pushRegistered = action.payload;
    },
  },
});

export const {
  setNotifications,
  addNotification,
  markAsRead,
  markAllRead,
  clearNotifications,
  setPushRegistered,
} = notificationSlice.actions;
export default notificationSlice.reducer;
