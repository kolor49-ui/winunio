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
  onToken: (token: string | null) => void;
  onError?: (message: string | null) => void;
  resetKey?: number;
};

function mapTurnstileError(code: string | undefined): string {
  switch (code) {
    case "110200":
      return "A domain nincs engedélyezve a Turnstile widgetben (Cloudflare hostname lista).";
    case "110100":
    case "110110":
      return "Érvénytelen Turnstile kulcs — ellenőrizd a Vercel env-et.";
    case "110600":
    case "110620":
      return "Az ellenőrzés lejárt — frissítsd az oldalt, és próbáld újra.";
    case "200500":
      return "A Cloudflare ellenőrzés nem töltődött be (hálózat, VPN vagy reklámblokkoló).";
    default:
      return "Az ellenőrzés nem sikerült — frissítsd az oldalt. A kék „Troubleshoot” link nem a Winunio gombja.";
  }
}

export function TurnstileWidget({
  siteKey,
  onToken,
  onError,
  resetKey = 0,
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
    if (!siteKey) {
      onTokenRef.current("dev-bypass");
      onErrorRef.current?.(null);
      return;
    }

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
        retry: "auto",
        "refresh-expired": "auto",
        callback: (token: string) => {
          onErrorRef.current?.(null);
          onTokenRef.current(token);
        },
        "expired-callback": () => {
          onTokenRef.current(null);
          onErrorRef.current?.("Az ellenőrzés lejárt — várj, amíg újra zöld lesz.");
        },
        "error-callback": (code?: string) => {
          onTokenRef.current(null);
          onErrorRef.current?.(mapTurnstileError(code));
        },
        "timeout-callback": () => {
          onTokenRef.current(null);
          onErrorRef.current?.(
            "Az ellenőrzés túl sokáig tartott — érintsd meg a pipát, vagy frissítsd az oldalt.",
          );
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
  }, [siteKey, resetKey, scriptId]);

  if (!siteKey) {
    return <p className="hint">Turnstile dev módban kihagyva.</p>;
  }

  return (
    <div className="turnstile-widget-wrap">
      <div ref={containerRef} />
      <p className="hint turnstile-widget-hint">
        Előbb a Cloudflare pipának zöldnek kell lennie — utána aktív a gomb. A kék
        „Troubleshoot” a Cloudflare hibakeresője, ne azt nyomd a folytatáshoz.
      </p>
    </div>
  );
}
