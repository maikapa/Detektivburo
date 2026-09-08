/* Abschaltender Service Worker.

   Die frühere Fassung hat auf iOS Geräte lahmgelegt: Ein einziger
   fehlgeschlagener Abruf ließ die ganze Seite mit
   "FetchEvent.respondWith received an error" abbrechen, und der
   Handler ließ sich danach kaum noch austauschen.

   Diese Datei tut deshalb nur noch eines: sich selbst abmelden und
   alle Zwischenspeicher löschen. Sie hat bewusst KEINEN fetch-Handler
   – damit kann sie nichts mehr blockieren, egal was schiefgeht.
   Geräte mit der alten Fassung heilen sich, sobald sie diese hier
   einmal geladen haben.

   Preis: Die App braucht zum Starten Netz. Das ist der bessere Tausch
   als eine App, die gar nicht mehr aufgeht.
*/

self.addEventListener("install", function () {
  self.skipWaiting();
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (namen) {
        return Promise.all(namen.map(function (n) { return caches.delete(n); }));
      })
      .then(function () { return self.registration.unregister(); })
      .then(function () { return self.clients.matchAll(); })
      .then(function (clients) {
        clients.forEach(function (c) { if (c.navigate) c.navigate(c.url); });
      })
      .catch(function () { })
  );
});
