import React, { useState, useEffect, useRef, useMemo } from "react";
import "./ChatWindow.css";
import { getAIMessage } from "../api/api";
import { marked } from "marked";

const STORAGE_KEY = "partselect-chat-sessions-v1";

const SEARCHING_LABELS = {
  search_parts: "Searching parts catalog…",
  check_compatibility: "Checking compatibility…",
  get_part_details: "Fetching part details…",
  troubleshoot: "Looking up troubleshooting steps…",
  get_order_status: "Checking order status…",
};

function formatTime(d = new Date()) {
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatSessionDate(ts) {
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function truncateTitle(text, max = 52) {
  const t = String(text).trim().replace(/\s+/g, " ");
  if (!t) return "New chat";
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function createWelcomeMessages() {
  return [
    {
      role: "assistant",
      content:
        "Hello — I’m your **refrigerator and dishwasher** parts assistant. Ask about a part number (e.g. PS11752778), whether a part fits your model, or describe a symptom like an ice maker not working.",
      time: formatTime(),
    },
  ];
}

function createSession() {
  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `chat-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return {
    id,
    title: "New chat",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: createWelcomeMessages(),
  };
}

function loadPersisted() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) throw new Error("empty");
    const data = JSON.parse(raw);
    const sessions = Array.isArray(data.sessions) ? data.sessions : [];
    const valid = sessions
      .filter(
        (s) => s && typeof s.id === "string" && Array.isArray(s.messages)
      )
      .map((s) => ({
        ...s,
        title: typeof s.title === "string" ? s.title : "New chat",
        createdAt:
          typeof s.createdAt === "number" ? s.createdAt : Date.now(),
        updatedAt:
          typeof s.updatedAt === "number"
            ? s.updatedAt
            : typeof s.createdAt === "number"
              ? s.createdAt
              : Date.now(),
      }));
    if (!valid.length) throw new Error("no sessions");
    const activeId = valid.some((s) => s.id === data.activeId)
      ? data.activeId
      : valid[0].id;
    return { sessions: valid, activeId };
  } catch {
    const s = createSession();
    return { sessions: [s], activeId: s.id };
  }
}

function PartSelectLogoLockup() {
  return (
    <div
      className="chat-logo-lockup chat-logo-lockup--header"
      role="img"
      aria-label="PartSelect"
    >
      <svg
        className="chat-logo-svg"
        viewBox="0 0 40 40"
        aria-hidden="true"
        focusable="false"
      >
        <polygon
          fill="url(#partselect-house-fill)"
          points="20,5 39,21 35,21 35,37 5,37 5,21 1,21"
        />
        <defs>
          <linearGradient
            id="partselect-house-fill"
            x1="0"
            y1="0"
            x2="40"
            y2="40"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#fdb927" />
            <stop offset="100%" stopColor="#e8890c" />
          </linearGradient>
        </defs>
        <text
          x="20"
          y="29"
          textAnchor="middle"
          fill="#fff"
          fontSize="16"
          fontWeight="800"
          fontFamily="system-ui, -apple-system, Segoe UI, sans-serif"
        >
          P
        </text>
      </svg>
      <div className="chat-logo-words chat-logo-words--header">
        <span className="chat-logo-name--header">PartSelect</span>
        <span className="chat-logo-tagline-header">Here to help since 1999</span>
      </div>
    </div>
  );
}

function ProductCard({ part }) {
  if (!part) return null;
  return (
    <article className="product-card">
      <div className="product-card-media">
        {part.image_url ? (
          <img src={part.image_url} alt="" />
        ) : (
          <div className="product-card-no-image">No image</div>
        )}
        <span className="product-oem-badge">OEM</span>
      </div>
      <div className="product-card-info">
        <span className="product-part-number">{part.part_number}</span>
        <span className="product-name">{part.name}</span>
        {part.price ? (
          <span className="product-price">${part.price}</span>
        ) : (
          <span className="product-price-muted">See PartSelect for price</span>
        )}
        <span className="product-in-stock" aria-hidden="true">
          In stock — ships fast
        </span>
      </div>
      <a
        className="product-card-button"
        href={`https://www.partselect.com/${part.part_number}-Part.htm`}
        target="_blank"
        rel="noreferrer"
      >
        View on PartSelect
      </a>
    </article>
  );
}

/** Move session to front after update; apply fn(session) -> partial merge or full session */
function mapSessionAtId(sessions, sessionId, fn) {
  const i = sessions.findIndex((s) => s.id === sessionId);
  if (i === -1) return sessions;
  const cur = sessions[i];
  const patch = fn(cur);
  const next = { ...cur, ...patch, updatedAt: Date.now() };
  return [next, ...sessions.filter((_, j) => j !== i)];
}

function ChatWindow() {
  const persistedOnce = useRef(null);
  if (!persistedOnce.current) persistedOnce.current = loadPersisted();

  const [sessions, setSessions] = useState(persistedOnce.current.sessions);
  const [activeId, setActiveId] = useState(persistedOnce.current.activeId);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [statusLabel, setStatusLabel] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef(null);

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeId) ?? sessions[0],
    [sessions, activeId]
  );
  const messages = activeSession?.messages ?? [];

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ activeId, sessions })
        );
      } catch {
        /* ignore quota */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [activeId, sessions]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, statusLabel, activeId]);

  const createNewChat = () => {
    if (isLoading) return;
    const s = createSession();
    setSessions((prev) => [s, ...prev]);
    setActiveId(s.id);
    setInput("");
    setStatusLabel("");
  };

  const selectChat = (id) => {
    if (isLoading || id === activeId) return;
    setActiveId(id);
    setInput("");
    setStatusLabel("");
  };

  const handleSend = async () => {
    if (input.trim() === "" || isLoading) return;

    const sessionId = activeId;
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return;

    const userInput = input;
    const userTime = formatTime();
    const hadUserBefore = session.messages.some((m) => m.role === "user");
    const nextTitle = hadUserBefore
      ? session.title
      : truncateTitle(userInput);

    setInput("");
    setIsLoading(true);
    setStatusLabel("");

    const historyForApi = session.messages;

    setSessions((prev) =>
      mapSessionAtId(prev, sessionId, (s) => ({
        title: nextTitle,
        messages: [
          ...s.messages,
          { role: "user", content: userInput, time: userTime },
          { role: "assistant", content: "", partsData: null, time: formatTime() },
        ],
      }))
    );

    try {
      let streamedText = "";

      const response = await getAIMessage(
        userInput,
        historyForApi,
        (chunk) => {
          if (chunk.type === "tool_use") {
            setStatusLabel(SEARCHING_LABELS[chunk.tool] ?? "Working…");
          }
          if (chunk.type === "text_delta") {
            streamedText += chunk.text;
            setSessions((prev) =>
              mapSessionAtId(prev, sessionId, (s) => {
                const next = [...s.messages];
                next[next.length - 1] = {
                  role: "assistant",
                  content: streamedText,
                  partsData: null,
                  time: next[next.length - 1].time,
                };
                return { messages: next };
              })
            );
          }
        }
      );

      setStatusLabel("");
      setSessions((prev) =>
        mapSessionAtId(prev, sessionId, (s) => {
          const next = [...s.messages];
          next[next.length - 1] = {
            ...response,
            time: formatTime(),
          };
          return { messages: next };
        })
      );
    } catch {
      setStatusLabel("");
      setSessions((prev) =>
        mapSessionAtId(prev, sessionId, (s) => {
          const next = [...s.messages];
          next[next.length - 1] = {
            role: "assistant",
            content: "Something went wrong. Please try again.",
            time: formatTime(),
          };
          return { messages: next };
        })
      );
    } finally {
      setIsLoading(false);
    }
  };

  const orderedSidebarSessions = useMemo(
    () =>
      [...sessions].sort(
        (a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt)
      ),
    [sessions]
  );

  return (
    <div
      className={`chat-app${sidebarOpen ? "" : " chat-app--sidebar-collapsed"}`}
      role="application"
      aria-label="PartSelect chat"
    >
      <aside
        id="chat-sidebar-panel"
        className="chat-sidebar"
        aria-label="Chat history"
        aria-hidden={!sidebarOpen}
      >
        <div className="chat-sidebar-header">
          <span className="chat-sidebar-label">Chats</span>
        </div>
        <button
          type="button"
          className="chat-sidebar-new"
          onClick={createNewChat}
          disabled={isLoading}
        >
          + New chat
        </button>
        <nav
          className="chat-sidebar-list"
          id="chat-sidebar-nav"
          aria-label="Previous conversations"
        >
          {orderedSidebarSessions.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`chat-session-row${
                s.id === activeId ? " chat-session-row--active" : ""
              }`}
              onClick={() => selectChat(s.id)}
              disabled={isLoading}
            >
              <span className="chat-session-title">{s.title || "New chat"}</span>
              <span className="chat-session-meta">
                {formatSessionDate(s.updatedAt ?? s.createdAt)}
              </span>
            </button>
          ))}
        </nav>
      </aside>

      <div className="chat-widget" aria-label="PartSelect parts chat">
        <div className="chat-widget-header">
          <button
            type="button"
            className="chat-header-menu"
            aria-label={sidebarOpen ? "Hide chat list" : "Show chat list"}
            aria-expanded={sidebarOpen}
            aria-controls="chat-sidebar-panel"
            onClick={() => setSidebarOpen((open) => !open)}
          >
            <span />
            <span />
            <span />
          </button>
          <div className="chat-widget-header-center">
            <PartSelectLogoLockup />
            <h2 className="chat-widget-title">How can we help?</h2>
          </div>
        </div>
        <p className="chat-widget-sub">
          Refrigerator &amp; dishwasher parts — model lookup, compatibility, and
          repair help.
        </p>

        <div className="chat-joined">
          You’re chatting with PartSelect Parts Help
        </div>

        <div className="messages-container">
          {messages.map((message, index) => (
            <div key={`${activeId}-${index}`} className={`${message.role}-message-container`}>
              <div className="message-meta">
                {message.role === "assistant" ? (
                  <>
                    <span className="message-sender">PartSelect</span>
                    <time className="message-time">{message.time}</time>
                  </>
                ) : (
                  <>
                    <span className="message-sender">You</span>
                    <time className="message-time">{message.time}</time>
                  </>
                )}
              </div>
              {message.content ? (
                <div className={`message ${message.role}-message`}>
                  <div
                    dangerouslySetInnerHTML={{
                      __html: marked(message.content).replace(/<p>|<\/p>/g, ""),
                    }}
                  />
                </div>
              ) : null}
              {message.partsData ? (
                <div className="product-cards-row">
                  {message.partsData.map((part, i) => (
                    <ProductCard key={i} part={part} />
                  ))}
                </div>
              ) : null}
            </div>
          ))}

          {statusLabel ? (
            <div className="assistant-message-container">
              <div className="message-meta">
                <span className="message-sender">PartSelect</span>
              </div>
              <div className="message assistant-message status-label">
                {statusLabel}
              </div>
            </div>
          ) : null}

          <div ref={messagesEndRef} />
        </div>

        <div className="input-area">
          <div className="input-area-inner">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Search model #, part #, or describe your issue…"
              disabled={isLoading}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  handleSend();
                  e.preventDefault();
                }
              }}
              aria-label="Message"
            />
            <button
              type="button"
              className="send-button"
              onClick={handleSend}
              disabled={isLoading}
            >
              {isLoading ? "…" : "Send"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChatWindow;
