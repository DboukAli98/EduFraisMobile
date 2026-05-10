import React from 'react';
import { Pressable, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Href, useNavigation, useRouter } from 'expo-router';
import ThemedText from './ThemedText';
import { useTheme } from '../../theme';
import { useAppSelector } from '../../hooks';

type BackButtonProps = {
    label?: string;
    fallbackHref?: Href;
    showLabel?: boolean;
    style?: ViewStyle;
};

const getRoleFallback = (role?: string): Href => {
    switch (role) {
        case 'parent':
        case 'director':
        case 'manager':
        case 'agent':
        default:
            return '/(app)/dashboard';
    }
};

const BackButton: React.FC<BackButtonProps> = ({
    label = 'Retour',
    fallbackHref,
    showLabel = true,
    style,
}) => {
    const router = useRouter();
    const navigation = useNavigation();
    const { theme } = useTheme();
    const role = useAppSelector((state) => state.auth.user?.role);

    const handlePress = () => {
        if (navigation.canGoBack()) {
            router.back();
            return;
        }

        router.replace((fallbackHref ?? getRoleFallback(role)) as Href);
    };

    return (
        <Pressable
            onPress={handlePress}
            style={({ pressed }) => [styles.button, style, pressed && styles.pressed]}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel={label}
        >
            <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
            {showLabel ? (
                <ThemedText variant="bodySmall" style={styles.label}>
                    {label}
                </ThemedText>
            ) : null}
        </Pressable>
    );
};

const styles = StyleSheet.create({
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 4,
    },
    label: {
        fontWeight: '700',
    },
    pressed: {
        opacity: 0.65,
    },
});

export default BackButton;