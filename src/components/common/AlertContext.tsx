import React, {
    createContext,
    useCallback,
    useContext,
    useState,
} from 'react';
import {
    Modal,
    Pressable,
    StyleSheet,
    View,
} from 'react-native';
import Animated, {
    FadeIn,
    FadeOut,
    ZoomIn,
    ZoomOut,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import ThemedText from './ThemedText';

// ─── Types ───────────────────────────────────────────────────────────────────

export type AlertType = 'success' | 'error' | 'warning' | 'info';

export interface AlertButton {
    text: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
}

export interface AlertOptions {
    title: string;
    message?: string;
    type?: AlertType;
    buttons?: AlertButton[];
}

type AlertFn = (options: AlertOptions) => void;

interface AlertContextValue {
    showAlert: (options: AlertOptions) => void;
}

let showAlertRef: AlertFn | null = null;

// ─── Context ─────────────────────────────────────────────────────────────────

const AlertContext = createContext<AlertContextValue | undefined>(undefined);

export const Alert = {
    alert: (title: string, message?: string, buttons?: AlertButton[]) => {
        showAlertRef?.({ title, message, buttons });
    },
};

export const useAlert = (): AlertContextValue => {
    const ctx = useContext(AlertContext);
    if (!ctx) throw new Error('useAlert must be used within AlertProvider');
    return ctx;
};

// ─── Icon config ─────────────────────────────────────────────────────────────

type IconConfig = {
    name: keyof typeof Ionicons.glyphMap;
    bgToken: 'success' | 'error' | 'warning' | 'primary';
};

const ICON_CONFIG: Record<AlertType, IconConfig> = {
    success: { name: 'checkmark-circle', bgToken: 'success' },
    error: { name: 'close-circle', bgToken: 'error' },
    warning: { name: 'warning', bgToken: 'warning' },
    info: { name: 'information-circle', bgToken: 'primary' },
};

// ─── Alert modal UI ──────────────────────────────────────────────────────────

interface AlertState extends AlertOptions {
    visible: boolean;
}

const DEFAULT_STATE: AlertState = {
    visible: false,
    title: '',
    message: undefined,
    type: 'info',
    buttons: [{ text: 'OK' }],
};

const ThemedAlertModal: React.FC<{
    state: AlertState;
    onDismiss: () => void;
}> = ({ state, onDismiss }) => {
    const { theme } = useTheme();

    const type = state.type ?? 'info';
    const buttons = state.buttons?.length ? state.buttons : [{ text: 'OK' }];
    const iconCfg = ICON_CONFIG[type];

    const colorMap: Record<string, string> = {
        success: theme.colors.success,
        error: theme.colors.error,
        warning: theme.colors.warning,
        primary: theme.colors.primary,
    };
    const iconColor = colorMap[iconCfg.bgToken];

    const handleButton = (btn: AlertButton) => {
        onDismiss();
        btn.onPress?.();
    };

    return (
        <Modal
            transparent
            visible={state.visible}
            animationType="none"
            statusBarTranslucent
            onRequestClose={onDismiss}
        >
            <Animated.View
                entering={FadeIn.duration(110)}
                exiting={FadeOut.duration(90)}
                style={styles.backdrop}
            >
                <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />

                <Animated.View
                    entering={ZoomIn.springify().damping(22).stiffness(320).mass(0.65)}
                    exiting={ZoomOut.duration(100)}
                    style={[
                        styles.card,
                        {
                            backgroundColor: theme.colors.surface,
                            borderRadius: theme.borderRadius.xl ?? 20,
                            shadowColor: '#000',
                        },
                    ]}
                >
                    {/* Icon */}
                    <View
                        style={[
                            styles.iconCircle,
                            { backgroundColor: iconColor + '18' },
                        ]}
                    >
                        <Ionicons name={iconCfg.name} size={32} color={iconColor} />
                    </View>

                    {/* Title */}
                    <ThemedText
                        variant="title"
                        style={[styles.title, { color: theme.colors.text }]}
                    >
                        {state.title}
                    </ThemedText>

                    {/* Message */}
                    {!!state.message && (
                        <ThemedText
                            variant="body"
                            color={theme.colors.textSecondary}
                            style={styles.message}
                        >
                            {state.message}
                        </ThemedText>
                    )}

                    {/* Divider */}
                    <View
                        style={[styles.divider, { backgroundColor: theme.colors.borderLight }]}
                    />

                    {/* Buttons */}
                    <View
                        style={[
                            styles.buttonRow,
                            buttons.length === 1 && styles.buttonRowSingle,
                        ]}
                    >
                        {buttons.map((btn, i) => {
                            const isDestructive = btn.style === 'destructive';
                            const isCancel = btn.style === 'cancel';
                            const btnColor = isDestructive
                                ? theme.colors.error
                                : isCancel
                                    ? theme.colors.textSecondary
                                    : theme.colors.primary;

                            return (
                                <React.Fragment key={i}>
                                    {i > 0 && (
                                        <View
                                            style={[
                                                styles.btnDivider,
                                                { backgroundColor: theme.colors.borderLight },
                                            ]}
                                        />
                                    )}
                                    <Pressable
                                        onPress={() => handleButton(btn)}
                                        style={({ pressed }) => [
                                            styles.button,
                                            buttons.length === 1 && styles.buttonFull,
                                            pressed && { backgroundColor: theme.colors.inputBackground },
                                        ]}
                                    >
                                        <ThemedText
                                            variant="button"
                                            style={[
                                                styles.buttonText,
                                                { color: btnColor },
                                                isCancel && { fontWeight: '400' },
                                            ]}
                                        >
                                            {btn.text}
                                        </ThemedText>
                                    </Pressable>
                                </React.Fragment>
                            );
                        })}
                    </View>
                </Animated.View>
            </Animated.View>
        </Modal>
    );
};

// ─── Provider ────────────────────────────────────────────────────────────────

export const AlertProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const [alertState, setAlertState] = useState<AlertState>(DEFAULT_STATE);

    const showAlert = useCallback((options: AlertOptions) => {
        setAlertState({ ...options, visible: true });
    }, []);

    showAlertRef = showAlert;

    const dismiss = useCallback(() => {
        setAlertState((prev) => ({ ...prev, visible: false }));
    }, []);

    return (
        <AlertContext.Provider value={{ showAlert }}>
            {children}
            <ThemedAlertModal state={alertState} onDismiss={dismiss} />
        </AlertContext.Provider>
    );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    card: {
        width: '100%',
        maxWidth: 340,
        alignItems: 'center',
        paddingTop: 28,
        paddingHorizontal: 24,
        paddingBottom: 0,
        elevation: 8,
        shadowOpacity: 0.15,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 6 },
    },
    iconCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    title: {
        textAlign: 'center',
        fontWeight: '700',
        marginBottom: 8,
    },
    message: {
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 4,
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        width: '100%',
        marginTop: 20,
    },
    buttonRow: {
        flexDirection: 'row',
        width: '100%',
    },
    buttonRowSingle: {
        justifyContent: 'center',
    },
    button: {
        flex: 1,
        paddingVertical: 16,
        alignItems: 'center',
        borderRadius: 0,
    },
    buttonFull: {
        flex: 1,
    },
    btnDivider: {
        width: StyleSheet.hairlineWidth,
    },
    buttonText: {
        fontWeight: '600',
    },
});
