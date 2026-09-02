import { useEffect, useState, useRef } from "react";
import { Send, StopCircle, Paperclip, X, ChevronDown, Check, Search } from "lucide-react";
import { api } from "@/lib/api";
import type { ModelInfo } from "@/lib/api";
import { Markdown } from "@/components/Markdown";
import { DnaLoader } from "@/components/DnaLoader";
import { Button } from "@/components/ui/button";

interface ModelGroups {
  groups: Record<string, string[]>;
  all_groups?: Record<string, string[]>;
  current: string;
  providers: { id: string; label: string; icon: string; description: string; enabled: boolean; logo?: string }[];
  selected_providers: string[];
}

// Map model-name prefix → provider icon file (lobehub icons-static-svg)
const MODEL_LOGO_MAP: Record<string, string> = {
  "anthropic/claude": "/assets/providers/anthropic.svg",
  "openai/gpt": "/assets/providers/openai.svg",
  "openai/o": "/assets/providers/openai.svg",
  "google/gemini": "/assets/providers/google.svg",
  "google/gemma": "/assets/providers/google.svg",
  "meta-llama": "/assets/providers/meta.svg",
  "meta/": "/assets/providers/meta.svg",
  "huggingface/": "/assets/providers/huggingface.svg",
  "moonshotai/": "/assets/providers/moonshot.svg",
  "deepseek/": "/assets/providers/deepseek.svg",
  "mistralai/": "/assets/providers/mistral.svg",
  "cohere/": "/assets/providers/cohere.svg",
  "x-ai/": "/assets/providers/xai.svg",
  "nvidia/": "/assets/providers/nvidia.svg",
  "qwen/": "/assets/providers/qwen.svg",
  "tencent/": "/assets/providers/nous.svg",
  "minimax/": "/assets/providers/openrouter.svg",
  "z-ai/": "/assets/providers/openrouter.svg",
  "poolside/": "/assets/providers/openrouter.svg",
  "meituan/": "/assets/providers/openrouter.svg",
  "inclusionai/": "/assets/providers/openrouter.svg",
  "upstage/": "/assets/providers/openrouter.svg",
  "stepfun/": "/assets/providers/openrouter.svg",
  "laguna": "/assets/providers/openrouter.svg",
  "nemotron": "/assets/providers/nvidia.svg",
};

