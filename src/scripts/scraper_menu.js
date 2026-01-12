// ../scripts/scraper_menu.js
(() => {
  if (window.__scraperMenuInitialized) return;
  window.__scraperMenuInitialized = true;

  const MODE_TO_VIEW = {
    // DI
    "coletar-di": "coletarDi",
    "coletar-di-cnpj": "coletarDiCnpj",
    "baixar-di": "baixarDi",
    "baixar-di-pdf": "baixarDiPdf",

    // LI
    "coletar-li": "coletarLi",
    "coletar-li-cnpj": "coletarLiCnpj",
    "baixar-li": "baixarLi",

    // ATO
    "baixar-ato": "baixarAto",
    "baixar-ato-cnpj": "baixarAtoCnpj",

    // DUE
    "due-download": "baixarDue",
  };

  const scraperBtn = document.getElementById("menu-scraper");
  const submenu = document.getElementById("scraper-submenu");
  if (!scraperBtn || !submenu) return;

  function openScraperMenu(save = true) {
    submenu.style.display = "flex";
    scraperBtn.classList.add("is-open");
    scraperBtn.querySelector(".menu-caret").textContent = "▾";
    if (save) localStorage.setItem("scraper_submenu_open", "1");
  }

  function closeScraperMenu(save = true) {
    submenu.style.display = "none";
    scraperBtn.classList.remove("is-open");
    scraperBtn.querySelector(".menu-caret").textContent = "▸";
    if (save) localStorage.setItem("scraper_submenu_open", "0");
  }

  function clearActive() {
    document
      .querySelectorAll(".menu-item.active, .submenu-item.active")
      .forEach((el) => el.classList.remove("active"));
  }

  function setActiveMenu({ view, mode } = {}) {
    clearActive();

    if (mode) {
      const child = document.querySelector(`.submenu-item[data-mode="${mode}"]`);
      child?.classList.add("active");

      const scraperParent = document.querySelector(`.menu-item[data-view="scraper"]`);
      scraperParent?.classList.add("active");

      openScraperMenu(false);
    }
  }

  window.setActiveMenu = setActiveMenu;
  window.closeScraperMenu = closeScraperMenu;
  window.openScraperMenu = openScraperMenu;

  // restaurar estado
  const savedOpen = localStorage.getItem("scraper_submenu_open");
  if (savedOpen !== "0") openScraperMenu(false);
  else closeScraperMenu(false);

  const initialMode = localStorage.getItem("scraper_mode");
  if (initialMode) {
    const btn = submenu.querySelector(`.submenu-item[data-mode="${initialMode}"]`);
    btn?.classList.add("active");
  }

  // clique no botão SCRAPER (apenas abre/fecha)
  scraperBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = submenu.style.display === "flex";
    isOpen ? closeScraperMenu(true) : openScraperMenu(true);
  });

  // clique nos submenus sem filhos
  submenu
    .querySelectorAll(".submenu-item:not(.has-children)")
    .forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();

        const mode = btn.dataset.mode;
        if (!mode) return;

        localStorage.setItem("scraper_mode", mode);

        if (MODE_TO_VIEW[mode]) {
          window.loadView?.(MODE_TO_VIEW[mode]);
          setActiveMenu({ mode });
          return;
        }

        window.loadView?.("scraper");
        setActiveMenu({ mode });
      });
    });

  // hub / comparador
  document
    .querySelectorAll('.menu-item[data-view="hub"], .menu-item[data-view="comparador"]')
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        closeScraperMenu(true);
        window.loadView?.(btn.dataset.view);
        clearActive();
      });
    });

  // sub-submenus (DI / LI / ATO / DUE)
  submenu.querySelectorAll(".submenu-item.has-children").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const nested = btn.nextElementSibling;
      if (!nested || !nested.classList.contains("nested")) return;

      const isExpanded = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", String(!isExpanded));
      nested.hidden = isExpanded;
    });
  });
})();