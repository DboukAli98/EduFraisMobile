import EventSource, { type EventSourceListener } from "react-native-sse";
import { MWANABOT_API_BASE_URL } from "../../constants";
import type { MwanaBotSource } from "../../types";

type MwanaBotStreamEventName = "start" | "sources" | "token" | "done";

type StartPayload = {
  conversation_id?: string;
  bot?: string;
};

type SourcesPayload = {
  sources?: MwanaBotSource[];
};

type TokenPayload = {
  content?: string;
};

type DonePayload = {
  answer?: string;
  conversation_id?: string;
};

type ErrorPayload = {
  message?: string;
  error?: string;
  detail?: string;
};

export type StreamMwanaBotMessageParams = {
  message: string;
  userId: string;
  username?: string;
  conversationId: string;
  onStart: (payload: StartPayload) => void;
  onSources: (sources: MwanaBotSource[]) => void;
  onToken: (content: string) => void;
  onDone: (payload: DonePayload) => void;
  onError: (message: string) => void;
};

export type MwanaBotStreamSubscription = {
  close: () => void;
};

const MWANABOT_STREAM_URL = `${MWANABOT_API_BASE_URL}/chat/stream`;

const parseEventData = <T>(data: string | null): T | null => {
  if (!data) {
    return null;
  }

  try {
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
};

const getFriendlyError = (payload?: ErrorPayload | null): string =>
  payload?.message ??
  payload?.error ??
  "MwanaBot est momentanément indisponible. Veuillez réessayer dans un instant.";

export function streamMwanaBotMessage({
  message,
  userId,
  username,
  conversationId,
  onStart,
  onSources,
  onToken,
  onDone,
  onError,
}: StreamMwanaBotMessageParams): MwanaBotStreamSubscription {
  const eventSource = new EventSource<MwanaBotStreamEventName>(
    MWANABOT_STREAM_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        message,
        user_id: userId,
        conversation_id: conversationId,
        metadata: {
          username,
        },
      }),
      pollingInterval: 0,
      timeout: 0,
    },
  );

  const close = () => {
    eventSource.removeAllEventListeners();
    eventSource.close();
  };

  const startListener: EventSourceListener<MwanaBotStreamEventName, "start"> = (
    event,
  ) => {
    onStart(parseEventData<StartPayload>(event.data) ?? {});
  };

  const sourcesListener: EventSourceListener<
    MwanaBotStreamEventName,
    "sources"
  > = (event) => {
    const payload = parseEventData<SourcesPayload>(event.data);
    onSources(payload?.sources ?? []);
  };

  const tokenListener: EventSourceListener<MwanaBotStreamEventName, "token"> = (
    event,
  ) => {
    const payload = parseEventData<TokenPayload>(event.data);
    if (payload?.content) {
      onToken(payload.content);
    }
  };

  const doneListener: EventSourceListener<MwanaBotStreamEventName, "done"> = (
    event,
  ) => {
    onDone(parseEventData<DonePayload>(event.data) ?? {});
    close();
  };

  const errorListener: EventSourceListener<MwanaBotStreamEventName, "error"> = (
    event,
  ) => {
    const payload =
      "data" in event && typeof event.data === "string"
        ? parseEventData<ErrorPayload>(event.data)
        : null;
    if (payload?.detail) {
      console.log("[MwanaBot] Stream error detail:", payload.detail);
    }
    onError(getFriendlyError(payload));
    close();
  };

  eventSource.addEventListener("start", startListener);
  eventSource.addEventListener("sources", sourcesListener);
  eventSource.addEventListener("token", tokenListener);
  eventSource.addEventListener("done", doneListener);
  eventSource.addEventListener("error", errorListener);

  return { close };
}
