import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { useAuth } from '../src/hooks';
import { useAppSelector } from '../src/store/store';
import { isTokenExpired } from '../src/utils/jwt';

const PRIMARY_COLOR = '#4B49AC';

export default function SplashRedirect() {
  const { isAuthenticated, token, logout } = useAuth();
  const isOnboarded = useAppSelector((state) => state.app.isOnboarded);

  const logoScale = useSharedValue(0.3);
  const logoOpacity = useSharedValue(0);
  const subtitleOpacity = useSharedValue(0);
  const subtitleTranslateY = useSharedValue(20);

  useEffect(() => {
    logoOpacity.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) });
    logoScale.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.back(1.5)) });
    subtitleOpacity.value = withDelay(
      400,
      withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) }),
    );
    subtitleTranslateY.value = withDelay(
      400,
      withTiming(0, { duration: 600, easing: Easing.out(Easing.cubic) }),
    );
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!isOnboarded) {
        router.replace('/(onboarding)');
      } else if (!isAuthenticated || (token && isTokenExpired(token))) {
        // Token expired or not authenticated - clear state and go to sign in
        if (token && isTokenExpired(token)) {
          logout();
        }
        router.replace('/(auth)/sign-in');
      } else {
        router.replace('/(app)/dashboard');
      }
    }, 2000);

    return () => clearTimeout(timeout);
  }, [isOnboarded, isAuthenticated, token, logout]);

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const subtitleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
    transform: [{ translateY: subtitleTranslateY.value }],
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.logoContainer, logoAnimatedStyle]}>
        <View style={styles.logoIcon}>
          <Animated.Text style={styles.logoLetter}>E</Animated.Text>
        </View>
        <Animated.Text style={styles.logoText}>EduFrais</Animated.Text>
      </Animated.View>
      <Animated.Text style={[styles.subtitle, subtitleAnimatedStyle]}>
        Simple. Fiable. Sécurisé.
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PRIMARY_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
  },
  logoIcon: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoLetter: {
    fontSize: 40,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
  },
  logoText: {
    fontSize: 36,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 8,
  },
});
