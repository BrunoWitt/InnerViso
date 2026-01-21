window.hubLoaded = false;

const initializers = {
  hub:          () => window.carregarNoticias?.(window.hubLoaded),

  wsvisoparser: () => window.initParser?.(),
  comparador:   () => window.initComparador?.(),
  expo8:        () => window.initExpo8?.(),

  // ✅ VIEW DO BAIXAR RE (nome da view = downloadRe)
  downloadRe:   () => window.initDownloadRe?.(),

  buscadorEp:   () => window.initBuscadorEp?.(),
  coletarDi:    () => window.initColetarDi?.(),
  baixarDi:     () => window.initBaixarDi?.(),
  baixarLi:     () => window.initBaixarLi?.(),
  baixarDue:    () => window.initBaixarDue?.(),
  coletarDiCnpj: () => window.initColetarDiCnpj?.(),
  coletarLi:    () => window.initColetarLi?.(),
  baixarAtoCnpj: () => window.initBaixarAtoCnpj?.(),
  baixarDiPdf:  () => window.initBaixarDiPdf?.(),
  baixarAto:    () => window.initBaixarAto?.(),
  "baixar-ato": () => window.initBaixarAto?.(),

  // aliases (se quiser)
  initDownloadRe: () => window.initDownloadRe?.(),
};

window.initializers = initializers;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function waitForApi(timeoutMs = 3000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (window.api && typeof window.api.loadView === 'function') return;
    await sleep(50);
  }
  throw new Error('API do preload indisponível (window.api.loadView).');
}

function cleanupFloatingUI() {
  document.querySelectorAll(".dropdown").forEach((el) => el.remove());
}

async function loadView(viewName) {
  const container = document.getElementById("content");
  if (!container) return;

  cleanupFloatingUI();
  container.innerHTML = "<p>Carregando…</p>";

  try {
    await waitForApi();

    const html = await window.api.loadView(viewName);

    cleanupFloatingUI();
    container.innerHTML = html;

    document.querySelectorAll(".menu-item")
      .forEach(btn => btn.classList.toggle("active", btn.dataset.view === viewName));

    requestAnimationFrame(() => {
      console.log("[router] init view:", viewName, "existe?", !!initializers[viewName]);
      initializers[viewName]?.();
    });

  } catch (e) {
    container.innerHTML = `<p>Falha ao carregar view "${viewName}": ${e?.message || e}</p>`;
    console.error("loadView error:", e);
  }
}

window.loadView = loadView;

function setupMenuRouting() {
  document.querySelectorAll('.menu-item').forEach(btn => {
    if (btn.id === "menu-parser" || btn.id === "menu-scraper") return;
    btn.addEventListener('click', () => loadView(btn.dataset.view));
  });

  window.initParserMenu?.();

  loadView('hub');
}

document.addEventListener('DOMContentLoaded', setupMenuRouting);
