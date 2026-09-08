/* Service Worker für das Detektivbüro.

   Zwei Lehren aus der alten Fassung:

   1. Der Fetch-Handler darf NIE ein abgelehntes Versprechen an
      respondWith weitergeben. Sonst zeigt Safari statt der Seite nur
      "FetchEvent.respondWith received an error". Deshalb endet hier
      jeder Pfad in einer echten Antwort – notfalls in einer selbst
      gebauten.

   2. Für die Seite selbst gilt Netz zuerst, Zwischenspeicher nur als
      Rückfall. Damit kommt eine neue Fassung sofort an, ohne dass die
      Cache-Nummer hochgezählt werden muss. Für Icons und Manifest
      bleibt es umgekehrt, die ändern sich praktisch nie.
*/

var CACHE = "detektivbuero-v15";
var DATEIEN = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(DATEIEN); })
      .catch(function () { /* einzelne Datei fehlt: trotzdem installieren */ })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (namen) {
      return Promise.all(namen.map(function (n) {
        return n === CACHE ? null : caches.delete(n);
      }));
    }).catch(function () { })
  );
  self.clients.claim();
});

function ausCache(req) {
  // ignoreSearch, damit auch ?v=14 den gespeicherten Eintrag findet
  return caches.match(req, { ignoreSearch: true });
}

function lege(req, antwort) {
  if (!antwort || !antwort.ok || antwort.type === "opaque") return antwort;
  var kopie = antwort.clone();
  caches.open(CACHE).then(function (c) {
    c.put(req, kopie);
  }).catch(function () { });
  return antwort;
}

self.addEventListener("fetch", function (e) {
  var req = e.request;

  // Nur eigene GET-Anfragen anfassen, alles andere durchlassen
  if (req.method !== "GET") return;
  if (req.url.indexOf(self.location.origin) !== 0) return;

  var istSeite = req.mode === "navigate" ||
                 /\/$|\.html($|\?)/.test(req.url);

  if (istSeite) {
    // Netz zuerst, Zwischenspeicher als Rettung
    e.respondWith(
      fetch(req)
        .then(function (a) { return lege(req, a); })
        .catch(function () {
          return ausCache(req).then(function (t) {
            return t || ausCache("./index.html");
          }).then(function (t) {
            return t || new Response(
              "<!doctype html><meta charset=utf-8><body style=\"background:#0E1729\">",
              { headers: { "Content-Type": "text/html; charset=utf-8" } }
            );
          });
        })
    );
    return;
  }

  // Alles andere: Zwischenspeicher zuerst, Netz als Ergänzung
  e.respondWith(
    ausCache(req).then(function (treffer) {
      if (treffer) return treffer;
      return fetch(req)
        .then(function (a) { return lege(req, a); })
        .catch(function () {
          return new Response("", { status: 504, statusText: "offline" });
        });
    }).catch(function () {
      return new Response("", { status: 504, statusText: "offline" });
    })
  );
});
