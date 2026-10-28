// Guarda o app no aparelho para abrir mesmo sem sinal no mercado.
// Arquivos do app: tenta a rede primeiro (para pegar atualizações) e cai no cache se demorar.
// As chamadas para a planilha (script.google.com) não passam por aqui.
const CACHE = "mercado-v3.1";
const ARQUIVOS = ["./", "index.html", "app.css", "app.js", "icon.svg", "icon-180.png", "manifest.webmanifest"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function guardar(req, res) {
  if (res && res.ok) {
    const copia = res.clone();
    caches.open(CACHE).then(c => c.put(req, copia));
  }
  return res;
}

function redeComLimite(req, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    fetch(req).then(r => { clearTimeout(t); resolve(r); }, e => { clearTimeout(t); reject(e); });
  });
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    e.respondWith(
      redeComLimite(req, 3500)
        .then(r => guardar(req, r))
        .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match("./")))
    );
    return;
  }

  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => guardar(req, res))));
  }
});
