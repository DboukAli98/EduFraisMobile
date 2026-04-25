import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Keyboard,
    Pressable,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { ScreenContainer, ThemedText } from '../../components';
import { useSendMwanaBotMessageMutation } from '../../services/api/apiSlice';
import type { MwanaBotChatMessage, MwanaBotResponse } from '../../types';

type ChatMessage = MwanaBotChatMessage & {
    id: string;
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

const getReplyText = (response: MwanaBotResponse): string => {
    if (typeof response.data === 'string') {
        return response.data;
    }

    return response.data?.reply
        ?? response.data?.text
        ?? response.data?.answer
        ?? response.data?.message
        ?? response.reply
        ?? response.text
        ?? response.answer
        ?? response.message
        ?? "MwanaBot n'a pas encore de réponse. Veuillez réessayer.";
};

export default function MwanaBotScreen() {
    const { theme } = useTheme();
    const listRef = useRef<FlatList<ChatMessage>>(null);
    const [sendMwanaBotMessage, { isLoading: isSending }] = useSendMwanaBotMessageMutation();
    const [messages, setMessages] = useState<ChatMessage[]>([
        createMessage(
            'model',
            'Bonjour, je suis MwanaBot. Je peux vous aider avec EduFrais, les paiements, les enfants, les agents et les demandes de support. Que souhaitez-vous faire ?',
        ),
    ]);
    const [draft, setDraft] = useState('');

    const canSend = useMemo(() => draft.trim().length > 0 && !isSending, [draft, isSending]);

    useEffect(() => {
        const timer = setTimeout(() => {
            listRef.current?.scrollToEnd({ animated: true });
        }, 80);

        return () => clearTimeout(timer);
    }, [messages.length, isSending]);

    const sendText = useCallback(
        async (text: string) => {
            const trimmed = text.trim();
            if (!trimmed || isSending) {
                return;
            }

            Keyboard.dismiss();
            setDraft('');

            const userMessage = createMessage('user', trimmed);
            const nextMessages = [...messages, userMessage];
            setMessages(nextMessages);

            try {
                const response = await sendMwanaBotMessage({
                    messages: nextMessages.map((message) => ({ role: message.role, text: message.text })),
                }).unwrap();
                const reply = getReplyText(response);
                setMessages((current) => [...current, createMessage('model', reply)]);
            } catch (error) {
                setMessages((current) => [
                    ...current,
                    createMessage('model', 'MwanaBot est momentanément indisponible. Veuillez réessayer dans un instant.'),
                ]);
            }
        },
        [isSending, messages, sendMwanaBotMessage],
    );

    const renderMessage = ({ item }: { item: ChatMessage }) => {
        const isUser = item.role === 'user';

        return (
            <View style={[styles.messageRow, isUser ? styles.userRow : styles.botRow]}>
                {!isUser && (
                    <View style={[styles.avatar, { backgroundColor: theme.colors.primary + '18' }]}>
                        <Ionicons name="sparkles-outline" size={17} color={theme.colors.primary} />
                    </View>
                )}
                <View
                    style={[
                        styles.bubble,
                        {
                            backgroundColor: isUser ? theme.colors.primary : theme.colors.surface,
                            borderColor: isUser ? theme.colors.primary : theme.colors.borderLight,
                            borderRadius: theme.borderRadius.xl,
                        },
                    ]}
                >
                    <ThemedText
                        variant="bodySmall"
                        color={isUser ? '#FFFFFF' : theme.colors.text}
                        style={styles.messageText}
                    >
                        {item.text}
                    </ThemedText>
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
                ListFooterComponent={isSending ? (
                    <View style={styles.typingRow}>
                        <ActivityIndicator size="small" color={theme.colors.primary} />
                        <ThemedText variant="caption" color={theme.colors.textSecondary} style={styles.typingText}>
                            MwanaBot écrit...
                        </ThemedText>
                    </View>
                ) : null}
            />

            <View style={styles.suggestionsRow}>
                {SUGGESTIONS.map((suggestion) => (
                    <Pressable
                        key={suggestion}
                        onPress={() => sendText(suggestion)}
                        disabled={isSending}
                        style={[
                            styles.suggestion,
                            {
                                backgroundColor: theme.colors.inputBackground,
                                borderColor: theme.colors.borderLight,
                                borderRadius: theme.borderRadius.full,
                            },
                            isSending && styles.disabled,
                        ]}
                    >
                        <ThemedText variant="caption" color={theme.colors.textSecondary} numberOfLines={1}>
                            {suggestion}
                        </ThemedText>
                    </Pressable>
                ))}
            </View>

            <View style={[styles.composerWrap, { borderTopColor: theme.colors.borderLight }]}>
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
    bubble: {
        maxWidth: '82%',
        borderWidth: 1,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    messageText: {
        lineHeight: 20,
    },
    typingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 40,
        marginTop: 2,
        marginBottom: 8,
    },
    typingText: {
        marginLeft: 8,
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