function getModelLogo(modelId: string): string | null {
  // strip our internal "openrouter/" prefix
  const m = modelId.replace(/^openrouter\//, "");
  for (const prefix in MODEL_LOGO_MAP) {
    if (m.startsWith(prefix) || m === prefix.replace(/\/$/, "")) {
      return MODEL_LOGO_MAP[prefix];
    }
  }
  return null;
}

interface ChatMsg {
  role: "user" | "assistant" | "system" | "command";
  content: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [modelGroups, setModelGroups] = useState<ModelGroups | null>(null);
  const [selectedProviders, setSelectedProviders] = useState<string[] | null>(null);
  // Track whether the All chip is active (true means "show every provider")
  const [showAllProviders, setShowAllProviders] = useState(true);
  const [modelOpen, setModelOpen] = useState(false);
  const [openProvider, setOpenProvider] = useState<string | null>(null);
  const [modelSearch, setModelSearch] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<{ name: string; dataUrl: string; mime: string; size: number }[]>([]);
  const [resuming, setResuming] = useState(false);
  const [resumedTitle, setResumedTitle] = useState<string | null>(null);
  const [resumeStatus, setResumeStatus] = useState<string | null>(null);

  // Resume session if user clicked "Lanjutkan" from Sessions page
  useEffect(() => {
    let resumeId: string | null = null;
    try { resumeId = localStorage.getItem("hermes-pending-resume"); } catch {}
    if (!resumeId) return;
    setResuming(true);
    setResumeStatus("Loading session " + resumeId.slice(0, 12) + "…");
    sessionIdRef.current = resumeId;
    api.getSessionMessages(resumeId)
      .then((resp) => {
        const restored: ChatMsg[] = (resp.messages || [])
          .filter((m) => m.content && m.role !== "tool")
          .map((m) => ({ role: m.role as ChatMsg["role"], content: m.content || "" }));
        setMessages(restored);
        setResumedTitle("Melanjutkan sesi");
        setResumeStatus("Loaded " + restored.length + " messages");
        // clear pending key only after success
        try { localStorage.removeItem("hermes-pending-resume"); } catch {}
        // legacy key cleanup
        try { localStorage.removeItem("hermes-resume-session"); } catch {}
      })
      .catch((err) => {
        setResumeStatus("ERROR: " + String(err));
      })
      .finally(() => setResuming(false));
  }, []);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const refetchModels = (provs: string[] | null) => {
    const qs = provs && provs.length > 0 ? provs.join(",") : "";
    api.getModels(qs).then((d) => {
      setModelGroups(d);
      if (openProvider == null) {
        const provsList = d.providers || [];
        const first = provsList.find((p) => p.enabled) || provsList[0];
        if (first) setOpenProvider(first.id);
      }
    }).catch(() => {});
  };

  // Fetch ALL providers (for the "All" chip)
  const fetchAllModels = () => {
    api.getModels("").then((d) => {
      setModelGroups(d);
      // Don't change openProvider — keep current group open so list shows
    }).catch(() => {});
  };

  useEffect(() => {
    api.getModelInfo().then(setModelInfo).catch(() => {});
    refetchModels(null);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const switchModel = async (m: string) => {
    setModelOpen(false);
    setModelSearch("");
    try {
      // If model has no provider prefix, prefix it based on which provider
      // group it belongs to (so backend can route correctly).
      let id = m;
      if (!/^(openrouter|nous|opencode-free|opencode-go|tokenrouter)\//.test(m) && modelGroups) {
        for (const p of modelGroups.providers) {
          if ((modelGroups.groups[p.id] || []).includes(m)) {
            id = `${p.id}/${m}`;
            break;
          }
        }
      }
      await api.setModel(id);
      try { localStorage.setItem("hermes-model", id); } catch {}
      setModelInfo((prev) => (prev ? { ...prev, model: id, model_short: id.split("/").pop() || id } : prev));
    } catch {}
  };

  const handleFileAttach = () => {
    const el = document.createElement("input");
    el.type = "file";
    // Accept a wide range of file types
    el.accept =
      "image/*," +
      "audio/*," +
      "video/*," +
      ".pdf,.txt,.md,.json,.csv,.xml,.yaml,.yml," +
      ".js,.ts,.tsx,.jsx,.py,.rb,.go,.rs,.java,.c,.cpp,.h,.hpp,.cs,.php,.swift,.kt,.sh,.bash,.zsh," +
      ".html,.css,.scss,.sass,.less," +
      ".zip,.tar,.gz,.tgz,.rar,.7z";
    el.multiple = true;
    el.onchange = (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      if (!files.length) return;
      const tasks = files.map(
        (file) =>
          new Promise<{ name: string; dataUrl: string; mime: string; size: number }>(
            (resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () =>
                resolve({
                  name: file.name,
                  dataUrl: reader.result as string,
                  mime: file.type || "application/octet-stream",
                  size: file.size,
                });
              reader.onerror = () => reject(reader.error);
              reader.readAsDataURL(file);
            },
          ),
      );
      Promise.all(tasks).then((newFiles) => {
        setAttachedFiles((prev) => [...prev, ...newFiles].slice(0, 10));
      });
    };
    el.click();
  };

  const removeAttachedFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const abortStream = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
  };

  const send = async () => {
    const text = input.trim();
    if (!text && attachedFiles.length === 0) return;
    if (streaming) return;

    // Build message content: multimodal if images, else text-only
    const images = attachedFiles.filter((f) => f.mime.startsWith("image/"));
    const fileSummary =
      attachedFiles.length > 0
        ? attachedFiles
            .map((f) => {
              const kb = (f.size / 1024).toFixed(1);
              return `📎 ${f.name} (${kb} KB, ${f.mime || "file"})`;
            })
            .join("\n")
        : "";

    const displayText = text || (attachedFiles.length > 0 ? "(file)" : "");
    setInput("");
    setAttachedFiles([]);
    setStreaming(true);

    let content: string;
    if (images.length > 0) {
      // Multimodal: text + image data URIs as a content array
      const parts: any[] = [];
      if (text) parts.push({ type: "text", text });
      if (fileSummary) parts.push({ type: "text", text: fileSummary });
      for (const img of images) {
        parts.push({ type: "image_url", image_url: { url: img.dataUrl } });
      }
      // Use a marker; gateway will parse multimodal if model supports it
      content = JSON.stringify({ multimodal: parts });
    } else {
      // Text only — include file metadata as a separate block
      if (text && fileSummary) {
        content = `${text}\n\n${fileSummary}`;
      } else if (fileSummary) {
        content = fileSummary;
      } else {
        content = text;
      }
    }

    setMessages((prev) => [...prev, { role: "user", content: displayText }]);

    if (text.startsWith("/")) {
      const parts = text.split(/\s+/);
      const cmd = parts[0].slice(1);
      const args = parts.slice(1).join(" ");
      try {
        const r = await api.executeCommand({ command: "/" + cmd, args });
        setMessages((prev) => [
          ...prev,
          { role: "command", content: r.output || "(no output)" },
        ]);
      } catch (e: any) {
        setMessages((prev) => [
          ...prev,
          { role: "system", content: `Error: ${e.message}` },
        ]);
      }
      setStreaming(false);
      return;
    }

    const history = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-20)
      .map((m) => ({ role: m.role, content: m.content }));
    history.push({ role: "user", content });

    const controller = new AbortController();
    abortRef.current = controller;
    let assistantContent = "";

    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      for await (const delta of api.streamChat(history, {
        sessionId: sessionIdRef.current || undefined,
        onSessionId: (id) => { sessionIdRef.current = id; },
      })) {
        if (controller.signal.aborted) break;
        assistantContent += delta;
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: assistantContent };
          return updated;
        });
      }
    } catch (e: any) {
      if (!controller.signal.aborted) {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "system",
            content: `Error: ${e.message}`,
          };
          return updated;
        });
      }
    }

    abortRef.current = null;
    setStreaming(false);
    inputRef.current?.focus();
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  // Filter models by search (across all providers)
  const filteredGroups: Record<string, string[]> = {};
  if (modelGroups) {
    const q = modelSearch.trim().toLowerCase();
    for (const [prov, models] of Object.entries(modelGroups.groups)) {
      const matched = q
        ? models.filter((m) => m.toLowerCase().includes(q))
        : models;
      if (matched.length > 0) filteredGroups[prov] = matched;
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Context bar — model picker (grouped by provider) */}
      <div className="relative shrink-0 px-3 pt-2">
        <div className="glass rounded-2xl px-2.5 py-1.5 flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => setModelOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-white/50 dark:bg-white/10 px-2 py-1 font-medium text-foreground hover:bg-white/70 dark:hover:bg-white/20 transition-colors"
          >
            <span className="truncate max-w-[200px]">
              {modelInfo?.model || "—"}
            </span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
          </button>
          {modelGroups?.current && (() => {
            const cur = modelGroups.current;
            const matchedProv = (modelGroups.providers || []).find((p) => {
              const cNorm = cur.replace(/^openrouter\//, "");
              const ms = (modelGroups.groups[p.id] || []).map((m) => m.replace(/^openrouter\//, ""));
              return ms.includes(cNorm) || ms.includes(cur);
            });
            if (!matchedProv) return null;
            return (
              <span className="inline-flex items-center gap-1 text-[0.65rem] font-medium uppercase tracking-wide bg-blue-500/10 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-md">
                {matchedProv.logo && <img src={matchedProv.logo} alt="" className="h-3 w-3" />}
                {matchedProv.label}
              </span>
            );
          })()}
          <div className="ml-auto flex items-center gap-1.5 text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            <span>Ready</span>
          </div>
        </div>

        {modelOpen && modelGroups && (
          <div className="glass-strong absolute left-3 right-3 top-full z-[200] mt-1 max-h-[70vh] overflow-hidden rounded-2xl flex flex-col">
            {/* Search — liquid glass */}
            <div
              className="shrink-0 p-2"
              style={{
                background:
                  "linear-gradient(180deg, color-mix(in srgb, var(--c-light) 6%, transparent) 0%, transparent 100%)",
              }}
            >
              <div
                className="flex items-center gap-2 px-2.5 py-1.5"
                style={{
                  borderRadius: "14px",
                  backgroundColor: "color-mix(in srgb, var(--c-glass) 10%, transparent)",
                  backdropFilter: "blur(8px) saturate(150%)",
                  WebkitBackdropFilter: "blur(8px) saturate(150%)",
                  boxShadow: [
                    "inset 0 0 0 1px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 10%), transparent)",
                    "inset 1.5px 2px 0px -2px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 70%), transparent)",
                    "inset -2px -2px 0px -2px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 60%), transparent)",
                    "0px 1px 3px 0px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 8%), transparent)",
                  ].join(", "),
                }}
              >
                <Search className="h-3.5 w-3.5 opacity-50 shrink-0" />
                <input
                  type="text"
                  value={modelSearch}
                  onChange={(e) => setModelSearch(e.target.value)}
                  placeholder="Search models…"
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
                />
                {modelSearch && (
                  <button
                    onClick={() => setModelSearch("")}
                    className="opacity-50 hover:opacity-100"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Provider toggles (liquid glass switcher) */}
            {!modelSearch && (modelGroups.providers || []).length > 0 && (() => {
              const providers = modelGroups.providers || [];
              const sel = selectedProviders ?? modelGroups.selected_providers ?? [];
              const totalCount = providers.reduce(
                (sum, p) => sum + (modelGroups.all_groups?.[p.id] || []).length,
                0,
              );
              return (
                <div
                  className="shrink-0 border-b border-border/50 overflow-x-auto scrollbar-none relative"
                  style={{
                    background:
                      "linear-gradient(180deg, color-mix(in srgb, var(--c-light) 8%, transparent) 0%, transparent 100%)",
                  }}
                >
                  <div
                    className="flex items-center gap-1.5 px-2 py-2"
                    style={{
                      backgroundColor: "color-mix(in srgb, var(--c-glass) 6%, transparent)",
                      backdropFilter: "blur(6px) saturate(140%)",
                      WebkitBackdropFilter: "blur(6px) saturate(140%)",
                    }}
                  >
                    <span className="text-[0.6rem] font-semibold uppercase tracking-wider text-muted-foreground/80 shrink-0 pr-1">
                      Provider
                    </span>
                    {/* All chip — selects all enabled providers */}
                    <button
                      key="__all__"
                      type="button"
                      onClick={() => {
                        setShowAllProviders(true);
                        setSelectedProviders(null);
                        fetchAllModels();
                        // Open all groups so user can see all models
                        setOpenProvider(null);
                      }}
                      className="shrink-0 relative inline-flex items-center gap-1.5 px-3 py-1.5 text-[0.72rem] font-medium focus-visible:outline-none"
                      style={{
                        borderRadius: "99em",
                        color: showAllProviders ? "var(--c-action)" : "var(--c-content)",
                        backgroundColor: showAllProviders
                          ? "color-mix(in srgb, var(--c-glass) 36%, transparent)"
                          : "color-mix(in srgb, var(--c-glass) 8%, transparent)",
                        boxShadow: showAllProviders
                          ? [
                              "inset 0 0 0 1px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 10%), transparent)",
                              "inset 2px 1px 0px -1px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 90%), transparent)",
                              "inset -1.5px -1px 0px -1px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 80%), transparent)",
                              "inset -2px -6px 1px -5px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 60%), transparent)",
                              "inset -1px 2px 3px -1px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 20%), transparent)",
                              "inset 0px -4px 1px -2px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 10%), transparent)",
                              "0px 3px 6px 0px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 8%), transparent)",
                            ].join(", ")
                          : "inset 0 0 0 1px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 5%), transparent)",
                        opacity: 1,
                        transition: "background-color 200ms, box-shadow 200ms, color 200ms",
                      }}
                    >
                      <span className="text-[0.85em]">🌐</span>
                      <span>All</span>
                      <span
                        className="text-[0.62rem] font-semibold"
                        style={{ opacity: showAllProviders ? 1 : 0.6 }}
                      >
                        {totalCount}
                      </span>
                    </button>
                    {providers.map((p) => {
                      const isSel = !showAllProviders && sel.includes(p.id);
                      const count = (modelGroups.all_groups?.[p.id] || modelGroups.groups?.[p.id] || []).length;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setShowAllProviders(false);
                            setSelectedProviders([p.id]);
                            refetchModels([p.id]);
                            setOpenProvider(p.id);
                          }}
                          disabled={!p.enabled}
                          className="shrink-0 relative inline-flex items-center gap-1.5 px-3 py-1.5 text-[0.72rem] font-medium focus-visible:outline-none"
                          style={{
                            borderRadius: "99em",
                            color: isSel ? "var(--c-action)" : "var(--c-content)",
                            backgroundColor: isSel
                              ? "color-mix(in srgb, var(--c-glass) 36%, transparent)"
                              : "color-mix(in srgb, var(--c-glass) 8%, transparent)",
                            boxShadow: isSel
                              ? [
                                  "inset 0 0 0 1px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 10%), transparent)",
                                  "inset 2px 1px 0px -1px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 90%), transparent)",
                                  "inset -1.5px -1px 0px -1px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 80%), transparent)",
                                  "inset -2px -6px 1px -5px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 60%), transparent)",
                                  "inset -1px 2px 3px -1px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 20%), transparent)",
                                  "inset 0px -4px 1px -2px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 10%), transparent)",
                                  "0px 3px 6px 0px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 8%), transparent)",
                                ].join(", ")
                              : "inset 0 0 0 1px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 5%), transparent)",
                            opacity: p.enabled ? 1 : 0.4,
                            transition: "background-color 200ms, box-shadow 200ms, color 200ms, opacity 200ms",
                          }}
                          title={p.description}
                        >
                          {p.logo && (
                            <img
                              src={p.logo}
                              alt=""
                              className="h-3.5 w-3.5"
                              style={{ opacity: 0.9, transition: "transform 200ms" }}
                            />
                          )}
                          <span>{p.label}</span>
                          <span
                            className="text-[0.62rem] font-semibold"
                            style={{ opacity: isSel ? 1 : 0.6 }}
                          >
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Models list */}
            <div className="flex-1 overflow-y-auto py-1">
              {Object.keys(filteredGroups).length === 0 && (
                <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                  No models match "{modelSearch}"
                </div>
              )}
              {Object.entries(filteredGroups).map(([prov, models]) => {
                const isOpen = modelSearch || showAllProviders ? true : openProvider === prov;
                if (!isOpen) return null;
                return (
                  <div key={prov}>
                    {modelSearch && (
                      <div className="px-3 pt-2 pb-1 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground/80">
                        {prov} · {models.length}
                      </div>
                    )}
                    {models.map((m) => {
                      const isCurrent = m === (modelInfo?.model || "");
                      const isFree = m.endsWith(":free");
                      const logo = getModelLogo(m);
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => switchModel(m)}
                          className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-foreground/5 transition-colors ${
                            isCurrent ? "text-foreground font-medium" : "text-foreground/80"
                          }`}
                        >
                          {logo && <img src={logo} alt="" className="h-3.5 w-3.5 shrink-0 opacity-80" />}
                          <span className="flex-1 truncate">{m}</span>
                          {isFree && (
                            <span className="text-[0.6rem] font-semibold uppercase tracking-wide text-green-600 dark:text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded">
                              Free
                            </span>
                          )}
                          {isCurrent && <Check className="h-3.5 w-3.5 text-blue-500 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-3">
        {resumeStatus && (
          <div className={"flex items-center justify-center gap-1.5 py-2 text-[10px] font-mono-ui " + (resumeStatus.startsWith("ERROR") ? "text-destructive" : "text-muted-foreground")}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            <span>{resumeStatus}</span>
          </div>
        )}
        {resumedTitle && !resuming && messages.length > 0 && (
          <div className="flex items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
            <span>{resumedTitle}</span>
          </div>
        )}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-center px-6 gap-3">
            {/* Hermes caduceus brand mark — center above placeholder */}
            <div
              className="h-20 w-20 rounded-full bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-pink-500/20 backdrop-blur-md flex items-center justify-center shadow-md border border-white/40 dark:border-white/10"
              aria-hidden
            >
              <span className="text-[2.75rem] leading-none select-none" style={{ filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.15))" }}>⚕</span>
            </div>
            <div>
              <div className="text-2xl font-semibold tracking-tight mb-1 text-foreground/80">Hermes Agent</div>
              <p className="text-xs opacity-60">Send a message to start chatting</p>
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${
                msg.role === "user"
                  ? "bg-blue-500 text-white"
                  : msg.role === "system"
                    ? "glass text-muted-foreground italic"
                    : msg.role === "command"
                      ? "glass text-foreground/80 font-mono text-xs whitespace-pre-wrap"
                      : "glass text-foreground"
              }`}
              style={msg.role === "user" ? { boxShadow: "0 4px 12px -4px rgba(0,122,255,0.4)" } : undefined}
            >
              {msg.role === "assistant" ? (
                <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap break-words">
                  {streaming && i === messages.length - 1 && !msg.content ? (
                    <DnaLoader />
                  ) : (
                    <>
                      <Markdown content={msg.content} />
                      {streaming && i === messages.length - 1 && (
                        <span className="inline-block w-1.5 h-4 bg-foreground/70 animate-pulse ml-0.5 align-text-bottom" />
                      )}
                    </>
                  )}
                </div>
              ) : (
                <div className="whitespace-pre-wrap break-words">{msg.content}</div>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Attachment previews */}
      {attachedFiles.length > 0 && (
        <div className="shrink-0 mx-3 mb-1.5 flex flex-wrap gap-1.5">
          {attachedFiles.map((f, i) => {
            const isImage = f.mime.startsWith("image/");
            const kb = (f.size / 1024).toFixed(1);
            return (
              <div
                key={i}
                className="glass inline-flex items-center gap-2 rounded-xl pl-1 pr-1.5 py-1 text-xs"
                style={{ maxWidth: 240 }}
              >
                {isImage ? (
                  <img
                    src={f.dataUrl}
                    alt={f.name}
                    className="h-8 w-8 rounded-lg object-cover shrink-0"
                  />
                ) : (
                  <span className="h-8 w-8 rounded-lg bg-white/40 dark:bg-white/10 flex items-center justify-center shrink-0 text-base">
                    {f.mime.startsWith("audio/")
                      ? "🎵"
                      : f.mime.startsWith("video/")
                        ? "🎬"
                        : f.mime.includes("pdf")
                          ? "📄"
                          : f.mime.startsWith("text/") ||
                              f.mime.includes("json") ||
                              f.mime.includes("javascript") ||
                              f.mime.includes("python")
                            ? "📝"
                            : f.mime.includes("zip") ||
                                f.mime.includes("tar") ||
                                f.mime.includes("gzip")
                              ? "📦"
                              : "📎"}
                  </span>
                )}
                <span className="truncate flex-1 min-w-0">
                  <span className="block truncate font-medium">{f.name}</span>
                  <span className="block text-[0.62rem] opacity-60">{kb} KB</span>
                </span>
                <button
                  onClick={() => removeAttachedFile(i)}
                  className="text-muted-foreground hover:text-foreground shrink-0"
                  aria-label={`Remove ${f.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Input bar — glass floating field */}
      <div className="shrink-0 p-3">
        <div className="glass rounded-2xl flex items-end gap-1.5 p-1.5">
          <Button variant="ghost" size="icon" className="shrink-0 h-9 w-9 rounded-xl" onClick={handleFileAttach}>
            <Paperclip className="h-4 w-4" />
          </Button>
          <textarea
            ref={inputRef}
            className="flex-1 resize-none bg-transparent px-2 py-2 text-sm focus-visible:outline-none placeholder:text-muted-foreground/60 min-h-[36px] max-h-[120px]"
            placeholder="Message Hermes…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            rows={1}
            disabled={streaming}
          />
          {streaming ? (
            <Button variant="destructive" size="icon" className="shrink-0 h-9 w-9 rounded-xl" onClick={abortStream}>
              <StopCircle className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              size="icon"
              className="shrink-0 h-9 w-9 rounded-xl bg-blue-500 hover:bg-blue-600 text-white"
              onClick={send}
              disabled={!input.trim() && attachedFiles.length === 0}
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
