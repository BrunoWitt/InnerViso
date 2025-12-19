function initParserMenu() {
  const btnParser = document.getElementById("menu-parser");
  const submenu = document.getElementById("parser-submenu");
  const caret = document.getElementById("parser-caret");

  if (!btnParser || !submenu || !caret) return;

  // estado inicial
  const savedOpen = localStorage.getItem("parser_submenu_open");
  const isOpen = savedOpen !== "0"; // default aberto
  submenu.classList.toggle("open", isOpen);
  caret.textContent = isOpen ? "▾" : "▸";

  function toggleSubmenu() {
    const open = submenu.classList.toggle("open");
    caret.textContent = open ? "▾" : "▸";
    localStorage.setItem("parser_submenu_open", open ? "1" : "0");
  }

  // clique no PARSER: abre/fecha e carrega a view parser
  btnParser.addEventListener("click", () => {
    toggleSubmenu();

    if (!localStorage.getItem("parser_mode")) {
      localStorage.setItem("parser_mode", "import");
    }

    window.loadView?.("parser");
  });

  // clique nas opções do submenu
  submenu.querySelectorAll(".submenu-item").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();

      const mode = btn.dataset.mode; // import/export
      localStorage.setItem("parser_mode", mode);

      // marca ativo visual
      submenu.querySelectorAll(".submenu-item").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      window.loadView?.("parser");
    });
  });

  // marca ativo na primeira carga
  const mode = localStorage.getItem("parser_mode") || "import";
  submenu.querySelectorAll(".submenu-item").forEach((b) => {
    b.classList.toggle("active", b.dataset.mode === mode);
  });
}

window.initParserMenu = initParserMenu;
