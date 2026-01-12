// ../scripts/parser_menu.js
(() => {
  // Evita bind duplicado
  if (window.__parserMenuInitialized) return;
  window.__parserMenuInitialized = true;

  const parserBtn = document.getElementById("menu-parser");
  const submenu = document.getElementById("parser-submenu");

  if (!parserBtn || !submenu) return;

  function openParserMenu(save = true) {
    submenu.style.display = "flex";
    parserBtn.classList.add("is-open");
    parserBtn.querySelector(".menu-caret").textContent = "▾";
    if (save) localStorage.setItem("parser_submenu_open", "1");
  }

  function closeParserMenu(save = true) {
    submenu.style.display = "none";
    parserBtn.classList.remove("is-open");
    parserBtn.querySelector(".menu-caret").textContent = "▸";
    if (save) localStorage.setItem("parser_submenu_open", "0");
  }

  function clearActive() {
    document
      .querySelectorAll(".menu-item.active, .submenu-item.active")
      .forEach((el) => el.classList.remove("active"));
  }

  function setActiveMenu({ view, mode } = {}) {
    clearActive();

    // Ativa o pai
    if (view) {
      const parent = document.querySelector(`.menu-item[data-view="${view}"]`);
      parent?.classList.add("active");
    }

    // Ativa o filho (Import/Export)
    if (mode) {
      const child = document.querySelector(`.submenu-item[data-mode="${mode}"]`);
      child?.classList.add("active");

      // garante Parser ativo
      const parserParent = document.querySelector(`.menu-item[data-view="parser"]`);
      parserParent?.classList.add("active");

      // mantém submenu aberto quando estiver no parser
      openParserMenu(false);
    }
  }

  // Expor pro router se quiser usar depois
  window.setActiveMenu = setActiveMenu;
  window.closeParserMenu = closeParserMenu;
  window.openParserMenu = openParserMenu;

  // ======= Estado inicial do submenu =======
  const savedOpen = localStorage.getItem("parser_submenu_open");
  const shouldOpen = savedOpen !== "0"; // default aberto
  if (shouldOpen) openParserMenu(false);
  else closeParserMenu(false);

  // ======= Estado inicial do modo parser (ativo) =======
  const initialMode = localStorage.getItem("parser_mode") || "import";
  submenu.querySelectorAll(".submenu-item").forEach((b) => {
    b.classList.toggle("active", b.dataset.mode === initialMode);
  });

  // ======= Clique no PARSER =======
  parserBtn.addEventListener("click", (e) => {
    e.stopPropagation();

    // toggle submenu
    const isOpen = submenu.style.display === "flex";
    if (isOpen) closeParserMenu(true);
    else openParserMenu(true);

    // garante mode padrão
    if (!localStorage.getItem("parser_mode")) {
      localStorage.setItem("parser_mode", "import");
    }

    // navega pro parser
    window.loadView?.("parser");

    // marca ativo (parser + mode atual)
    const mode = localStorage.getItem("parser_mode") || "import";
    setActiveMenu({ view: "parser", mode });
  });

  // ======= Clique nos filhos: Import/Export =======
  submenu.querySelectorAll(".submenu-item").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();

      const mode = btn.dataset.mode; // import/export
      localStorage.setItem("parser_mode", mode);

      // navega pro parser
      window.loadView?.("parser");

      // marca ativo e mantém submenu aberto
      setActiveMenu({ view: "parser", mode });
    });
  });

  // ======= Clique em HUB/COMPARADOR =======
  document
    .querySelectorAll('.menu-item[data-view="hub"], .menu-item[data-view="comparador"]')
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        // fecha submenu e limpa active do subitem
        closeParserMenu(true);

        // navega
        const view = btn.dataset.view;
        window.loadView?.(view);

        // ativo somente no pai
        setActiveMenu({ view });
      });
    });

  // ======= Fecha submenu ao clicar fora (opcional) =======
})();
