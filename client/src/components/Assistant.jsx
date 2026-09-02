import { useEffect, useRef, useState } from "react";
import {
  answerLocally, askQwen, buildContext,
  loadQwenSettings, saveQwenSettings,
} from "../lib/assistant.js";
import Icon from "./Icons.jsx";

/**
 * Floating help assistant. Opens from a button bottom-right. Answers from the
 * local knowledge base by default (grounded in the live model + results); if a
 * QWEN key is connected it routes free-form questions to the LLM instead.
 */
export default function Assistant({ model, result }) {
  const [open, setOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState(loadQwenSettings);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    {
      role: "bot",
      text: "Hi — I'm the BIET assistant. Ask me about net impact, PMPM, break-even, uptake, scenarios, or how to use the tool. I can read your current model, so try “what is my break-even price?”",
    },
  ]);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages, busy, open]);

  const connected = Boolean(settings.apiKey);

  const send = async (text) => {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    setInput("");
    const history = messages;
    setMessages((m) => [...m, { role: "user", text: q }]);

    const ctx = buildContext(model, result);

    // With a key: try the LLM, fall back to local on any failure so the demo
    // never dead-ends on a network or quota error.
    if (connected) {
      setBusy(true);
      try {
        const reply = await askQwen(q, history, ctx, settings);
        setMessages((m) => [...m, { role: "bot", text: reply }]);
      } catch (e) {
        setMessages((m) => [
          ...m,
          { role: "bot", text: `${answerLocally(q, ctx)}\n\n(QWEN unavailable: ${e.message})` },
        ]);
      } finally {
        setBusy(false);
      }
      return;
    }

    setMessages((m) => [...m, { role: "bot", text: answerLocally(q, ctx) }]);
  };

  const suggestions = ["What is my net impact?", "Explain break-even", "Low vs high uptake?"];

  return (
    <>
      <button
        className="assistant-fab"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close assistant" : "Open assistant"}
        title="BIET assistant — ask about your model"
      >
        {open ? <span className="fab-x">×</span> : <Icon name="robot" size={30} />}
      </button>

      {open && (
        <div className="assistant-panel">
          <header className="assistant-head">
            <div>
              <strong>BIET assistant</strong>
              <span className={`assistant-mode ${connected ? "on" : ""}`}>
                {connected ? "QWEN connected" : "Local mode"}
              </span>
            </div>
            <button className="btn ghost sm" onClick={() => setShowSettings((s) => !s)} title="Connect QWEN">
              ⚙
            </button>
          </header>

          {showSettings && (
            <div className="assistant-settings">
              <p className="muted" style={{ margin: "0 0 8px", fontSize: 12 }}>
                Optional. Paste a free{" "}
                <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer">OpenRouter</a>{" "}
                key to enable QWEN answers. Stored in this session only — never uploaded or committed.
              </p>
              <input
                type="password"
                placeholder="OpenRouter API key (sk-or-...)"
                value={settings.apiKey}
                onChange={(e) => setSettings((s) => ({ ...s, apiKey: e.target.value }))}
              />
              <input
                type="text"
                style={{ marginTop: 8 }}
                value={settings.model}
                onChange={(e) => setSettings((s) => ({ ...s, model: e.target.value }))}
              />
              <div className="nav-row" style={{ marginTop: 10, paddingTop: 0, border: "none" }}>
                <button
                  className="btn primary sm"
                  onClick={() => { saveQwenSettings(settings); setShowSettings(false); }}
                >
                  Save
                </button>
                {connected && (
                  <button
                    className="btn ghost sm"
                    onClick={() => {
                      const cleared = { ...settings, apiKey: "" };
                      setSettings(cleared);
                      saveQwenSettings(cleared);
                    }}
                  >
                    Disconnect
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="assistant-body" ref={scrollRef}>
            {messages.map((m, i) => (
              <div key={i} className={`assistant-msg ${m.role}`}>
                {m.text}
              </div>
            ))}
            {busy && <div className="assistant-msg bot muted">Thinking…</div>}
          </div>

          <div className="assistant-suggestions">
            {suggestions.map((s) => (
              <button key={s} className="chip-suggest" onClick={() => send(s)} disabled={busy}>
                {s}
              </button>
            ))}
          </div>

          <form
            className="assistant-input"
            onSubmit={(e) => { e.preventDefault(); send(); }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question…"
              disabled={busy}
            />
            <button type="submit" className="btn primary sm" disabled={busy || !input.trim()}>
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}
