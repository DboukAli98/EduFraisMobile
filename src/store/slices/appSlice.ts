import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { UserRole } from '../../types';

interface AppState {
  themeMode: 'light' | 'dark' | 'system';
  language: 'en' | 'fr';
  isOnboarded: boolean;
  selectedRole: UserRole | null;
}

const initialState: AppState = {
  themeMode: 'system',
  language: 'en',
  isOnboarded: false,
  selectedRole: null,
};

const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    setThemeMode(state, action: PayloadAction<'light' | 'dark' | 'system'>) {
      state.themeMode = action.payload;
    },
    setLanguage(state, action: PayloadAction<'en' | 'fr'>) {
      state.language = action.payload;
    },
    setOnboarded(state, action: PayloadAction<boolean>) {
      state.isOnboarded = action.payload;
    },
    setSelectedRole(state, action: PayloadAction<UserRole | null>) {
      state.selectedRole = action.payload;
    },
  },
});

export const { setThemeMode, setLanguage, setOnboarded, setSelectedRole } = appSlice.actions;
export default appSlice.reducer;
