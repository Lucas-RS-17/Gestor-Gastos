/* Service worker do Gestor de Gastos
   - Guarda o app em cache para funcionar 100% offline.
   - Verifica vencimentos e envia notificações (2 dias antes e no dia).
   - Ao publicar uma nova versão, ALTERE a constante VERSION abaixo:
     o app detecta a mudança e oferece "Atualizar".
   Os dados do usuário ficam no localStorage; o app espelha só o necessário
   para os avisos no cache "gg-dados" (o service worker não lê localStorage). */
const VERSION = "v1.1.0";
const CACHE = `gestor-gastos-${VERSION}`;
const DADOS = "gg-dados";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-192.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png",
  "./favicon-32.png",
  "./badge-96.png",
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

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
  if (event.data && event.data.type === "CHECK_VENCIMENTOS") event.waitUntil(verificarVencimentos());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;

  // Navegação (abrir o app): tenta a rede para pegar a versão nova; offline usa o cache
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

/* ============================================================
   Avisos de vencimento
   ============================================================ */
// Disparado pelo Android periodicamente (só com o app instalado)
self.addEventListener("periodicsync", (event) => {
  if (event.tag === "vencimentos") event.waitUntil(verificarVencimentos());
});

const pad = (n) => String(n).padStart(2, "0");
const monthKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const addMonths = (key, delta) => { const [y, m] = key.split("-").map(Number); return monthKey(new Date(y, m - 1 + delta, 1)); };
const hojeISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

// mesmas regras do app
function vale(x, key) {
  if (!x.fixo) return x.inicio === key;
  if (Array.isArray(x.meses)) return x.meses.includes(key);
  return x.inicio <= key && (!x.fim || x.fim >= key);
}
function diaVenc(x, key) {
  if (!x.vencDia) return null;
  const [y, m] = key.split("-").map(Number);
  return Math.min(x.vencDia, new Date(y, m, 0).getDate());
}

async function lerJSON(nome, padrao) {
  try { const r = await (await caches.open(DADOS)).match(nome); return r ? await r.json() : padrao; }
  catch { return padrao; }
}
async function gravarJSON(nome, valor) {
  const c = await caches.open(DADOS);
  await c.put(nome, new Response(JSON.stringify(valor), { headers: { "Content-Type": "application/json" } }));
}

async function verificarVencimentos() {
  const agenda = await lerJSON("./agenda.json", null);
  if (!agenda || !agenda.ativo) return;
  if (self.Notification && self.Notification.permission !== "granted") return;

  const enviados = await lerJSON("./notificados.json", {});
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const mes = monthKey(hoje);
  const alertas = [];

  for (const g of agenda.gastos || []) {
    if (!g.vencDia) continue;
    // mês atual e o próximo (um vencimento dia 1º é avisado no fim do mês anterior)
    for (const key of [mes, addMonths(mes, 1)]) {
      if (!vale(g, key) || (g.pagos && g.pagos[key])) continue;
      const [y, m] = key.split("-").map(Number);
      const venc = new Date(y, m - 1, diaVenc(g, key));
      const dias = Math.round((venc - hoje) / 864e5);
      // "pre": aviso antecipado (2 dias antes; se a checagem atrasou, ainda avisa na véspera)
      const tipo = dias === 0 ? "dia" : dias >= 1 && dias <= 2 ? "pre" : null;
      if (!tipo) continue;
      const chave = `${g.id}|${key}|${tipo}`;
      if (enviados[chave]) continue;
      alertas.push({ g, key, dias, tipo, chave, venc });
    }
  }

  for (const a of alertas) {
    const quando = a.tipo === "dia" ? "Vence hoje" : a.dias === 1 ? "Vence amanhã" : "Vence em 2 dias";
    await self.registration.showNotification(`${quando}: ${a.g.descricao}`, {
      body: `${BRL.format(a.g.valor)} · vencimento ${pad(a.venc.getDate())}/${pad(a.venc.getMonth() + 1)}`,
      tag: `venc-${a.g.id}-${a.key}`, // um aviso por gasto/mês (o do dia substitui o antecipado)
      renotify: true,
      icon: "./icon-192.png",
      badge: "./badge-96.png",
      data: { id: a.g.id, key: a.key },
      actions: [
        { action: "pagar", title: "Marcar como pago" },
        { action: "abrir", title: "Abrir" },
      ],
    });
    enviados[a.chave] = hojeISO();
  }

  // limpa registros com mais de 90 dias
  const limite = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
  for (const k of Object.keys(enviados)) if (enviados[k] < limite) delete enviados[k];
  await gravarJSON("./notificados.json", enviados);
}

// Toque na notificação: abre o app no mês certo (e marca como pago, se for a ação)
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const { id, key } = event.notification.data || {};
  const url = new URL(event.action === "pagar" ? `./?pagar=${encodeURIComponent(id)}&mes=${key}` : `./?mes=${key}`, self.registration.scope).href;
  event.waitUntil((async () => {
    const janelas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of janelas) {
      if (c.url.startsWith(self.registration.scope) && "focus" in c) {
        await c.focus();
        c.postMessage({ type: "ABRIR", id, key, pagar: event.action === "pagar" });
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
