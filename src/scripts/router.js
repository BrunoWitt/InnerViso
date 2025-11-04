// src/scripts/router.js
const initializers = {
  hub:         () => window.carregarNoticias?.(),
  wsvisoparser:() => window.initParser?.(),
  comparador:  () => window.initComparador?.(),
};

async function loadView(viewName) {
  const container = document.getElementById('content');
  if (!container) return;

  container.innerHTML = '<p>Carregando…</p>';

  try {
    // pega o HTML pelo IPC (fs no main)
    const html = await window.api.loadView(viewName);
    container.innerHTML = html;

    document.querySelectorAll('.menu-item')
      .forEach(btn => btn.classList.toggle('active', btn.dataset.view === viewName));

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
  loadView('hub'); // padrão
}

document.addEventListener('DOMContentLoaded', setupMenuRouting);
