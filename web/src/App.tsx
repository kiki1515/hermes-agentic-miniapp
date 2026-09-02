import { useState, useEffect, useRef } from "react";
import { Activity, BarChart3, Bot, Clock, FileText, KeyRound, MessageSquare, Package, Settings, Terminal, Moon, Sun } from "lucide-react";
import StatusPage from "@/pages/StatusPage";
import ChatPage from "@/pages/ChatPage";
import AgentsPage from "@/pages/AgentsPage";
import ConfigPage from "@/pages/ConfigPage";
import EnvPage from "@/pages/EnvPage";
import SessionsPage from "@/pages/SessionsPage";
import LogsPage from "@/pages/LogsPage";
import AnalyticsPage from "@/pages/AnalyticsPage";
import CronPage from "@/pages/CronPage";
import SkillsPage from "@/pages/SkillsPage";

const NAV_ITEMS = [
  { id: "chat",     label: "Chat",     icon: Terminal },
  { id: "status",   label: "Status",   icon: Activity },
  { id: "agents",   label: "Agents",   icon: Bot },
  { id: "sessions", label: "Sessions", icon: MessageSquare },
  { id: "analytics",label: "Stats",    icon: BarChart3 },
  { id: "logs",     label: "Logs",     icon: FileText },
  { id: "cron",     label: "Cron",     icon: Clock },
  { id: "skills",   label: "Skills",   icon: Package },
  { id: "config",   label: "Config",   icon: Settings },
  { id: "env",      label: "Keys",     icon: KeyRound },
] as const;

type PageId = (typeof NAV_ITEMS)[number]["id"];

const PAGE_COMPONENTS: Record<PageId, React.FC> = {
  chat: ChatPage,
  status: StatusPage,
  agents: AgentsPage,
  sessions: SessionsPage,
  analytics: AnalyticsPage,
  logs: LogsPage,
  cron: CronPage,
  skills: SkillsPage,
  config: ConfigPage,
  env: EnvPage,
};

const FULL_HEIGHT_PAGES = new Set<PageId>(["chat"]);

