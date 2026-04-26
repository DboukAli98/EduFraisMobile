import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Keyboard,
    Platform,
    Pressable,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useTheme } from '../../theme';
import { ScreenContainer, ThemedText, MwanaBotToolResultCard } from '../../components';
import { useAppSelector } from '../../hooks';
import { streamMwanaBotMessage, type MwanaBotStreamSubscription } from '../../services/mwanaBot/stream';
import type { MwanaBotChatMessage, MwanaBotSource, MwanaBotToolResult } from '../../types';

type ChatMessage = MwanaBotChatMessage & {
    id: string;
    isTyping?: boolean;
    sources?: MwanaBotSource[];
    // Structured tool outputs attached to this assistant message. We
    // render them as cards under the bot's text — they replace the
    // markdown-y lists the model used to spit out as plain text.
    toolResults?: MwanaBotToolResult[];
};

const SUGGESTIONS = [
    'Comment payer les frais scolaires ?',
    'Comment ajouter un enfant ?',
    'Comment suivre un paiement ?',
];

const createMessage = (role: ChatMessage['role'], text: string): ChatMessage => ({
    id: `${Date.now()}-${Math.random()}`,
    role,
    text,
});

const createConversationId = () =>
    `mobile-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const FRIENDLY_ERROR = 'MwanaBot est momentanément indisponible. Veuillez réessayer dans un instant.';

/**
 * Strip the markdown emphasis the model occasionally sneaks into its
 * answers (`**bold**`, `*italic*`, leading `# `, etc.). The streamed
 * answer is rendered as plain text — markdown wouldn't render correctly
 * and would leak as literal asterisks. Keep newlines and bullets so the
 * structure of the prose survives.
 */
