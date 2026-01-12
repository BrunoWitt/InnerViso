async function carregarNoticias() {

  // Permitir que o clique no logo também navegue
  document.addEventListener("click", (e) => {
    const target = e.target.closest("[data-view]");
    if (target) {
      const view = target.getAttribute("data-view");
      if (typeof loadView === "function") loadView(view);
    }
  });

  const expC = document.getElementById('news-exp');
  const impC = document.getElementById('news-imp');
  const sisC = document.getElementById('news-sis');
  const lastUpdateEl = document.getElementById('last-update');

  if (!expC || !impC || !sisC) return;

  expC.innerHTML = impC.innerHTML = sisC.innerHTML =
    '<div class="loading">🔄 Carregando notícias...</div>';

  try {
    const data = await window.api.getNoticesCached();

    if (!data || data.erro) {
      throw new Error(data?.erro || "Falha ao carregar dados");
    }

    // Mostrar hora da última atualização
    if (data.last_update && lastUpdateEl) {
      const d = new Date(data.last_update);
      const hh = d.getHours().toString().padStart(2, '0');
      const mm = d.getMinutes().toString().padStart(2, '0');
      lastUpdateEl.textContent = `Notícias atualizadas às: ${hh}:${mm}`;
    }

    const exp = Array.isArray(data.noticias_ex) ? data.noticias_ex : [];
    const imp = Array.isArray(data.noticias_im) ? data.noticias_im : [];
    const sis = Array.isArray(data.noticias_si) ? data.noticias_si : [];

    const render = (arr) => arr.length
      ? arr.map(n => `
          <div class="news-item">
            <h3><a href="${n.link}" target="_blank" rel="noreferrer noopener">${n.title}</a></h3>
            <small>${n.data}</small>
            <p>${n.desc}</p>
          </div>
        `).join('')
      : '<p>Sem itens.</p>';

    expC.innerHTML = render(exp);
    impC.innerHTML = render(imp);
    sisC.innerHTML = render(sis);

  } catch (e) {
    const msg = `<p>Erro ao carregar: ${e?.message || e}</p>`;
    expC.innerHTML = impC.innerHTML = sisC.innerHTML = msg;
  }
}

function ensureLoadingOverlay() {
  let overlay = document.getElementById("loadingOverlay");
  if (overlay) return overlay;

  overlay = document.createElement("div");
  overlay.id = "loadingOverlay";
  overlay.setAttribute("aria-hidden", "true");
  overlay.innerHTML = `
    <div class="loadingCard" role="dialog" aria-modal="true" aria-label="Carregando">
      <div class="spinner" aria-hidden="true"></div>
      <div class="loadingText" id="loadingText">Carregando...</div>
    </div>
  `;
  document.body.appendChild(overlay);
  return overlay;
}

function setLoading(isLoading, text = "Carregando...") {
  const overlay = ensureLoadingOverlay();
  const loadingText = overlay.querySelector("#loadingText");
  if (loadingText) loadingText.textContent = text;

  overlay.style.display = isLoading ? "flex" : "none";
  overlay.setAttribute("aria-hidden", String(!isLoading));
}

// Seu listener com modal
document.getElementById("btnModelo7").addEventListener("click", async () => {
  console.log("clicou modelo7");

  setLoading(true, "Abrindo o Modelo 7...");

  try {
    const res = await window.api.runModelo7([]);
    console.log("resultado modelo7:", res);

    if (!res?.ok) {
      alert(res?.err || "Falhou ao executar o Modelo7");
    }
  } finally {
    setLoading(false);
  }
});


window.carregarNoticias = carregarNoticias;

window.addEventListener("click", (e) => {
  const insideParser = e.target.closest("#menu-parser, #parser-submenu");
  const insideScraper = e.target.closest("#menu-scraper, #scraper-submenu");

  // se clicar fora do parser
  if (!insideParser) {
    window.closeParserMenu?.(true);
  }

  // se clicar fora do scraper
  if (!insideScraper) {
    window.closeScraperMenu?.(true);
  }
}, true); // 👈 o segredo está aqui: use capture = true