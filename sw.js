/* Service worker do Gestor de Gastos
   - Guarda o app em cache para funcionar 100% offline.
   - Ao publicar uma nova versão, ALTERE a constante VERSION abaixo:
     o app detecta a mudança e oferece "Atualizar".
   Os dados do usuário NÃO ficam aqui: ficam no localStorage do navegador. */
const VERSION = "v1.0.0";
const CACHE = `gestor-gastos-${VERSION}`;
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-192.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-32.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("gestor-gastos-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// A página pede para ativar a nova versão quando o usuário toca em "Atualizar"
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;

  // Navegação (abrir o app): tenta a rede rapidamente para pegar a versão nova; offline usa o cache
  if (req.mode === "navigate") {
    const fromCache = () => caches.match("./index.html", { ignoreSearch: true });
    const fromNet = fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put("./index.html", copy)); }
      return res;
    });
    // se a rede demorar mais de 3s (sinal fraco), abre do cache
    const timeout = new Promise((resolve) => setTimeout(() => fromCache().then((r) => r && resolve(r)), 3000));
    event.respondWith(Promise.race([fromNet.catch(fromCache), timeout]));
    return;
  }

  // Demais arquivos: cache primeiro, rede como alternativa
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }))
  );
});
