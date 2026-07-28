"use client";

import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
} from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: Record<string, unknown>,
      ) => string;
      execute: (widgetId: string) => void;
      reset: (widgetId?: string) => void;
      remove: (widgetId: string) => void;
    };
    onTurnstileLoad?: () => void;
  }
}

export type TurnstileHandle = {
  run: () => Promise<string>;
};

type Props = {
  siteKey: string;
  onError?: (message: string | null) => void;
};

const RUN_TIMEOUT_MS = 45_000;

function mapTurnstileError(code: unknown): string {
  const normalized = code == null ? undefined : String(code);
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

export const TurnstileWidget = forwardRef<TurnstileHandle, Props>(
  function TurnstileWidget({ siteKey, onError }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);
    const onErrorRef = useRef(onError);
    const pendingRef = useRef<{
      resolve: (token: string) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    } | null>(null);
    const scriptId = useId().replace(/:/g, "");

    useEffect(() => {
      onErrorRef.current = onError;
    }, [onError]);

    function clearPending(reject?: Error) {
      const pending = pendingRef.current;
      if (!pending) return;
      clearTimeout(pending.timer);
      pendingRef.current = null;
      if (reject) pending.reject(reject);
    }

    function resolvePending(token: string) {
      const pending = pendingRef.current;
      if (!pending) return;
      clearTimeout(pending.timer);
      pendingRef.current = null;
      onErrorRef.current?.(null);
      pending.resolve(token);
    }

    function rejectPending(message: string) {
      clearPending(new Error(message));
      onErrorRef.current?.(message);
    }

    useImperativeHandle(
      ref,
      () => ({
        run: () => {
          if (!siteKey) return Promise.resolve("dev-bypass");

          if (!widgetIdRef.current || !window.turnstile) {
            const message =
              "Az ellenőrzés még nem áll készen — frissítsd az oldalt, majd próbáld újra.";
            onErrorRef.current?.(message);
            return Promise.reject(new Error(message));
          }

          clearPending();

          return new Promise<string>((resolve, reject) => {
            const timer = setTimeout(() => {
              pendingRef.current = null;
              const message = "Az ellenőrzés túl sokáig tartott — nyomd meg újra a gombot.";
              onErrorRef.current?.(message);
              reject(new Error(message));
            }, RUN_TIMEOUT_MS);

            pendingRef.current = { resolve, reject, timer };

            try {
              window.turnstile!.reset(widgetIdRef.current!);
              window.turnstile!.execute(widgetIdRef.current!);
            } catch {
              clearTimeout(timer);
              pendingRef.current = null;
              const message =
                "Az ellenőrzés nem indítható — frissítsd az oldalt, majd próbáld újra.";
              onErrorRef.current?.(message);
              reject(new Error(message));
            }
          });
        },
      }),
      [siteKey],
    );

    useEffect(() => {
      if (!siteKey) return;

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
          appearance: "execute",
          retry: "auto",
          "refresh-expired": "auto",
          callback: (token: string) => {
            resolvePending(token);
          },
          "expired-callback": () => {
            rejectPending("Az ellenőrzés lejárt — nyomd meg újra a gombot.");
          },
          "error-callback": (code?: unknown) => {
            rejectPending(mapTurnstileError(code));
            if (widgetIdRef.current && window.turnstile) {
              window.turnstile.reset(widgetIdRef.current);
            }
          },
          "timeout-callback": () => {
            rejectPending("Az ellenőrzés túl sokáig tartott — nyomd meg újra a gombot.");
            if (widgetIdRef.current && window.turnstile) {
              window.turnstile.reset(widgetIdRef.current);
            }
          },
        });
      }

      if (window.turnstile) {
        renderWidget();
        return () => {
          clearPending();
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
        clearPending();
        if (widgetIdRef.current && window.turnstile) {
          window.turnstile.remove(widgetIdRef.current);
          widgetIdRef.current = null;
        }
      };
    }, [siteKey, scriptId]);

    if (!siteKey) return null;

    return (
      <div
        className="turnstile-widget-wrap turnstile-widget-wrap-execute"
        aria-hidden="true"
      >
        <div ref={containerRef} className="turnstile-widget-mount" />
      </div>
    );
  },
);
