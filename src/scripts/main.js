// src/scripts/main.js
async function carregarNoticias() {
  const expC = document.getElementById('news-exp');
  const impC = document.getElementById('news-imp');
  const sisC = document.getElementById('news-sis');

  if (!expC || !impC || !sisC) return;

  expC.innerHTML = impC.innerHTML = sisC.innerHTML = '<p>Carregando…</p>';

  try {
    // 1) gera o JSON com Python
    await window.api.runScraper();
    // 2) lê o JSON
    const data = await window.api.readNotices();

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

// 🔸 EXPOE como global para o router chamar depois de carregar a view
window.carregarNoticias = carregarNoticias;