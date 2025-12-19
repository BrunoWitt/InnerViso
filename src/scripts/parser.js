function cleanupFloatingUI() {
  // remove dropdown órfão do wsvisoparser (selecionar pasta/zip)
  document.querySelectorAll(".dropdown").forEach((el) => el.remove());
}

function bindParserMenu() {
  // garante que não vai bindar de novo a cada troca de view
  if (window.__parserMenuBound) return;
  window.__parserMenuBound = true;

  const btnParser = document.getElementById("menu-parser");
  const submenu = document.getElementById("parser-submenu");
  const caret = document.getElementById("parser-caret");

  if (!btnParser || !submenu) return;

  function setCaret(open) {
    if (caret) caret.textContent = open ? "▾" : "▸";
  }

  function setOpen(open) {
    submenu.classList.toggle("open", open);
    setCaret(open);
  }

  // estado inicial
  setOpen(submenu.classList.contains("open"));

  btnParser.addEventListener("click", () => {
    cleanupFloatingUI();

    if (!localStorage.getItem("parser_mode")) {
      localStorage.setItem("parser_mode", "import");
    }

    // alterna abrir/fechar submenu
    setOpen(!submenu.classList.contains("open"));

    // carrega o shell do parser
    window.loadView?.("parser");
  });

  submenu.querySelectorAll(".submenu-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      cleanupFloatingUI();

      const mode = btn.dataset.mode; // import/export
      localStorage.setItem("parser_mode", mode);

      // (opcional) fecha submenu após escolher
      setOpen(false);

      window.loadView?.("parser");
    });
  });
}

function initParserShell() {
  const inner = document.getElementById("parser-inner");
  if (!inner) return;

  cleanupFloatingUI();

  const mode = localStorage.getItem("parser_mode") || "import";
  const viewName = mode === "export" ? "expo8" : "wsvisoparser";

  // marca submenu ativo
  document.querySelectorAll("#parser-submenu .submenu-item").forEach((b) => {
    b.classList.toggle("active", b.dataset.mode === mode);
  });

  loadInnerView(viewName);

  async function loadInnerView(name) {
    inner.innerHTML = "<p>Carregando...</p>";

    const html = await window.api.loadView(name);

    cleanupFloatingUI(); // mata dropdown órfão antes de injetar view filha
    inner.innerHTML = html;

    const fn = window.initializers?.[name];
    if (typeof fn === "function") fn();
  }
}

window.bindParserMenu = bindParserMenu;
window.initParserShell = initParserShell;
