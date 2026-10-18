/// <reference lib="webworker" />
import { clientsClaim } from "workbox-core";
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";

declare let self: ServiceWorkerGlobalScope;

// Sans ça, un nouveau build reste bloqué en "waiting" tant qu'un onglet reste ouvert : les
// utilisateurs ne reçoivent jamais la mise à jour (centre de notifications, photo de réponse —
// bug observé en prod). registerType: "autoUpdate" côté client suppose ce comportement.
self.skipWaiting();
clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

registerRoute(
  new NavigationRoute(createHandlerBoundToURL("/index.html"), {
    denylist: [/^\/api\//, /^\/socket\.io/],
  }),
);

self.addEventListener("push", (event) => {
  let title = "ALTERRA";
  let body = "Nouvelle notification";
  let data: Record<string, unknown> = {};

  try {
    const raw = event.data?.json() as {
      title?: string;
      body?: string;
      data?: Record<string, unknown>;
    };
    if (raw?.title) title = raw.title;
    if (raw?.body) body = raw.body;
    if (raw?.data) data = raw.data;
  } catch {
    const text = event.data?.text();
    if (text) body = text;
  }

  const href =
    typeof data.href === "string"
      ? data.href
      : typeof data.notificationId === "string"
        ? "/notifications"
        : "/notifications";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      data: { ...data, href },
      icon: "/icons/icon-192.svg",
      badge: "/icons/icon-192.svg",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href =
    typeof event.notification.data?.href === "string"
      ? event.notification.data.href
      : "/notifications";
  const url = new URL(href, self.location.origin).href;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            await (client as WindowClient).navigate(url);
          }
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
