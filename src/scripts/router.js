window.hubLoaded = false;

const initializers = {
  hub:          () => window.carregarNoticias?.(window.hubLoaded),

  // view "importação" (tua wsvisoparser.html)
  wsvisoparser: () => window.initParser?.(),      // mantém como você já está usando hoje

  comparador:   () => window.initComparador?.(),
  expo8:        () => window.initExpo8?.(),

  // view "shell" que carrega import/export dentro dela
  parser:       () => window.initParserShell?.(),

  buscadorEp:   () => window.initBuscadorEp?.(),
  coletarDi:    () => window.initColetarDi?.(),
  baixarDi:     () => window.initBaixarDi?.(),
  baixarLi:     () => window.initBaixarLi?.(),
  baixarDue:     () => window.initBaixarDue?.(),
  coletarDiCnpjs: () => window.initColetarDiCnpj?.(),
  coletarLi:    () => window.initColetarLi?.(),

  // ✅ adiciona aliases (pra cobrir como o menu/loader pode estar chamando)
  coletarDiCnpj: () => window.initColetarDiCnpj?.(),
  "coletar-di-cnpj": () => window.initColetarDiCnpj?.(),
  coletarLiCnpj: () => window.initColetarLiCnpj?.(),
  "coletar-li-cnpj": () => window.initColetarLiCnpj?.(), // opcional alias
};

// expõe para o parser shell conseguir chamar init da view filha
window.initializers = initializers;

// util
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
  // mata dropdown órfão do botão de pasta (e qualquer outro menu flutuante seu)
  document.querySelectorAll(".dropdown").forEach((el) => el.remove());
}

async function loadView(viewName) {
  const container = document.getElementById("content");
  if (!container) return;

  cleanupFloatingUI(); // <<< ADD AQUI

  container.innerHTML = "<p>Carregando…</p>";

  try {
    await waitForApi();

    const html = await window.api.loadView(viewName);

    cleanupFloatingUI(); // <<< ADD AQUI TAMBÉM (pra garantir)

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

// expõe para o menu do parser usar
window.loadView = loadView;

function setupMenuRouting() {
  document.querySelectorAll('.menu-item').forEach(btn => {
    // IMPORTANTE: não deixa o router prender click no menu-parser
    if (btn.id === "menu-parser" || btn.id === "menu-scraper") return;

    btn.addEventListener('click', () => loadView(btn.dataset.view));
  });

  // inicializa menu do parser (sidebar)
  window.initParserMenu?.();

  // view padrão
  loadView('hub');
}

document.addEventListener('DOMContentLoaded', setupMenuRouting);
