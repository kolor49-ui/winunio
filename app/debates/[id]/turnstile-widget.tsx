"use client";

import { useEffect, useId, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: Record<string, unknown>,
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId: string) => void;
    };
    onTurnstileLoad?: () => void;
  }
}

type Props = {
  siteKey: string;
  active: boolean;
  resetKey?: number;
  onToken: (token: string) => void;
  onError: (message: string) => void;
};

const TEST_SITE_KEY = "1x00000000000000000000AA";

function extractErrorCode(code: unknown): string | undefined {
  if (code == null) return undefined;
  if (typeof code === "string" || typeof code === "number") return String(code);
  if (typeof code === "object" && "code" in code) {
    return String((code as { code: unknown }).code);
  }
  return undefined;
}

function mapTurnstileError(code: unknown): string {
  const normalized = extractErrorCode(code);
  switch (normalized) {
    case "110200":
      return "Az ellenőrzés nem fut ezen a címen. Próbáld újra később.";
    case "110100":
    case "110110":
      return "Az ellenőrzés átmenetileg nem elérhető. Próbáld újra később.";
    case "110600":
    case "110620":
      return "Az ellenőrzés lejárt — nyomd meg újra a gombot.";
    case "200500":
      return "Az ellenőrzés nem töltődött be. Ellenőrizd a hálózatot, majd próbáld újra.";
    default:
      return "Az ellenőrzés nem sikerült — nyomd meg újra a gombot.";
  }
}

export function TurnstileWidget({
  siteKey,
  active,
  resetKey = 0,
  onToken,
  onError,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  const onErrorRef = useRef(onError);
  const scriptId = useId().replace(/:/g, "");

  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    if (!active || !siteKey || siteKey === TEST_SITE_KEY) return;

    function renderWidget() {
      const container = containerRef.current;
      if (!container || !window.turnstile) return;

      if (widgetIdRef.current) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }

      container.innerHTML = "";
      widgetIdRef.current = window.turnstile.render(container, {
        sitekey: siteKey,
        theme: "auto",
        size: "flexible",
        retry: "auto",
        "refresh-expired": "auto",
        callback: (token: string) => {
          onErrorRef.current("");
          onTokenRef.current(token);
        },
        "expired-callback": () => {
          onErrorRef.current("Az ellenőrzés lejárt — nyomd meg újra a gombot.");
        },
        "error-callback": (code?: unknown) => {
          console.warn("[turnstile] client error:", code);
          onErrorRef.current(mapTurnstileError(code));
        },
        "timeout-callback": () => {
          onErrorRef.current("Az ellenőrzés túl sokáig tartott — nyomd meg újra a gombot.");
          if (widgetIdRef.current && window.turnstile) {
            window.turnstile.reset(widgetIdRef.current);
          }
        },
      });
    }

    if (window.turnstile) {
      renderWidget();
      return () => {
        if (widgetIdRef.current && window.turnstile) {
          window.turnstile.remove(widgetIdRef.current);
          widgetIdRef.current = null;
        }
      };
    }

    window.onTurnstileLoad = renderWidget;

    let script = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [active, siteKey, resetKey, scriptId]);

  if (!active || !siteKey) return null;

  if (siteKey === TEST_SITE_KEY) {
    return null;
  }

  return (
    <div className="turnstile-widget-wrap">
      <div ref={containerRef} className="turnstile-widget-mount" />
    </div>
  );
}