export default function App() {
  const [page, setPage] = useState<PageId>("chat");
  const activeIndex = NAV_ITEMS.findIndex((n) => n.id === page);
  const [animKey, setAnimKey] = useState(0);
  const [theme, setTheme] = useState<"dark" | "light">(
    () => (localStorage.getItem("hermes-theme") as "dark" | "light") || "light",
  );
  const initialRef = useRef(true);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("hermes-theme", theme);
  }, [theme]);

  // Listen for "continue session" events from SessionsPage
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.sessionId) {
        try { localStorage.setItem("hermes-pending-resume", detail.sessionId); } catch {}
        setPage("chat");
      }
    };
    window.addEventListener("hermes:continue-session", handler as EventListener);
    return () => window.removeEventListener("hermes:continue-session", handler as EventListener);
  }, []);

  useEffect(() => {
    if (initialRef.current) {
      initialRef.current = false;
      return;
    }
    setAnimKey((k) => k + 1);
  }, [page]);

  const PageComponent = PAGE_COMPONENTS[page];
  const isFullHeight = FULL_HEIGHT_PAGES.has(page);

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden text-foreground">
      {/* Header — slim glass bar with Nous Research logo + theme toggle */}
      <header className="glass z-40 shrink-0 border-x-0 border-t-0 rounded-none">
        <div className="flex h-11 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-xl bg-white dark:bg-white/95 flex items-center justify-center shadow-sm overflow-hidden">
              <img src="/assets/hermes-logo.svg" alt="Nous Research" className="h-5 w-5" />
            </div>
            <span className="font-semibold text-base tracking-tight">
              Hermes Agent
            </span>
          </div>
          {/* Theme toggle — liquid glass switcher (Sun/Moon slide) */}
          <div
            className="relative inline-flex items-center shrink-0"
            style={{
              width: 64,
              height: 28,
              padding: "3px 3px",
              boxSizing: "border-box",
              borderRadius: "99em",
              backgroundColor: "color-mix(in srgb, var(--c-glass) 12%, transparent)",
              backdropFilter: "blur(8px) url(#dock-switcher) saturate(150%)",
              WebkitBackdropFilter: "blur(8px) saturate(150%)",
              boxShadow: [
                "inset 0 0 0 1px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 10%), transparent)",
                "inset 1.8px 3px 0px -2px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 90%), transparent)",
                "inset -2px -2px 0px -2px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 80%), transparent)",
                "inset -3px -8px 1px -6px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 60%), transparent)",
                "inset -0.3px -1px 4px 0px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 12%), transparent)",
                "inset -1.5px 2.5px 0px -2px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 20%), transparent)",
                "inset 0px 3px 4px -2px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 20%), transparent)",
                "inset 2px -6.5px 1px -4px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 10%), transparent)",
                "0px 1px 5px 0px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 10%), transparent)",
                "0px 6px 16px 0px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 8%), transparent)",
              ].join(", "),
            }}
          >
            {/* Sliding active pill — 50% width = each side */}
            <span
              className="absolute pointer-events-none"
              style={{
                left: 3,
                top: 3,
                width: "calc(50% - 3px)",
                height: "calc(100% - 6px)",
                borderRadius: "99em",
                backgroundColor: "color-mix(in srgb, var(--c-glass) 36%, transparent)",
                boxShadow: [
                  "inset 0 0 0 1px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 10%), transparent)",
                  "inset 2px 1px 0px -1px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 90%), transparent)",
                  "inset -1.5px -1px 0px -1px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 80%), transparent)",
                  "inset -2px -6px 1px -5px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 60%), transparent)",
                  "inset -1px 2px 3px -1px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 20%), transparent)",
                  "inset 0px -4px 1px -2px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 10%), transparent)",
                  "0px 3px 6px 0px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 8%), transparent)",
                ].join(", "),
                transform: theme === "dark" ? "translateX(100%)" : "translateX(0)",
                transition: "transform 400ms cubic-bezier(1, 0, 0.4, 1), background-color 400ms cubic-bezier(1, 0, 0.4, 1), box-shadow 400ms cubic-bezier(1, 0, 0.4, 1)",
              }}
              aria-hidden
            />
            <button
              type="button"
              onClick={() => setTheme("light")}
              aria-label="Light theme"
              className="relative inline-flex items-center justify-center h-full w-1/2 rounded-full focus-visible:outline-none"
              style={{
                color: theme === "light" ? "var(--c-action)" : "var(--c-content)",
                opacity: theme === "light" ? 1 : 0.55,
                transition: "color 200ms, opacity 200ms",
              }}
            >
              <Sun className="h-3 w-3" strokeWidth={theme === "light" ? 2.4 : 1.7} />
            </button>
            <button
              type="button"
              onClick={() => setTheme("dark")}
              aria-label="Dark theme"
              className="relative inline-flex items-center justify-center h-full w-1/2 rounded-full focus-visible:outline-none"
              style={{
                color: theme === "dark" ? "var(--c-action)" : "var(--c-content)",
                opacity: theme === "dark" ? 1 : 0.55,
                transition: "color 200ms, opacity 200ms",
              }}
            >
              <Moon className="h-3 w-3" strokeWidth={theme === "dark" ? 2.4 : 1.7} />
            </button>
          </div>
        </div>
      </header>

      <main
        key={animKey}
        className={`relative z-2 w-full flex-1 min-h-0 ${isFullHeight ? "flex flex-col" : "overflow-y-auto px-3 py-4"}`}
        style={isFullHeight ? undefined : { animation: "fade-in 180ms ease-out" }}
      >
        <PageComponent />
      </main>

      {/* Bottom navigation — Liquid Glass Switcher (Vadim Matveev / KwpRaGr style) */}
      <style>{`
        .dock-switcher {
          max-width: min(320px, calc(100vw - 16px)) !important;
          height: 52px !important;
          padding: 4px 4px !important;
        }
        .dock-switcher__icon { width: 18px !important; height: 18px !important; }
        .dock-switcher__label { display: none !important; }
        .dock-switcher__pill {
          left: 4px !important;
          top: 4px !important;
          width: calc((100% - 8px) / 10) !important;
          height: calc(100% - 8px) !important;
          border-radius: 14px !important;
        }
        @media (min-width: 640px) {
          .dock-switcher {
            max-width: 480px !important;
            height: 60px !important;
            padding: 5px 5px !important;
          }
          .dock-switcher__icon { width: 20px !important; height: 20px !important; }
          .dock-switcher__pill {
            left: 5px !important;
            top: 5px !important;
            width: calc((100% - 10px) / 10) !important;
            height: calc(100% - 10px) !important;
            border-radius: 16px !important;
          }
        }
        @media (min-width: 1024px) {
          .dock-switcher {
            max-width: 640px !important;
            height: 68px !important;
            padding: 6px 6px !important;
          }
          .dock-switcher__icon { width: 22px !important; height: 22px !important; }
          .dock-switcher__pill {
            left: 6px !important;
            top: 6px !important;
            width: calc((100% - 12px) / 10) !important;
            height: calc(100% - 12px) !important;
            border-radius: 18px !important;
          }
        }
      `}</style>
      <svg
        className="pointer-events-none absolute h-0 w-0"
        aria-hidden
      >
        <defs>
          <filter
            id="dock-switcher"
            primitiveUnits="objectBoundingBox"
            colorInterpolationFilters="sRGB"
          >
            <feImage
              x="0"
              y="0"
              width="100%"
              height="100%"
              preserveAspectRatio="none"
              result="map"
              href=""
            />
            <feGaussianBlur in="SourceGraphic" stdDeviation="0.04" result="blur" />
            <feDisplacementMap
              in="blur"
              in2="map"
              scale="0.5"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>
      <nav className="relative z-30 shrink-0 px-2 sm:px-4 pb-2 sm:pb-4 pt-1 pointer-events-none">
        <div
          className="pointer-events-auto relative mx-auto flex items-center justify-center transition-all duration-300 w-full dock-switcher"
          style={{
            // Base = mobile (overridden by .dock-switcher media queries)
            boxSizing: "border-box",
            borderRadius: "99em",
            backgroundColor: "color-mix(in srgb, var(--c-glass) 12%, transparent)",
            backdropFilter: "blur(8px) url(#dock-switcher) saturate(150%)",
            WebkitBackdropFilter: "blur(8px) saturate(150%)",
            boxShadow: [
              "inset 0 0 0 1px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 10%), transparent)",
              "inset 1.8px 3px 0px -2px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 90%), transparent)",
              "inset -2px -2px 0px -2px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 80%), transparent)",
              "inset -3px -8px 1px -6px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 60%), transparent)",
              "inset -0.3px -1px 4px 0px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 12%), transparent)",
              "inset -1.5px 2.5px 0px -2px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 20%), transparent)",
              "inset 0px 3px 4px -2px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 20%), transparent)",
              "inset 2px -6.5px 1px -4px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 10%), transparent)",
              "0px 1px 5px 0px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 10%), transparent)",
              "0px 6px 16px 0px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 8%), transparent)",
            ].join(", "),
            transition: "background-color 400ms cubic-bezier(1, 0, 0.4, 1), box-shadow 400ms cubic-bezier(1, 0, 0.4, 1)",
          }}
        >
          {/* Active switcher pill — sliding ::after equivalent */}
          <span
            className="absolute pointer-events-none dock-switcher__pill"
            style={{
              backgroundColor: "color-mix(in srgb, var(--c-glass) 36%, transparent)",
              boxShadow: [
                "inset 0 0 0 1px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 10%), transparent)",
                "inset 2px 1px 0px -1px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 90%), transparent)",
                "inset -1.5px -1px 0px -1px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 80%), transparent)",
                "inset -2px -6px 1px -5px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 60%), transparent)",
                "inset -1px 2px 3px -1px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 20%), transparent)",
                "inset 0px -4px 1px -2px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 10%), transparent)",
                "0px 3px 6px 0px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 8%), transparent)",
              ].join(", "),
              transform: `translateX(calc(${activeIndex} * 100%))`,
              transition: "transform 400ms cubic-bezier(1, 0, 0.4, 1), background-color 400ms cubic-bezier(1, 0, 0.4, 1), box-shadow 400ms cubic-bezier(1, 0, 0.4, 1)",
            }}
            aria-hidden
          />
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const active = page === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setPage(id)}
                className="group relative flex justify-center items-center px-2 box-border focus-visible:outline-none"
                style={{
                  flex: "1 1 0",
                  minWidth: 0,
                  height: "100%",
                  borderRadius: "99em",
                  color: active ? "var(--c-content)" : "var(--c-content)",
                  opacity: 1,
                  transition: "all 160ms",
                }}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.setProperty("--c", "var(--c-action)");
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.removeProperty("--c");
                }}
              >
                <Icon
                  className="dock-switcher__icon h-[18px] w-[18px] transition-transform duration-200"
                  style={{
                    color: active ? "var(--c-content)" : "var(--c-content)",
                    strokeWidth: active ? 2.2 : 1.7,
                    transform: active ? "scale(1)" : "scale(0.9)",
                  }}
                  strokeWidth={active ? 2.2 : 1.7}
                />
                <span
                  className="dock-switcher__label absolute -bottom-1 left-1/2 -translate-x-1/2 text-[0.5rem] font-medium tracking-tight whitespace-nowrap"
                  style={{
                    color: active ? "var(--c-content)" : "var(--c-content)",
                    opacity: active ? 0.85 : 0.6,
                  }}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
