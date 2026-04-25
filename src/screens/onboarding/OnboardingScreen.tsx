import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import Animated, {
  SharedValue,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText, ThemedButton, LanguageSwitcher } from '../../components';
import { useAppDispatch } from '../../hooks';
import { setOnboarded } from '../../store/slices/appSlice';
import { useTheme } from '../../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Slide {
  key: string;
  titleKey: string;
  descKey: string;
  icon: keyof typeof Ionicons.glyphMap;
  gradientColors: readonly [string, string];
}

const SLIDES: Slide[] = [
  {
    key: 'fees',
    titleKey: 'onboarding.slide1Title',
    descKey: 'onboarding.slide1Desc',
    icon: 'wallet-outline',
    gradientColors: ['#4B49AC', '#7DA0FA'],
  },
  {
    key: 'notifications',
    titleKey: 'onboarding.slide2Title',
    descKey: 'onboarding.slide2Desc',
    icon: 'notifications-outline',
    gradientColors: ['#7978E9', '#7DA0FA'],
  },
  {
    key: 'payments',
    titleKey: 'onboarding.slide3Title',
    descKey: 'onboarding.slide3Desc',
    icon: 'card-outline',
    gradientColors: ['#F3797E', '#FB7185'],
  },
  {
    key: 'mwanabot',
    titleKey: 'onboarding.slide4Title',
    descKey: 'onboarding.slide4Desc',
    icon: 'chatbubble-ellipses-outline',
    gradientColors: ['#22C55E', '#3B82F6'],
  },
];

const OnboardingScreen: React.FC = () => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const dispatch = useAppDispatch();
  const router = useRouter();

  const scrollViewRef = useRef<ScrollView>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const scrollX = useSharedValue(0);

  const isLastSlide = currentPage === SLIDES.length - 1;

  const handleMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const page = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
      setCurrentPage(page);
      scrollX.value = e.nativeEvent.contentOffset.x;
    },
    [scrollX],
  );

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollX.value = e.nativeEvent.contentOffset.x;
    },
    [scrollX],
  );

  const handleNext = useCallback(() => {
    if (isLastSlide) {
      dispatch(setOnboarded(true));
      router.replace('/(auth)/sign-in');
    } else {
      const nextPage = currentPage + 1;
      scrollViewRef.current?.scrollTo({
        x: nextPage * SCREEN_WIDTH,
        animated: true,
      });
      setCurrentPage(nextPage);
    }
  }, [currentPage, isLastSlide, dispatch, router]);

  const handleSkip = useCallback(() => {
    dispatch(setOnboarded(true));
    router.replace('/(auth)/sign-in');
  }, [dispatch, router]);

  return (
    <SafeAreaView
      edges={['top', 'left', 'right', 'bottom']}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      {/* Header: Language Switcher + Skip */}
      <View style={styles.header}>
        <LanguageSwitcher compact />
        {!isLastSlide && (
          <Pressable onPress={handleSkip} hitSlop={12}>
            <ThemedText
              variant="bodySmall"
              color={theme.colors.textSecondary}
              style={styles.skipText}
            >
              {t('onboarding.skip')}
            </ThemedText>
          </Pressable>
        )}
      </View>

      {/* Slides */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={styles.scrollView}
      >
        {SLIDES.map((slide, index) => (
          <SlideItem key={slide.key} slide={slide} index={index} />
        ))}
      </ScrollView>

      {/* Bottom Section: Dots + Button */}
      <View style={styles.bottomSection}>
        <View style={styles.dotsContainer}>
          {SLIDES.map((_, index) => (
            <DotIndicator
              key={index}
              index={index}
              scrollX={scrollX}
              activeColor={theme.colors.primary}
              inactiveColor={theme.colors.disabled}
            />
          ))}
        </View>

        <ThemedButton
          title={isLastSlide ? t('onboarding.getStarted') : t('common.next')}
          onPress={handleNext}
          size="lg"
          fullWidth
          icon={
            !isLastSlide ? (
              <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
            ) : undefined
          }
        />
      </View>
    </SafeAreaView>
  );
};

