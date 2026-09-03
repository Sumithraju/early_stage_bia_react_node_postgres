import { useEffect, useRef, useState } from "react";
import {
  answerLocally, askQwen, askServer, buildContext,
  loadQwenSettings, saveQwenSettings, serverLLMStatus,
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
  const [serverLlm, setServerLlm] = useState({ configured: false });
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

  // Ask the server once whether an LLM key is configured there.
  useEffect(() => {
    let alive = true;
    serverLLMStatus().then((st) => alive && setServerLlm(st));
    return () => { alive = false; };
  }, []);

  const browserKey = Boolean(settings.apiKey);
  const aiOn = serverLlm.configured || browserKey;
  const modeLabel = serverLlm.configured
    ? `AI · ${serverLlm.provider}`
    : browserKey
    ? "AI · browser key"
    : "Local mode";

  const send = async (text) => {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    setInput("");
    const history = messages;
    setMessages((m) => [...m, { role: "user", text: q }]);

    const ctx = buildContext(model, result);

    // Priority: server-proxied LLM (key stays server-side) -> browser key ->
    // local answers. Any LLM failure falls back to local so it never dead-ends.
    if (serverLlm.configured || browserKey) {
      setBusy(true);
      try {
        const reply = serverLlm.configured
          ? await askServer(q, history, ctx)
          : await askQwen(q, history, ctx, settings);
        setMessages((m) => [...m, { role: "bot", text: reply }]);
      } catch (e) {
        setMessages((m) => [
          ...m,
          { role: "bot", text: `${answerLocally(q, ctx)}\n\n(AI unavailable: ${e.message})` },
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
              <span className={`assistant-mode ${aiOn ? "on" : ""}`}>
                {modeLabel}
              </span>
            </div>
            <button className="btn ghost sm" onClick={() => setShowSettings((s) => !s)} title="Connect QWEN">
              ⚙
            </button>
          </header>

          {showSettings && (
            <div className="assistant-settings">
              {serverLlm.configured ? (
                <p className="muted" style={{ margin: 0, fontSize: 12 }}>
                  AI answers are enabled server-side via <strong>{serverLlm.provider}</strong>.
                  The key is stored on the server, not in your browser. Nothing to do here.
                </p>
              ) : (
                <>
                  <p className="muted" style={{ margin: "0 0 8px", fontSize: 12 }}>
                    <strong>Recommended (hosted):</strong> get a free key from{" "}
                    <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer">Groq</a> (Llama),{" "}
                    <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer">OpenRouter</a>, or{" "}
                    <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noreferrer">HuggingFace</a>,
                    then set <code>LLM_API_KEY</code> (and <code>LLM_PROVIDER</code>) as a server env var.
                    The key stays off the browser and works with any provider.
                  </p>
                  <p className="muted" style={{ margin: "0 0 8px", fontSize: 12 }}>
                    <strong>Or (browser only):</strong> paste an{" "}
                    <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer">OpenRouter</a>{" "}
                    key below — session-only, never committed. (OpenRouter is the one that allows direct
                    browser calls; Groq/HF need the server option above.)
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
                    placeholder="model, e.g. meta-llama/llama-3.3-70b-instruct:free"
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
                    {browserKey && (
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
                </>
              )}
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
