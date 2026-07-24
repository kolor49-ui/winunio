self.addEventListener("push", (event) => {
  let payload = {
    title: "Winunio",
    body: "Új admin értesítés",
    url: "/admin",
  };

  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch {
      payload.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/logo.svg",
      badge: "/logo.svg",
      data: { url: payload.url || "/admin" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/admin";
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if ("focus" in client) {
            client.navigate(target);
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(target);
        }
        return undefined;
      }),
  );
});
