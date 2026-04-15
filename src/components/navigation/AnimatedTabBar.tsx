import React, { useRef, useCallback } from 'react';
import { View, Pressable, StyleSheet, Platform, ScrollView, useWindowDimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withTiming,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import ThemedText from '../common/ThemedText';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

const MAX_COMFORTABLE_TABS = 5;
const MIN_TAB_WIDTH = 72;

const AnimatedTabBar: React.FC<BottomTabBarProps> = ({
  state,
  descriptors,
  navigation,
}) => {
  const { theme } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);

  // Build visible tabs
  const visibleTabs = state.routes.filter((route) => {
    const { options } = descriptors[route.key];
    const itemStyle = options.tabBarItemStyle as any;
    if (itemStyle?.display === 'none') return false;
    if (options.tabBarButton && typeof options.tabBarButton === 'function') {
      const rendered = (options.tabBarButton as any)({ children: null });
      if (rendered === null) return false;
    }
    return true;
  });

  const needsScroll = visibleTabs.length > MAX_COMFORTABLE_TABS;
  const tabWidth = needsScroll
    ? Math.max(MIN_TAB_WIDTH, screenWidth / MAX_COMFORTABLE_TABS)
    : undefined;

  // Auto-scroll to focused tab
  const handleScrollToFocused = useCallback(() => {
    if (!needsScroll || !scrollRef.current || !tabWidth) return;
    const focusedRoute = state.routes[state.index];
    const visibleIndex = visibleTabs.findIndex((r) => r.key === focusedRoute.key);
    if (visibleIndex < 0) return;
    const offset = visibleIndex * tabWidth - (screenWidth - tabWidth) / 2;
    scrollRef.current.scrollTo({ x: Math.max(0, offset), animated: true });
  }, [needsScroll, tabWidth, state.index, state.routes, visibleTabs, screenWidth]);

  React.useEffect(() => {
    handleScrollToFocused();
  }, [handleScrollToFocused]);

  const renderTabs = () =>
    state.routes.map((route, index) => {
      const { options } = descriptors[route.key];

      const itemStyle = options.tabBarItemStyle as any;
      if (itemStyle?.display === 'none') return null;
      if (options.tabBarButton && typeof options.tabBarButton === 'function') {
        const rendered = (options.tabBarButton as any)({ children: null });
        if (rendered === null) return null;
      }

      const label = (options.tabBarLabel ?? options.title ?? route.name) as string;
      const isFocused = state.index === index;

      // Get the tabBarIcon render function
      const tabBarIconFn = options.tabBarIcon as any;

      const onPress = () => {
        const event = navigation.emit({
          type: 'tabPress',
          target: route.key,
          canPreventDefault: true,
        });

        if (!isFocused && !event.defaultPrevented) {
          navigation.navigate(route.name, route.params);
        }
      };

      const onLongPress = () => {
        navigation.emit({
          type: 'tabLongPress',
          target: route.key,
        });
      };

      return (
        <TabItem
          key={route.key}
          label={label}
          tabBarIconFn={tabBarIconFn}
          isFocused={isFocused}
          onPress={onPress}
          onLongPress={onLongPress}
          fixedWidth={tabWidth}
        />
      );
    });

  return (
    <View style={{ backgroundColor: theme.colors.background }}>
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.colors.tabBar,
            borderTopLeftRadius: theme.borderRadius.xl,
            borderTopRightRadius: theme.borderRadius.xl,
            ...theme.shadows.lg,
          },
        ]}
      >
        {needsScroll ? (
          <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {renderTabs()}
          </ScrollView>
        ) : (
          renderTabs()
        )}
      </View>
    </View>
  );
};

interface TabItemProps {
  label: string;
  tabBarIconFn?: (props: { focused: boolean; color: string; size: number }) => React.ReactNode;
  isFocused: boolean;
  onPress: () => void;
  onLongPress: () => void;
  fixedWidth?: number;
}

const TabItem: React.FC<TabItemProps> = ({
  label,
  tabBarIconFn,
  isFocused,
  onPress,
  onLongPress,
  fixedWidth,
}) => {
  const { theme } = useTheme();

  const animatedIconStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: withSpring(isFocused ? 1.1 : 1, {
          damping: 15,
          stiffness: 150,
        }),
      },
    ],
  }));

  const animatedIndicatorStyle = useAnimatedStyle(() => ({
    opacity: withTiming(isFocused ? 1 : 0, { duration: 200 }),
    transform: [
      {
        scaleX: withSpring(isFocused ? 1 : 0, {
          damping: 15,
          stiffness: 200,
        }),
      },
    ],
  }));

  const color = isFocused
    ? theme.colors.primary
    : theme.colors.tabBarInactive;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={[styles.tab, fixedWidth ? { width: fixedWidth, flex: undefined } : undefined]}
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      accessibilityLabel={label}
    >
      <Animated.View style={animatedIconStyle}>
        {tabBarIconFn
          ? tabBarIconFn({ focused: isFocused, color, size: 24 })
          : <Ionicons name="ellipse-outline" size={24} color={color} />
        }
      </Animated.View>
      <ThemedText
        variant="caption"
        color={color}
        numberOfLines={1}
        style={[
          styles.label,
          isFocused && { fontWeight: '600' },
        ]}
      >
        {label}
      </ThemedText>
      <Animated.View
        style={[
          styles.indicator,
          { backgroundColor: theme.colors.primary },
          animatedIndicatorStyle,
        ]}
      />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
    paddingTop: 8,
  },
  scrollContent: {
    flexDirection: 'row',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  label: {
    marginTop: 2,
  },
  indicator: {
    width: 20,
    height: 3,
    borderRadius: 1.5,
    marginTop: 4,
  },
});

export default AnimatedTabBar;
