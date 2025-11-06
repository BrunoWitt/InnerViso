// src/scripts/router.js
window.hubLoaded = false

const initializers = {
  hub:         () => window.carregarNoticias?.(window.hubLoaded),
  wsvisoparser:() => window.initParser?.(),
  comparador:  () => window.initComparador?.(),
};

async function loadView(viewName) {
  const container = document.getElementById('content');
  if (!container) return;

  container.innerHTML = '<p>Carregando…</p>';
  if (viewName === "wsvisoparser" && window.initParser) {
  window.initParser();
  }


  try {
    // pega o HTML pelo IPC (fs no main)
    const html = await window.api.loadView(viewName);
    container.innerHTML = html; //Edita o html tendo em vista o que pegou do API loadview

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
  window.carregarNoticias
}

document.addEventListener('DOMContentLoaded', setupMenuRouting);
