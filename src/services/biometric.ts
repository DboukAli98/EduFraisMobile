import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";

const CREDENTIALS_KEY = "edufrais_biometric_credentials";

export interface StoredCredentials {
  countryCode: string;
  mobileNumber: string;
  password: string;
}

/** Check if device supports biometric authentication */
export async function isBiometricAvailable(): Promise<boolean> {
  const compatible = await LocalAuthentication.hasHardwareAsync();
  if (!compatible) return false;
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  return enrolled;
}

/** Get the supported biometric type label (Face ID / Fingerprint) */
export async function getBiometricType(): Promise<
  "face" | "fingerprint" | null
> {
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  if (
    types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)
  ) {
    return "face";
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return "fingerprint";
  }
  return null;
}

/** Prompt the user for biometric authentication */
export async function authenticateWithBiometric(
  promptMessage: string,
): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    cancelLabel: "Cancel",
    disableDeviceFallback: false,
  });
  return result.success;
}

/** Store credentials securely after a successful password login */
export async function saveCredentials(
  credentials: StoredCredentials,
): Promise<void> {
  await SecureStore.setItemAsync(CREDENTIALS_KEY, JSON.stringify(credentials));
}

/** Retrieve stored credentials */
export async function getStoredCredentials(): Promise<StoredCredentials | null> {
  const raw = await SecureStore.getItemAsync(CREDENTIALS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredCredentials;
  } catch {
    return null;
  }
}

/** Remove stored credentials (on logout or disable biometric) */
export async function clearStoredCredentials(): Promise<void> {
  await SecureStore.deleteItemAsync(CREDENTIALS_KEY);
}
