import { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ChatWindow } from "../components/chat/ChatWindow";
import { useChatStore } from "../stores/chatStore";
import { useSessions, useSessionMessages } from "../hooks/useSessions";
import { useAuthStore } from "../stores/authStore";
import { useDeleteSession } from "../hooks/useSessions";
import { nanoid } from "nanoid";
import { Button } from "../components/ui/button";
import { ScrollArea } from "../components/ui/scroll-area";
import { Plus, Trash2 } from "lucide-react";
import { cn, formatDate } from "../lib/utils";

import { CHANNEL_ICONS } from "../lib/channelIcons";

/** Extract the channel prefix from a session key, e.g. "feishu", "telegram", "web" */
function channelOf(key: string): string {
  return key.split(":")[0] ?? "web";
}

export default function Chat() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const { currentSessionKey, setCurrentSession, setMessages } = useChatStore();
  const { data: sessions } = useSessions();
  const { data: sessionMsgs, isSuccess: historyLoaded } = useSessionMessages(currentSessionKey ?? "");
  const deleteSession = useDeleteSession();
  const historyLoadedForRef = useRef<string | null>(null);

  // Populate store with historical messages whenever the active session changes
  useEffect(() => {
    if (
      currentSessionKey &&
      historyLoaded &&
      historyLoadedForRef.current !== currentSessionKey
    ) {
      historyLoadedForRef.current = currentSessionKey;
      // Filter out empty messages only (assistant stubs with null/empty content).
      // tool and system messages are included but rendered differently.
      const msgs = (sessionMsgs ?? [])
        .filter((m) =>
          typeof m.content === "string" &&
          m.content.trim().length > 0
        )
        .map((m) => ({
          id: nanoid(),
          role: m.role as "user" | "assistant" | "tool" | "system",
          content: m.content as string,
          timestamp: m.timestamp ?? new Date().toISOString(),
          name: m.name ?? undefined,
        }));
      setMessages(msgs);
    }
  }, [currentSessionKey, historyLoaded, sessionMsgs, setMessages]);

  const isAdmin = user?.role === "admin";
  const myPrefix = `web:${user?.id}:`;
  // Admins see all sessions; regular users see only their own web sessions
  const mySessions = useMemo(
    () =>
      isAdmin
        ? (sessions ?? []).slice().sort((a, b) =>
            (b.updated_at ?? "").localeCompare(a.updated_at ?? "")
          )
        : (sessions?.filter((s) => s.key.startsWith(myPrefix)) ?? []),
    [isAdmin, myPrefix, sessions]
  );

  // Auto-select: if persisted key still exists keep it; otherwise fall back to first session
  useEffect(() => {
    if (mySessions.length === 0) return;
    const keyExists = currentSessionKey && mySessions.some((s) => s.key === currentSessionKey);
    if (!keyExists) {
      setCurrentSession(mySessions[0].key);
    }
  }, [mySessions, currentSessionKey, setCurrentSession]);

  const newChat = () => {
    const key = `web:${user?.id}:${nanoid(8)}`;
    historyLoadedForRef.current = key; // new session has no history
    setCurrentSession(key);
  };

  const switchSession = (key: string) => {
    setCurrentSession(key); // clears messages in store
  };

  return (
    <div className="flex h-[calc(100vh-2.5rem*2)] gap-4">
      {/* Session sidebar */}
      <aside className="flex w-52 shrink-0 flex-col rounded-lg border bg-card overflow-hidden">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-medium">{t("chat.sessions")}</span>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={newChat}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="space-y-0.5 p-1" style={{ width: '100%', maxWidth: '100%' }}>
            {mySessions.map((s) => {
              const channel = channelOf(s.key);
              const isWeb = channel === "web";
              const parts = s.key.split(":");
              const rawLabel = isWeb
                ? (parts[2] ?? s.key)
                : (parts[parts.length - 1] ?? s.key);
              // Hard-truncate to avoid overflow in narrow sidebar
              const label = rawLabel.length > 14 ? rawLabel.slice(0, 14) + "…" : rawLabel;
              const active = s.key === currentSessionKey;
              return (
                <div
                  key={s.key}
                  className={cn(
                    "group relative flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-xs transition-colors overflow-hidden",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted/60"
                  )}
                  onClick={() => switchSession(s.key)}
                >
                  {/* Icon */}
                  <div className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-sm leading-none",
                    active ? "bg-primary-foreground/15" : "bg-muted"
                  )}>
                    {CHANNEL_ICONS[channel] ?? "💬"}
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <span className="block truncate font-medium">{label}</span>
                    <p
                      className={cn(
                        "text-[10px] mt-0.5 truncate",
                        active ? "text-primary-foreground/60" : "text-muted-foreground"
                      )}
                    >
                      {formatDate(s.updated_at)}
                    </p>
                  </div>

                  {/* Delete */}
                  <Button
                    size="icon"
                    variant="ghost"
                    className={cn(
                      "h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100",
                      active && "opacity-100 text-primary-foreground hover:bg-primary-foreground/20"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSession.mutate(s.key);
                      if (active) newChat();
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              );
            })}
            {mySessions.length === 0 && (
              <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                {t("common.noData")}
              </p>
            )}
          </div>
        </ScrollArea>
      </aside>

      {/* Chat area */}
      <div className="flex flex-1 flex-col rounded-lg border bg-card overflow-hidden">
        <ChatWindow />
      </div>
    </div>
  );
}
