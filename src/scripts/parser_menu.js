(() => {
  if (window.__parserMenuInitialized) return;
  window.__parserMenuInitialized = true;

  const MODE_TO_VIEW = {
    importacao: "wsvisoparser",
    expo8: "expo8",
    "baixar-re": "downloadRe", // ✅ aqui
  };

  const parserBtn = document.getElementById("menu-parser");
  const submenu = document.getElementById("parser-submenu");
  if (!parserBtn || !submenu) return;

  const exportGroupBtn = submenu.querySelector(".submenu-item.has-children");
  const exportNested = exportGroupBtn?.nextElementSibling;

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

  function openExportGroup(save = true) {
    if (!exportGroupBtn || !exportNested) return;
    exportGroupBtn.setAttribute("aria-expanded", "true");
    exportNested.hidden = false;
    exportGroupBtn.querySelector(".menu-caret").textContent = "▾";
    if (save) localStorage.setItem("parser_export_open", "1");
  }

  function closeExportGroup(save = true) {
    if (!exportGroupBtn || !exportNested) return;
    exportGroupBtn.setAttribute("aria-expanded", "false");
    exportNested.hidden = true;
    exportGroupBtn.querySelector(".menu-caret").textContent = "▸";
    if (save) localStorage.setItem("parser_export_open", "0");
  }

  function toggleExportGroup() {
    const isExpanded = exportGroupBtn?.getAttribute("aria-expanded") === "true";
    isExpanded ? closeExportGroup(true) : openExportGroup(true);
  }

  function clearActive() {
    document
      .querySelectorAll(".menu-item.active, .submenu-item.active")
      .forEach((el) => el.classList.remove("active"));
  }

  function setActiveParser(mode) {
    clearActive();
    parserBtn.classList.add("active");

    const btn = submenu.querySelector(`.submenu-item[data-mode="${mode}"]`);
    btn?.classList.add("active");

    if (mode === "expo8" || mode === "baixar-re") {
      exportGroupBtn?.classList.add("active");
      openExportGroup(false);
    } else {
      exportGroupBtn?.classList.remove("active");
    }

    openParserMenu(false);
  }

  window.closeParserMenu = closeParserMenu;
  window.openParserMenu = openParserMenu;

  const savedOpen = localStorage.getItem("parser_submenu_open");
  if (savedOpen !== "0") openParserMenu(false);
  else closeParserMenu(false);

  const savedExportOpen = localStorage.getItem("parser_export_open");
  if (savedExportOpen === "1") openExportGroup(false);
  else closeExportGroup(false);

  const initialMode = localStorage.getItem("parser_mode") || "importacao";
  setActiveParser(initialMode);

  parserBtn.addEventListener("click", (e) => {
    e.stopPropagation();

    const isOpen = submenu.style.display === "flex";
    isOpen ? closeParserMenu(true) : openParserMenu(true);

    const mode = localStorage.getItem("parser_mode") || "importacao";
    setActiveParser(mode);

    const view = MODE_TO_VIEW[mode] || "wsvisoparser";
    window.loadView?.(view);
  });

  exportGroupBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleExportGroup();
  });

  submenu
    .querySelectorAll('.submenu-item[data-mode]:not(.has-children)')
    .forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();

        const mode = btn.dataset.mode;
        if (!mode) return;

        localStorage.setItem("parser_mode", mode);
        setActiveParser(mode);

        const view = MODE_TO_VIEW[mode] || "wsvisoparser";
        window.loadView?.(view);
      });
    });
})();
