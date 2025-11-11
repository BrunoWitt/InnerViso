// src/scripts/router.js
window.hubLoaded = false;

const initializers = {
  hub:         () => window.carregarNoticias?.(window.hubLoaded),
  wsvisoparser:() => window.initParser?.(),
  comparador:  () => window.initComparador?.(),
};

// util: aguarda o preload expor window.api.loadView
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function waitForApi(timeoutMs = 3000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (window.api && typeof window.api.loadView === 'function') return;
    await sleep(50);
  }
  throw new Error('API do preload indisponível (window.api.loadView). Verifique o caminho do preload no BrowserWindow e erros no console.');
}

async function loadView(viewName) {
  const container = document.getElementById('content');
  if (!container) return;

  container.innerHTML = '<p>Carregando…</p>';

  try {
    // garante que o preload já expôs a API
    await waitForApi();

    // carrega o HTML da view pelo IPC
    const html = await window.api.loadView(viewName);
    container.innerHTML = html;

    // marca menu ativo
    document.querySelectorAll('.menu-item')
      .forEach(btn => btn.classList.toggle('active', btn.dataset.view === viewName));

    // só inicializa DEPOIS do HTML estar no DOM
    initializers[viewName]?.();

  } catch (e) {
    container.innerHTML = `<p>Falha ao carregar view "${viewName}": ${e?.message || e}</p>`;
    console.error('loadView error:', e);
  }
}

function setupMenuRouting() {
  document.querySelectorAll('.menu-item').forEach(btn => {
    btn.addEventListener('click', () => loadView(btn.dataset.view));
  });

  // carrega a view padrão
  loadView('hub');
}

document.addEventListener('DOMContentLoaded', setupMenuRouting);
