import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { UserRole } from "../../types";

interface AppState {
  themeMode: "light" | "dark" | "system";
  language: "en" | "fr";
  isOnboarded: boolean;
  selectedRole: UserRole | null;
  pushNotificationsEnabled: boolean;
  emailNotificationsEnabled: boolean;
  biometricEnabled: boolean;
}

const initialState: AppState = {
  themeMode: "system",
  language: "en",
  isOnboarded: false,
  selectedRole: null,
  pushNotificationsEnabled: true,
  emailNotificationsEnabled: true,
  biometricEnabled: false,
};

const appSlice = createSlice({
  name: "app",
  initialState,
  reducers: {
    setThemeMode(state, action: PayloadAction<"light" | "dark" | "system">) {
      state.themeMode = action.payload;
    },
    setLanguage(state, action: PayloadAction<"en" | "fr">) {
      state.language = action.payload;
    },
    setOnboarded(state, action: PayloadAction<boolean>) {
      state.isOnboarded = action.payload;
    },
    setSelectedRole(state, action: PayloadAction<UserRole | null>) {
      state.selectedRole = action.payload;
    },
    setPushNotificationsEnabled(state, action: PayloadAction<boolean>) {
      state.pushNotificationsEnabled = action.payload;
    },
    setEmailNotificationsEnabled(state, action: PayloadAction<boolean>) {
      state.emailNotificationsEnabled = action.payload;
    },
    setBiometricEnabled(state, action: PayloadAction<boolean>) {
      state.biometricEnabled = action.payload;
    },
  },
});

export const {
  setThemeMode,
  setLanguage,
  setOnboarded,
  setSelectedRole,
  setPushNotificationsEnabled,
  setEmailNotificationsEnabled,
  setBiometricEnabled,
} = appSlice.actions;
export default appSlice.reducer;