/* ─── Slide Item ─── */
interface SlideItemProps {
  slide: Slide;
  index: number;
}

const SlideItem: React.FC<SlideItemProps> = ({ slide }) => {
  const { t } = useTranslation();
  const { theme } = useTheme();

  return (
    <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
      {/* Icon Area with Gradient Background */}
      <View style={styles.iconArea}>
        <LinearGradient
          colors={slide.gradientColors as unknown as [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.iconGradient}
        >
          <View style={styles.iconCircleOuter}>
            <View
              style={[
                styles.iconCircleInner,
                { backgroundColor: 'rgba(255,255,255,0.2)' },
              ]}
            >
              <Ionicons name={slide.icon} size={64} color="#FFFFFF" />
            </View>
          </View>
        </LinearGradient>

        {/* Decorative circles */}
        <View
          style={[
            styles.decorCircle,
            styles.decorCircle1,
            { backgroundColor: slide.gradientColors[0] + '15' },
          ]}
        />
        <View
          style={[
            styles.decorCircle,
            styles.decorCircle2,
            { backgroundColor: slide.gradientColors[1] + '10' },
          ]}
        />
      </View>

      {/* Text Content */}
      <View style={styles.textContent}>
        <ThemedText variant="h1" align="center" style={styles.slideTitle}>
          {t(slide.titleKey)}
        </ThemedText>
        <ThemedText
          variant="body"
          align="center"
          color={theme.colors.textSecondary}
          style={styles.slideDesc}
        >
          {t(slide.descKey)}
        </ThemedText>
      </View>
    </View>
  );
};

/* ─── Dot Indicator ─── */
interface DotIndicatorProps {
  index: number;
  scrollX: SharedValue<number>;
  activeColor: string;
  inactiveColor: string;
}

const DotIndicator: React.FC<DotIndicatorProps> = ({
  index,
  scrollX,
  activeColor,
  inactiveColor,
}) => {
  const animatedDotStyle = useAnimatedStyle(() => {
    const inputRange = [
      (index - 1) * SCREEN_WIDTH,
      index * SCREEN_WIDTH,
      (index + 1) * SCREEN_WIDTH,
    ];

    const width = interpolate(
      scrollX.value,
      inputRange,
      [8, 28, 8],
      Extrapolation.CLAMP,
    );

    const opacity = interpolate(
      scrollX.value,
      inputRange,
      [0.4, 1, 0.4],
      Extrapolation.CLAMP,
    );

    return { width, opacity };
  });

  const animatedColorStyle = useAnimatedStyle(() => {
    const inputRange = [
      (index - 1) * SCREEN_WIDTH,
      index * SCREEN_WIDTH,
      (index + 1) * SCREEN_WIDTH,
    ];

    const isActive =
      interpolate(
        scrollX.value,
        inputRange,
        [0, 1, 0],
        Extrapolation.CLAMP,
      ) > 0.5;

    return {
      backgroundColor: isActive ? activeColor : inactiveColor,
    };
  });

  return (
    <Animated.View
      style={[styles.dot, animatedDotStyle, animatedColorStyle]}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  skipText: {
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  slide: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  iconArea: {
    width: 220,
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 48,
  },
  iconGradient: {
    width: 180,
    height: 180,
    borderRadius: 90,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircleOuter: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircleInner: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  decorCircle: {
    position: 'absolute',
    borderRadius: 9999,
  },
  decorCircle1: {
    width: 240,
    height: 240,
    top: -10,
    left: -10,
    zIndex: -1,
  },
  decorCircle2: {
    width: 280,
    height: 280,
    top: -30,
    left: -30,
    zIndex: -2,
  },
  textContent: {
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  slideTitle: {
    marginBottom: 12,
  },
  slideDesc: {
    maxWidth: 300,
  },
  bottomSection: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    gap: 24,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
});

export default OnboardingScreen;