const stripMarkdown = (raw: string): string => {
    if (!raw) return raw;
    return raw
        // Bold / italic markers (** __ * _) — keep the inner text
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/__(.+?)__/g, '$1')
        .replace(/(^|[^*])\*(?!\s)(.+?)(?<!\s)\*(?!\*)/g, '$1$2')
        .replace(/(^|[^_])_(?!\s)(.+?)(?<!\s)_(?!_)/g, '$1$2')
        // Inline code → plain
        .replace(/`([^`]+)`/g, '$1')
        // Heading markers at line start
        .replace(/^#{1,6}\s+/gm, '')
        // Strip lone backticks / triple-backticks fences
        .replace(/```[a-zA-Z]*\n?/g, '')
        .replace(/```/g, '');
};

export default function MwanaBotScreen() {
    const { theme } = useTheme();
    const tabBarHeight = useBottomTabBarHeight();
    const listRef = useRef<FlatList<ChatMessage>>(null);
    const user = useAppSelector((state) => state.auth.user);
    // Token forwarded to MwanaBot so its SchoolFees tools can call the
    // backend on behalf of this same authenticated user. We never log
    // it client-side and only send it inside the SSE POST body.
    const authToken = useAppSelector((state) => state.auth.token);
    const streamRef = useRef<MwanaBotStreamSubscription | null>(null);
    const conversationIdRef = useRef(createConversationId());
    const [messages, setMessages] = useState<ChatMessage[]>([
        createMessage(
            'model',
            'Bonjour, je suis MwanaBot. Je peux vous aider avec EduFrais, les paiements, les enfants, les agents et les demandes de support. Que souhaitez-vous faire ?',
        ),
    ]);
    const [draft, setDraft] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);
    const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

    const canSend = useMemo(() => draft.trim().length > 0 && !isStreaming, [draft, isStreaming]);
    const composerBottomPadding = isKeyboardVisible
        ? 10
        : Math.min(Math.max(tabBarHeight - 28, 36), 52);

    useEffect(() => {
        const timer = setTimeout(() => {
            listRef.current?.scrollToEnd({ animated: true });
        }, 80);

        return () => clearTimeout(timer);
    }, [messages.length, isStreaming]);

    useEffect(() => () => {
        streamRef.current?.close();
    }, []);

    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
        const showSubscription = Keyboard.addListener(showEvent, () => setIsKeyboardVisible(true));
        const hideSubscription = Keyboard.addListener(hideEvent, () => setIsKeyboardVisible(false));

        return () => {
            showSubscription.remove();
            hideSubscription.remove();
        };
    }, []);

    const updateAssistantMessage = useCallback(
        (messageId: string, update: (message: ChatMessage) => ChatMessage) => {
            setMessages((current) => current.map((message) => (
                message.id === messageId ? update(message) : message
            )));
        },
        [],
    );

    const sendText = useCallback(
        (text: string) => {
            const trimmed = text.trim();
            if (!trimmed || isStreaming) {
                return;
            }

            Keyboard.dismiss();
            setDraft('');
            setIsStreaming(true);
            streamRef.current?.close();

            const userMessage = createMessage('user', trimmed);
            const assistantMessage = { ...createMessage('model', ''), isTyping: true };
            const nextMessages = [...messages, userMessage, assistantMessage];
            setMessages(nextMessages);

            streamRef.current = streamMwanaBotMessage({
                message: trimmed,
                userId: user?.id ?? 'anonymous-mobile-user',
                username: user?.name,
                conversationId: conversationIdRef.current,
                authToken,
                entityUserId: user?.entityUserId,
                role: user?.role,
                schoolId: user?.schoolId,
                onStart: (payload) => {
                    if (payload.conversation_id) {
                        conversationIdRef.current = payload.conversation_id;
                    }
                    updateAssistantMessage(assistantMessage.id, (message) => ({ ...message, isTyping: true }));
                },
                onSources: (sources) => {
                    updateAssistantMessage(assistantMessage.id, (message) => ({ ...message, sources }));
                },
                onToolResult: (toolResult) => {
                    // Structured tool payloads arrive BEFORE the answer
                    // streaming starts. We append them to the message so
                    // the FlatList re-renders the rich cards above the
                    // streamed prose. Dedupe on tool name so a backend
                    // re-emit doesn't double-render.
                    updateAssistantMessage(assistantMessage.id, (message) => {
                        const previous = message.toolResults ?? [];
                        const filtered = previous.filter((tr) => tr.name !== toolResult.name);
                        return { ...message, toolResults: [...filtered, toolResult] };
                    });
                },
                onToken: (content) => {
                    updateAssistantMessage(assistantMessage.id, (message) => ({
                        ...message,
                        text: `${message.text}${content}`,
                        isTyping: true,
                    }));
                },
                onDone: (payload) => {
                    if (payload.conversation_id) {
                        conversationIdRef.current = payload.conversation_id;
                    }
                    updateAssistantMessage(assistantMessage.id, (message) => ({
                        ...message,
                        text: payload.answer ?? message.text,
                        isTyping: false,
                        // Backend echoes tool_results in the `done` event
                        // as a safety net; only adopt them if we somehow
                        // missed a mid-stream event.
                        toolResults:
                            (message.toolResults ?? []).length > 0
                                ? message.toolResults
                                : payload.tool_results,
                    }));
                    setIsStreaming(false);
                    streamRef.current = null;
                },
                onError: (errorMessage) => {
                    updateAssistantMessage(assistantMessage.id, (message) => ({
                        ...message,
                        text: errorMessage || FRIENDLY_ERROR,
                        isTyping: false,
                    }));
                    setIsStreaming(false);
                    streamRef.current = null;
                },
            });
        },
        [isStreaming, messages, updateAssistantMessage, user],
    );

    const renderMessage = ({ item }: { item: ChatMessage }) => {
        const isUser = item.role === 'user';
        const isTypingPlaceholder = item.isTyping && !item.text;

        if (isTypingPlaceholder) {
            return (
                <View style={[styles.messageRow, styles.botRow, styles.typingPlaceholderRow]}>
                    <Ionicons name="sparkles-outline" size={17} color={theme.colors.primary} />
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                    <ThemedText variant="caption" color={theme.colors.textSecondary} style={styles.typingText}>
                        MwanaBot écrit...
                    </ThemedText>
                </View>
            );
        }

        const cleanText = isUser ? item.text : stripMarkdown(item.text);
        const toolResults = !isUser ? item.toolResults ?? [] : [];

        return (
            <View style={[styles.messageRow, isUser ? styles.userRow : styles.botRow]}>
                {!isUser && (
                    <View style={[styles.avatar, { backgroundColor: theme.colors.primary + '18' }]}>
                        <Ionicons name="sparkles-outline" size={17} color={theme.colors.primary} />
                    </View>
                )}
                <View
                    style={[
                        styles.messageColumn,
                        isUser ? styles.messageColumnUser : styles.messageColumnBot,
                    ]}
                >
                    {!!cleanText && (
                        <View
                            style={[
                                styles.bubble,
                                {
                                    backgroundColor: isUser ? theme.colors.primary : theme.colors.surface,
                                    borderColor: isUser ? theme.colors.primary : theme.colors.borderLight,
                                    borderRadius: theme.borderRadius.xl,
                                    alignSelf: isUser ? 'flex-end' : 'flex-start',
                                },
                            ]}
                        >
                            <ThemedText
                                variant="bodySmall"
                                color={isUser ? '#FFFFFF' : theme.colors.text}
                                style={styles.messageText}
                            >
                                {cleanText}
                            </ThemedText>
                        </View>
                    )}
                    {toolResults.map((toolResult) => (
                        <MwanaBotToolResultCard
                            key={`${item.id}-${toolResult.name}`}
                            result={toolResult}
                        />
                    ))}
                </View>
            </View>
        );
    };

    return (
        <ScreenContainer scrollable={false} padding={false}>
            <View style={[styles.header, { borderBottomColor: theme.colors.borderLight }]}>
                <View style={[styles.headerIcon, { backgroundColor: theme.colors.primary + '18' }]}>
                    <Ionicons name="chatbubble-ellipses-outline" size={24} color={theme.colors.primary} />
                </View>
                <View style={styles.headerText}>
                    <ThemedText variant="title" style={styles.title}>MwanaBot</ThemedText>
                    <ThemedText variant="caption" color={theme.colors.textSecondary}>
                        Assistant EduFrais en français
                    </ThemedText>
                </View>
            </View>

            <FlatList
                ref={listRef}
                data={messages}
                renderItem={renderMessage}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.messagesContent}
                keyboardShouldPersistTaps="handled"
            />

            <View style={styles.suggestionsRow}>
                {SUGGESTIONS.map((suggestion) => (
                    <Pressable
                        key={suggestion}
                        onPress={() => sendText(suggestion)}
                        disabled={isStreaming}
                        style={[
                            styles.suggestion,
                            {
                                backgroundColor: theme.colors.inputBackground,
                                borderColor: theme.colors.borderLight,
                                borderRadius: theme.borderRadius.full,
                            },
                            isStreaming && styles.disabled,
                        ]}
                    >
                        <ThemedText variant="caption" color={theme.colors.textSecondary} numberOfLines={1}>
                            {suggestion}
                        </ThemedText>
                    </Pressable>
                ))}
            </View>

            <View
                style={[
                    styles.composerWrap,
                    {
                        borderTopColor: theme.colors.borderLight,
                        paddingBottom: composerBottomPadding,
                    },
                ]}
            >
                <View
                    style={[
                        styles.composer,
                        {
                            backgroundColor: theme.colors.inputBackground,
                            borderColor: theme.colors.border,
                            borderRadius: theme.borderRadius.xl,
                        },
                    ]}
                >
                    <TextInput
                        value={draft}
                        onChangeText={setDraft}
                        placeholder="Écrivez votre question..."
                        placeholderTextColor={theme.colors.textTertiary}
                        multiline
                        maxLength={700}
                        style={[
                            styles.input,
                            {
                                color: theme.colors.text,
                                fontFamily: theme.typography.body.fontFamily,
                                fontSize: theme.typography.body.fontSize,
                            },
                        ]}
                        onSubmitEditing={() => sendText(draft)}
                    />
                    <Pressable
                        onPress={() => sendText(draft)}
                        disabled={!canSend}
                        style={[
                            styles.sendButton,
                            {
                                backgroundColor: canSend ? theme.colors.primary : theme.colors.disabled,
                                borderRadius: theme.borderRadius.full,
                            },
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel="Envoyer le message"
                    >
                        <Ionicons name="send" size={18} color={canSend ? '#FFFFFF' : theme.colors.disabledText} />
                    </Pressable>
                </View>
            </View>
        </ScreenContainer>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 14,
        borderBottomWidth: 1,
    },
    headerIcon: {
        width: 46,
        height: 46,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 23,
        marginRight: 12,
    },
    headerText: {
        flex: 1,
    },
    title: {
        fontWeight: '800',
    },
    messagesContent: {
        paddingHorizontal: 16,
        paddingTop: 18,
        paddingBottom: 12,
    },
    messageRow: {
        flexDirection: 'row',
        marginBottom: 12,
    },
    botRow: {
        justifyContent: 'flex-start',
    },
    userRow: {
        justifyContent: 'flex-end',
    },
    avatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
        marginTop: 2,
    },
    messageColumn: {
        // Holds the bubble + any tool result cards so they stack
        // visually under the same speaker.
        gap: 4,
    },
    messageColumnBot: {
        // Bot side gets full breathing room for cards (max 90% of row).
        flex: 1,
        maxWidth: '90%',
    },
    messageColumnUser: {
        // User side hugs its content to the right.
        maxWidth: '82%',
    },
    bubble: {
        borderWidth: 1,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    messageText: {
        lineHeight: 20,
    },
    inlineTypingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 20,
    },
    typingText: {
        marginLeft: 8,
        fontWeight: '600',
    },
    typingPlaceholderRow: {
        alignItems: 'center',
        gap: 8,
        marginLeft: 2,
    },
    suggestionsRow: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 8,
        gap: 8,
    },
    suggestion: {
        flex: 1,
        borderWidth: 1,
        paddingHorizontal: 10,
        paddingVertical: 8,
        minHeight: 34,
        justifyContent: 'center',
    },
    disabled: {
        opacity: 0.5,
    },
    composerWrap: {
        borderTopWidth: 1,
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 14,
    },
    composer: {
        minHeight: 50,
        maxHeight: 120,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingLeft: 14,
        paddingRight: 6,
        paddingVertical: 6,
    },
    input: {
        flex: 1,
        maxHeight: 96,
        paddingVertical: 8,
        paddingRight: 10,
        textAlignVertical: 'top',
    },
    sendButton: {
        width: 38,
        height: 38,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
