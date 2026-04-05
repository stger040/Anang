/* Patient PWA — minimal service worker (push only; enable via NEXT_PUBLIC_PATIENT_WEB_PUSH_ENABLED). */
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let body = "Billing update.";
  try {
    if (event.data) body = event.data.text();
  } catch {
    /* ignore */
  }
  event.waitUntil(
    self.registration.showNotification("Billing", {
      body,
      icon: "/patient-billing-icon-192.png",
      badge: "/patient-billing-icon-192.png",
    }),
  );
});
