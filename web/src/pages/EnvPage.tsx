import { useEffect, useState, useMemo } from "react";
import {
  Eye,
  EyeOff,
  ExternalLink,
  KeyRound,
  MessageSquare,
  Pencil,
  Save,
  Settings,
  Trash2,
  X,
  Zap,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { api } from "@/lib/api";
import type { EnvVarInfo } from "@/lib/api";
import { useToast } from "@/hooks/useToast";
import { Toast } from "@/components/Toast";
import { OAuthProvidersCard } from "@/components/OAuthProvidersCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/* ------------------------------------------------------------------ */
/*  Provider grouping                                                  */
/* ------------------------------------------------------------------ */

const PROVIDER_GROUPS: { prefix: string; name: string; priority: number; logo?: string }[] = [
  { prefix: "NOUS_",            name: "Nous Research",     priority: 0,  logo: "/assets/providers/nous.svg" },
  { prefix: "ANTHROPIC_",       name: "Anthropic",         priority: 1,  logo: "/assets/providers/anthropic.svg" },
  { prefix: "OPENAI_",          name: "OpenAI",            priority: 2,  logo: "/assets/providers/openai.svg" },
  { prefix: "DASHSCOPE_",       name: "DashScope",         priority: 3,  logo: "" },
  { prefix: "HERMES_QWEN_",     name: "DashScope",         priority: 3 },
  { prefix: "DEEPSEEK_",        name: "DeepSeek",          priority: 4,  logo: "/assets/providers/deepseek.svg" },
  { prefix: "DEEPINFRA_",       name: "DeepInfra",         priority: 5,  logo: "/assets/providers/deepinfra.svg" },
  { prefix: "GOOGLE_",          name: "Google Gemini",     priority: 6,  logo: "/assets/providers/google.svg" },
  { prefix: "GEMINI_",          name: "Google Gemini",     priority: 6,  logo: "/assets/providers/google.svg" },
  { prefix: "GLM_",             name: "GLM / Z.AI",        priority: 7,  logo: "" },
  { prefix: "ZAI_",             name: "GLM / Z.AI",        priority: 7 },
  { prefix: "Z_AI_",            name: "GLM / Z.AI",        priority: 7 },
  { prefix: "GROQ_",            name: "Groq",              priority: 8,  logo: "/assets/providers/groq.svg" },
  { prefix: "HF_",              name: "HuggingFace",       priority: 9,  logo: "/assets/providers/huggingface.svg" },
  { prefix: "KIMI_",            name: "Kimi",              priority: 10, logo: "/assets/providers/moonshot.svg" },
  { prefix: "META_",            name: "Meta AI",           priority: 11, logo: "/assets/providers/meta.svg" },
  { prefix: "MISTRAL_",         name: "Mistral AI",        priority: 12, logo: "/assets/providers/mistral.svg" },
  { prefix: "MINIMAX_CN_",      name: "MiniMax (CN)",      priority: 14, logo: "/assets/providers/minimax.svg" },
  { prefix: "MINIMAX_",         name: "MiniMax",           priority: 13, logo: "/assets/providers/minimax.svg" },
  { prefix: "NVIDIA_",          name: "NVIDIA NIM",        priority: 15, logo: "/assets/providers/nvidia.svg" },
  { prefix: "OLLAMA_",          name: "Ollama",            priority: 16, logo: "/assets/providers/ollama.svg" },
  { prefix: "OPENCODE_GO_",     name: "OpenCode Go",       priority: 17, logo: "/assets/providers/opencode.svg" },
  { prefix: "OPENCODE_ZEN_",    name: "OpenCode Zen",      priority: 18, logo: "/assets/providers/opencode.svg" },
  { prefix: "OPENROUTER_",      name: "OpenRouter",        priority: 19, logo: "/assets/providers/openrouter.svg" },
  { prefix: "TOKENROUTER_",     name: "TokenRouter",       priority: 20, logo: "/assets/providers/tokenrouter.png" },
  { prefix: "XAI_",             name: "xAI (Grok)",        priority: 21, logo: "/assets/providers/xai.svg" },
  { prefix: "XIAOMI_",          name: "Xiaomi MiMo",       priority: 22, logo: "/assets/providers/xiaomimimo.svg" },
  { prefix: "UPSTAGE_",         name: "Upstage",           priority: 23, logo: "/assets/providers/upstage.svg" },
  { prefix: "ARCEE_",           name: "Arcee AI",          priority: 24, logo: "/assets/providers/arcee.svg" },
  { prefix: "STEPFUN_",         name: "StepFun",           priority: 25, logo: "/assets/providers/stepfun.svg" },
  { prefix: "GMI_",             name: "GMI Cloud",         priority: 26, logo: "/assets/providers/gmi.svg" },
  { prefix: "COHERE_",          name: "Cohere",            priority: 27, logo: "/assets/providers/cohere.svg" },
  { prefix: "NOVITA_",          name: "Novita",            priority: 28, logo: "/assets/providers/novita.svg" },
  { prefix: "FIREWORKS_",       name: "Fireworks AI",      priority: 29, logo: "/assets/providers/fireworks.svg" },
  { prefix: "TOGETHER_",        name: "Together AI",       priority: 30, logo: "/assets/providers/together.svg" },
  { prefix: "REPLICATE_",       name: "Replicate",         priority: 31, logo: "/assets/providers/replicate.svg" },
];

function getProviderGroup(key: string): { name: string; logo: string } {
  // Strip _API_KEY or _BASE_URL suffix to get a stable prefix.
  const normalized = key.replace(/_(API_KEY|BASE_URL|TOKEN)$/, "_");
  for (const g of PROVIDER_GROUPS) {
    const normalizedPrefix = g.prefix.replace(/_(API_KEY|BASE_URL|TOKEN)$/, "_");
    if (normalized.startsWith(normalizedPrefix) || key.startsWith(g.prefix)) {
      return { name: g.name, logo: g.logo || "" };
    }
  }
  return { name: "Other", logo: "" };
}

function getProviderPriority(groupName: string): number {
  const entry = PROVIDER_GROUPS.find((g) => g.name === groupName);
  return entry?.priority ?? 99;
}

interface ProviderGroup {
  name: string;
  priority: number;
  entries: [string, EnvVarInfo][];
  hasAnySet: boolean;
  logo?: string;
}

const CATEGORY_META: Record<string, { label: string; icon: typeof KeyRound }> = {
  provider: { label: "LLM Providers", icon: Zap },
  tool: { label: "Tool API Keys", icon: KeyRound },
  messaging: { label: "Messaging", icon: MessageSquare },
  setting: { label: "Agent Settings", icon: Settings },
};

/* ------------------------------------------------------------------ */
/*  EnvVarRow — single key edit row                                    */
/* ------------------------------------------------------------------ */

function EnvVarRow({
  varKey,
  info,
  edits,
  setEdits,
  revealed,
  saving,
  onSave,
  onClear,
  onReveal,
  onCancelEdit,
  compact = false,
}: {
  varKey: string;
  info: EnvVarInfo;
  edits: Record<string, string>;
  setEdits: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  revealed: Record<string, string>;
  saving: string | null;
  onSave: (key: string) => void;
  onClear: (key: string) => void;
  onReveal: (key: string) => void;
  onCancelEdit: (key: string) => void;
  compact?: boolean;
}) {
  const isEditing = edits[varKey] !== undefined;
  const isRevealed = !!revealed[varKey];
  const displayValue = isRevealed ? revealed[varKey] : (info.redacted_value ?? "---");

  // Compact inline row for unset, non-editing keys (used inside provider groups)
  if (compact && !info.is_set && !isEditing) {
    return (
      <div className="flex items-center justify-between gap-2 py-1.5 opacity-50 hover:opacity-100 transition-opacity min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-[0.7rem] text-muted-foreground truncate">{varKey}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {info.url && (
            <a href={info.url} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1 text-[0.6rem] text-primary hover:underline">
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          )}
          <Button size="sm" variant="outline" className="h-6 text-[0.6rem] px-2"
            onClick={() => setEdits((prev) => ({ ...prev, [varKey]: "" }))}>
            <Pencil className="h-2.5 w-2.5" />
          </Button>
        </div>
      </div>
    );
  }

  // Non-compact unset row — mobile-first: stack key on top, actions below
  if (!info.is_set && !isEditing) {
    return (
      <div className="border border-border/50 px-3 py-2.5 sm:px-4 opacity-60 hover:opacity-100 transition-opacity">
        <div className="flex items-center gap-2 min-w-0 mb-1.5">
          <Label className="font-mono text-[0.7rem] text-muted-foreground truncate">{varKey}</Label>
          {info.url && (
            <a href={info.url} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1 text-[0.6rem] text-primary hover:underline shrink-0">
              Get key <ExternalLink className="h-2.5 w-2.5" />
            </a>
          )}
        </div>
        <p className="text-[0.65rem] text-muted-foreground/60 mb-2 line-clamp-1">{info.description}</p>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-7 text-[0.6rem]"
            onClick={() => setEdits((prev) => ({ ...prev, [varKey]: "" }))}>
            <Pencil className="h-3 w-3" />
            Set
          </Button>
        </div>
      </div>
    );
  }

  // Full expanded row for set keys or keys being edited — mobile-first: stack vertically
  return (
    <div className="grid gap-2 border border-border p-3 sm:p-4">
      <div className="flex items-center gap-2 min-w-0 flex-wrap">
        <Label className="font-mono text-[0.7rem] truncate">{varKey}</Label>
        <Badge variant={info.is_set ? "success" : "outline"} className="shrink-0">
          {info.is_set ? "Set" : "Not set"}
        </Badge>
        {info.url && (
          <a href={info.url} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1 text-[0.6rem] text-primary hover:underline shrink-0">
            Get key <ExternalLink className="h-2.5 w-2.5" />
          </a>
        )}
      </div>

      <p className="text-xs text-muted-foreground line-clamp-2">{info.description}</p>

      {info.tools.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {info.tools.map((tool) => (
            <Badge key={tool} variant="secondary" className="text-[0.6rem] py-0 px-1.5">{tool}</Badge>
          ))}
        </div>
      )}

      {!isEditing && (
        <div className="flex flex-col gap-2">
          {/* Value display — full width on mobile */}
          <div className={`flex items-center gap-2 border border-border px-3 py-2 font-mono text-xs min-h-[38px] ${
            isRevealed ? "bg-background text-foreground select-all" : "bg-muted/30 text-muted-foreground"
          }`}>
            <span className="flex-1 truncate sm:whitespace-normal break-all">
              {info.is_set
                ? displayValue
                : info.default
                  ? <span title="default (not set)">{info.default}</span>
                  : "---"}
            </span>
            {info.is_set && (
              <Button size="sm" variant="ghost" onClick={() => onReveal(varKey)}
                title={isRevealed ? "Hide value" : "Show real value"}
                aria-label={isRevealed ? `Hide ${varKey}` : `Reveal ${varKey}`}
                className="shrink-0">
                {isRevealed
                  ? <EyeOff className="h-4 w-4" />
                  : <Eye className="h-4 w-4" />}
              </Button>
            )}
          </div>
          {/* Action buttons — row on desktop, stacked on very small screens */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="outline"
              onClick={() => setEdits((prev) => {
                const newVal = prev[varKey] !== undefined
                  ? prev[varKey]
                  : (info.is_set ? "" : (info.default || ""));
                return { ...prev, [varKey]: newVal };
              })}>
              <Pencil className="h-3 w-3" />
              {info.is_set ? "Replace" : "Set"}
            </Button>
            {info.is_set && (
              <Button size="sm" variant="ghost"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => onClear(varKey)} disabled={saving === varKey}>
                <Trash2 className="h-3 w-3" />
                {saving === varKey ? "..." : "Clear"}
              </Button>
            )}
          </div>
        </div>
      )}

      {isEditing && (
        <div className="flex flex-col gap-2">
          <Input autoFocus type="text"
            value={edits[varKey] !== undefined ? edits[varKey] : (info.is_set ? "" : (info.default || ""))}
            onChange={(e) => setEdits((prev) => ({ ...prev, [varKey]: e.target.value }))}
            placeholder={
              info.is_set
                ? `Replace current value`
                : info.default
                  ? info.default
                  : "Enter value..."
            }
            className="font-mono text-xs w-full" />
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => onSave(varKey)}
              disabled={saving === varKey || !(edits[varKey] || info.default || "")}>
              <Save className="h-3 w-3" />
              {saving === varKey ? "..." : "Save"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onCancelEdit(varKey)}>
              <X className="h-3 w-3" /> Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ProviderGroupCard — groups API keys per provider                   */
/* ------------------------------------------------------------------ */

function ProviderGroupCard({
  group,
  edits,
  setEdits,
  revealed,
  saving,
  onSave,
  onClear,
  onReveal,
  onCancelEdit,
}: {
  group: ProviderGroup;
  edits: Record<string, string>;
  setEdits: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  revealed: Record<string, string>;
  saving: string | null;
  onSave: (key: string) => void;
  onClear: (key: string) => void;
  onReveal: (key: string) => void;
  onCancelEdit: (key: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const apiKeys = group.entries.filter(([k]) => k.endsWith("_API_KEY") || k.endsWith("_TOKEN"));
  const baseUrls = group.entries.filter(([k]) => k.endsWith("_BASE_URL"));
  const other = group.entries.filter(([k]) => !k.endsWith("_API_KEY") && !k.endsWith("_TOKEN") && !k.endsWith("_BASE_URL"));
  const hasAnyConfigured = group.entries.some(([, info]) => info.is_set);
  const configuredCount = group.entries.filter(([, info]) => info.is_set).length;
  const keyUrl = apiKeys.find(([, info]) => info.url)?.[1]?.url ?? null;

  return (
    <div className="border border-border last:border-b-0">
      {/* Header — always visible, wraps on mobile */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between gap-2 px-3 py-3 sm:px-4 cursor-pointer hover:bg-primary/5 transition-colors min-w-0"
      >
        <div className="flex items-center gap-2 min-w-0">
          {expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
          {group.logo ? (
            <img src={group.logo} alt="" className="h-4 w-4 shrink-0 opacity-80" />
          ) : null}
          <span className="font-semibold text-sm tracking-wide truncate">{group.name}</span>
          {hasAnyConfigured && (
            <Badge variant="success" className="text-[0.6rem] shrink-0">
              {configuredCount}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {keyUrl && (
            <a href={keyUrl} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1 text-[0.6rem] text-primary hover:underline"
              onClick={(e) => e.stopPropagation()}>
              Get key <ExternalLink className="h-2.5 w-2.5" />
            </a>
          )}
          <span className="text-[0.6rem] text-muted-foreground/60 hidden sm:inline">
            {group.entries.length} key{group.entries.length !== 1 ? "s" : ""}
          </span>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-border px-3 py-3 sm:px-4 grid gap-2">
          {apiKeys.map(([key, info]) => (
            <EnvVarRow
              key={key} varKey={key} info={info} compact
              edits={edits} setEdits={setEdits} revealed={revealed} saving={saving}
              onSave={onSave} onClear={onClear} onReveal={onReveal} onCancelEdit={onCancelEdit}
            />
          ))}
          {baseUrls.map(([key, info]) => (
            <EnvVarRow
              key={key} varKey={key} info={info} compact
              edits={edits} setEdits={setEdits} revealed={revealed} saving={saving}
              onSave={onSave} onClear={onClear} onReveal={onReveal} onCancelEdit={onCancelEdit}
            />
          ))}
          {other.map(([key, info]) => (
            <EnvVarRow
              key={key} varKey={key} info={info} compact
              edits={edits} setEdits={setEdits} revealed={revealed} saving={saving}
              onSave={onSave} onClear={onClear} onReveal={onReveal} onCancelEdit={onCancelEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

export default function EnvPage() {
  const [vars, setVars] = useState<Record<string, EnvVarInfo> | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(true);
  const { toast, showToast } = useToast();

  useEffect(() => {
    api.getEnvVars().then(setVars).catch(() => {});
  }, []);

  const handleSave = async (key: string) => {
    // Use edits[key] if set; otherwise fall back to the env var's default URL.
    let value = edits[key] || vars?.[key]?.default || "";
    if (!value) return;
    setSaving(key);
    try {
      await api.setEnvVar(key, value);
      setVars((prev) =>
        prev
          ? {
              ...prev,
              [key]: { ...prev[key], is_set: true, redacted_value: value.slice(0, 4) + "..." + value.slice(-4) },
            }
          : prev,
      );
      setEdits((prev) => { const n = { ...prev }; delete n[key]; return n; });
      setRevealed((prev) => { const n = { ...prev }; delete n[key]; return n; });
      showToast(`${key} saved`, "success");
    } catch (e) {
      showToast(`Failed to save ${key}: ${e}`, "error");
    } finally {
      setSaving(null);
    }
  };

  const handleClear = async (key: string) => {
    setSaving(key);
    try {
      await api.deleteEnvVar(key);
      setVars((prev) =>
        prev
          ? { ...prev, [key]: { ...prev[key], is_set: false, redacted_value: null } }
          : prev,
      );
      setEdits((prev) => { const n = { ...prev }; delete n[key]; return n; });
      setRevealed((prev) => { const n = { ...prev }; delete n[key]; return n; });
      showToast(`${key} removed`, "success");
    } catch (e) {
      showToast(`Failed to remove ${key}: ${e}`, "error");
    } finally {
      setSaving(null);
    }
  };

  const handleReveal = async (key: string) => {
    if (revealed[key]) {
      setRevealed((prev) => { const n = { ...prev }; delete n[key]; return n; });
      return;
    }
    try {
      const resp = await api.revealEnvVar(key);
      setRevealed((prev) => ({ ...prev, [key]: resp.value }));
    } catch {
      showToast(`Failed to reveal ${key}`, "error");
    }
  };

  const cancelEdit = (key: string) => {
    setEdits((prev) => { const n = { ...prev }; delete n[key]; return n; });
  };

  /* ---- Build provider groups ---- */
  const { providerGroups, nonProviderGrouped } = useMemo(() => {
    if (!vars) return { providerGroups: [], nonProviderGrouped: [] };

    const providerEntries = Object.entries(vars).filter(
      ([, info]) => info.category === "provider" && (showAdvanced || !info.advanced),
    );

    const groupMap = new Map<string, { logo: string; entries: [string, EnvVarInfo][] }>();
    for (const entry of providerEntries) {
      const group = getProviderGroup(entry[0]);
      if (!groupMap.has(group.name)) groupMap.set(group.name, { logo: group.logo, entries: [] });
      groupMap.get(group.name)!.entries.push(entry);
    }

    const groups: ProviderGroup[] = Array.from(groupMap.entries())
      .map(([name, data]) => ({
        name,
        priority: getProviderPriority(name),
        entries: data.entries,
        logo: data.logo,
        hasAnySet: data.entries.some(([, info]) => info.is_set),
      }))
      .sort((a, b) => a.priority - b.priority);

    const otherCategories = ["tool", "messaging", "setting"];
    const nonProvider = otherCategories.map((cat) => {
      const entries = Object.entries(vars).filter(
        ([, info]) => info.category === cat && (showAdvanced || !info.advanced),
      );
      const setEntries = entries.filter(([, info]) => info.is_set);
      const unsetEntries = entries.filter(([, info]) => !info.is_set);
      return {
        ...CATEGORY_META[cat],
        category: cat,
        setEntries,
        unsetEntries,
        totalEntries: entries.length,
      };
    });

    return { providerGroups: groups, nonProviderGrouped: nonProvider };
  }, [vars, showAdvanced]);

  if (!vars) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const totalProviders = providerGroups.length;
  const configuredProviders = providerGroups.filter((g) => g.hasAnySet).length;

  return (
    <div className="flex flex-col gap-6">
      <Toast toast={toast} />

      {/* Header — mobile: stack description, keep button accessible */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-0.5 min-w-0">
          <p className="text-sm text-muted-foreground">
            API keys stored in <code className="text-xs bg-muted/50 px-1.5 py-0.5 rounded">.env</code>
          </p>
          <p className="text-[0.7rem] text-muted-foreground/70">
            Saved to disk immediately. Active sessions pick up new keys automatically.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setShowAdvanced(!showAdvanced)} className="shrink-0 self-start">
          {showAdvanced ? "Hide Advanced" : "Show Advanced"}
        </Button>
      </div>

      {/* ═══════════════ OAuth Logins ══ */}
      <OAuthProvidersCard
        onError={(msg) => showToast(msg, "error")}
        onSuccess={(msg) => showToast(msg, "success")}
      />

      {/* ═══════════════ LLM Providers (grouped) ═══════════════ */}
      <Card>
        <CardHeader className="bg-card border-b border-border">
          <div className="flex items-center gap-2 min-w-0">
            <Zap className="h-5 w-5 text-muted-foreground shrink-0" />
            <CardTitle className="text-base truncate">LLM Providers</CardTitle>
          </div>
          <CardDescription>
            {configuredProviders} of {totalProviders} configured
          </CardDescription>
        </CardHeader>

        <CardContent className="grid gap-0 p-0">
          {providerGroups.map((group) => (
            <ProviderGroupCard
              key={group.name}
              group={group}
              edits={edits} setEdits={setEdits} revealed={revealed} saving={saving}
              onSave={handleSave} onClear={handleClear} onReveal={handleReveal} onCancelEdit={cancelEdit}
            />
          ))}
        </CardContent>
      </Card>

      {/* ═══════════════ Other categories (flat) ═══════════════ */}
      {nonProviderGrouped.map(({ label, icon: Icon, setEntries, unsetEntries, totalEntries, category }) => {
        if (totalEntries === 0) return null;

        return (
          <Card key={category}>
            <CardHeader className="bg-card border-b border-border">
              <div className="flex items-center gap-2 min-w-0">
                <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
                <CardTitle className="text-base truncate">{label}</CardTitle>
              </div>
              <CardDescription>
                {setEntries.length} of {totalEntries} configured
              </CardDescription>
            </CardHeader>

            <CardContent className="grid gap-3 pt-4">
              {setEntries.map(([key, info]) => (
                <EnvVarRow
                  key={key} varKey={key} info={info}
                  edits={edits} setEdits={setEdits} revealed={revealed} saving={saving}
                  onSave={handleSave} onClear={handleClear} onReveal={handleReveal} onCancelEdit={cancelEdit}
                />
              ))}

              {unsetEntries.length > 0 && (
                <CollapsibleUnset
                  category={category}
                  unsetEntries={unsetEntries}
                  edits={edits} setEdits={setEdits} revealed={revealed} saving={saving}
                  onSave={handleSave} onClear={handleClear} onReveal={handleReveal} onCancelEdit={cancelEdit}
                />
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  CollapsibleUnset — for non-provider categories                     */
/* ------------------------------------------------------------------ */

function CollapsibleUnset({
  category: _category,
  unsetEntries,
  edits,
  setEdits,
  revealed,
  saving,
  onSave,
  onClear,
  onReveal,
  onCancelEdit,
}: {
  category: string;
  unsetEntries: [string, EnvVarInfo][];
  edits: Record<string, string>;
  setEdits: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  revealed: Record<string, string>;
  saving: string | null;
  onSave: (key: string) => void;
  onClear: (key: string) => void;
  onReveal: (key: string) => void;
  onCancelEdit: (key: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <>
      <button
        type="button"
        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer pt-1"
        onClick={() => setCollapsed(!collapsed)}
      >
        {collapsed
          ? <ChevronRight className="h-3 w-3" />
          : <ChevronDown className="h-3 w-3" />}
        <span>{unsetEntries.length} not configured</span>
      </button>

      {!collapsed && unsetEntries.map(([key, info]) => (
        <EnvVarRow
          key={key} varKey={key} info={info}
          edits={edits} setEdits={setEdits} revealed={revealed} saving={saving}
          onSave={onSave} onClear={onClear} onReveal={onReveal} onCancelEdit={onCancelEdit}
        />
      ))}
    </>
  );
}
