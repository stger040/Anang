"use client";

import { useCallback, useState } from "react";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const out = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    out[i] = rawData.charCodeAt(i);
  }
  return out;
}

function bufferToBase64Url(buf: ArrayBuffer | null): string {
  if (!buf) return "";
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Opt-in Web Push for `/p/*` (feature-gated). Requires legal / care-team review before production.
 */
export function PatientWebPushRegister({ orgSlug }: { orgSlug: string }) {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const enabled =
    process.env.NEXT_PUBLIC_PATIENT_WEB_PUSH_ENABLED?.trim() === "1";

  const subscribe = useCallback(async () => {
    if (!enabled || typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("Push not supported in this browser.");
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const keyRes = await fetch("/api/pay/push/vapid-public-key");
      if (!keyRes.ok) {
        setStatus("Push is not configured on the server.");
        setBusy(false);
        return;
      }
      const { publicKey } = (await keyRes.json()) as { publicKey?: string };
      if (!publicKey?.trim()) {
        setStatus("Missing VAPID public key.");
        setBusy(false);
        return;
      }

      const reg = await navigator.serviceWorker.register("/patient-sw.js", {
        scope: "/p/",
      });
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setStatus("Notifications were not granted.");
        setBusy(false);
        return;
      }

      const keyBytes = urlBase64ToUint8Array(publicKey.trim());
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes.buffer.slice(
          keyBytes.byteOffset,
          keyBytes.byteOffset + keyBytes.byteLength,
        ) as ArrayBuffer,
      });

      const json = sub.toJSON();
      const save = await fetch("/api/pay/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgSlug,
          endpoint: json.endpoint,
          keys: {
            p256dh: bufferToBase64Url(sub.getKey("p256dh")),
            auth: bufferToBase64Url(sub.getKey("auth")),
          },
        }),
      });
      if (!save.ok) {
        const err = await save.json().catch(() => ({}));
        setStatus(
          typeof err === "object" && err && "error" in err
            ? String((err as { error?: string }).error)
            : "Could not save subscription.",
        );
        setBusy(false);
        return;
      }
      setStatus("Billing alerts enabled on this device.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Subscribe failed.");
    }
    setBusy(false);
  }, [enabled, orgSlug]);

  if (!enabled) return null;

  return (
    <div className="mx-auto mt-4 max-w-lg rounded-lg border border-slate-200 bg-white/90 px-4 py-3 text-xs text-slate-700 shadow-sm">
      <p className="font-medium text-slate-800">Optional billing alerts</p>
      <p className="mt-1 text-slate-600">
        Enable only if your organization has cleared Web Push with legal and
        clinical leadership. You can turn off notifications in the browser at
        any time.
      </p>
      <button
        type="button"
        onClick={() => void subscribe()}
        disabled={busy}
        className="mt-3 inline-flex rounded-md bg-teal-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-800 disabled:opacity-60"
      >
        {busy ? "Working…" : "Enable push notifications"}
      </button>
      {status ? <p className="mt-2 text-slate-600">{status}</p> : null}
    </div>
  );
}
