import EventSource, { type EventSourceListener } from "react-native-sse";
import { MWANABOT_API_BASE_URL } from "../../constants";
import type { MwanaBotSource, MwanaBotToolResult } from "../../types";

// Adding `tools` (decision summary) and `tool_result` (per-tool
// structured payload). Order: start → sources → tools → tool_result*
// → token* → done. The mobile uses `tool_result` to render rich cards
// with deep-link buttons under the bot's text answer.
type MwanaBotStreamEventName =
  | "start"
  | "sources"
  | "tools"
  | "tool_result"
  | "token"
  | "done";

type StartPayload = {
  conversation_id?: string;
  bot?: string;
};

type SourcesPayload = {
  sources?: MwanaBotSource[];
};

type ToolsPayload = {
  tools?: string[];
};

// One per executed tool, sent BEFORE the answer streaming begins.
type ToolResultPayload = MwanaBotToolResult;

type TokenPayload = {
  content?: string;
};

type DonePayload = {
  answer?: string;
  conversation_id?: string;
  // Echo of all tool_result events for this turn — useful when the
  // listener missed mid-stream events.
  tool_results?: MwanaBotToolResult[];
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
  /**
   * The user's EduFrais JWT. Forwarded to MwanaBot so its tools can
   * call the SchoolFees API on behalf of the same authenticated user
   * (recent payments, upcoming installments, children, etc.). Without
   * this, the tool path is skipped and MwanaBot falls back to RAG-only
   * answers.
   */
  authToken?: string | null;
  /** Numeric ParentId (or CollectingAgentId) — required for the tools. */
  entityUserId?: string | null;
  /** "parent" | "agent" | "director" — selects which toolset to wire. */
  role?: string | null;
  /** Primary school id, used by the loyalty tools as a hint. */
  schoolId?: string | null;
  onStart: (payload: StartPayload) => void;
  onSources: (sources: MwanaBotSource[]) => void;
  onToken: (content: string) => void;
  onDone: (payload: DonePayload) => void;
  onError: (message: string) => void;
  /**
   * Fires once per tool the backend chose to run, with the structured
   * payload + follow-up actions. Mobile renders these as cards under
   * the bot's text answer. May fire 0 to ~4 times before the first
   * `onToken` is emitted, then never again for this turn.
   */
  onToolResult?: (result: MwanaBotToolResult) => void;
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
  authToken,
  entityUserId,
  role,
  schoolId,
  onStart,
  onSources,
  onToken,
  onDone,
  onError,
  onToolResult,
}: StreamMwanaBotMessageParams): MwanaBotStreamSubscription {
  // We deliberately only forward `auth_token` / `parent_id` / `school_id`
  // when they're present, so the MwanaBot backend can cleanly distinguish
  // "no role context (anonymous)" from "parent without an entity id".
  const metadata: Record<string, string> = {};
  if (username) metadata.username = username;
  if (role) metadata.role = role;
  if (authToken) metadata.auth_token = authToken;
  // The backend reads `parent_id` for parent role, and the same field
  // can be reused for other roles' entity ids when their tools land.
  if (entityUserId) metadata.parent_id = entityUserId;
  if (schoolId) metadata.school_id = schoolId;

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
        metadata,
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

  const toolResultListener: EventSourceListener<
    MwanaBotStreamEventName,
    "tool_result"
  > = (event) => {
    if (!onToolResult) return;
    const payload = parseEventData<ToolResultPayload>(event.data);
    if (payload && payload.name && payload.data) {
      onToolResult(payload);
    }
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
  eventSource.addEventListener("tool_result", toolResultListener);
  eventSource.addEventListener("token", tokenListener);
  eventSource.addEventListener("done", doneListener);
  eventSource.addEventListener("error", errorListener);

  return { close };
}
