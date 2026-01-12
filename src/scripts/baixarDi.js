function initBaixarDi() {
  console.log("[baixarDi] iniciado");

  const btnAdicionar = document.getElementById("add-code-btn");
  const btnAdicionarSaida = document.getElementById("choose-folder-btn");
  const btnParser = document.getElementById("run-parser-btn");
  const btnAbrirPasta = document.getElementById("open-folder-btn");

  const lblCode = document.getElementById("code-input");
  const lblSaida = document.getElementById("output-path-input");
  const listContainer = document.getElementById("codes-list");

  const loadingOverlay = document.getElementById("loading-overlay");
  const btnCancelar = document.getElementById("cancel-parser-btn");

  const progressMsg = document.getElementById("expo8-progress-message");
  const progressCount = document.getElementById("expo8-progress-count");
  const progressWrap = document.getElementById("expo8-progress-wrap");
  const progressFill = document.getElementById("expo8-progress-fill");

  let cancelRequested = false;

  // =========================
  // LISTA DE DIs
  // =========================
  window.listDis = [];

  function renderList() {
    listContainer.innerHTML = "";

    window.listDis.forEach((di, index) => {
      const item = document.createElement("div");
      item.className = "codes-list-item";

      const span = document.createElement("span");
      span.textContent = di;

      const btnRemove = document.createElement("button");
      btnRemove.className = "secondary";
      btnRemove.textContent = "Remover";

      btnRemove.addEventListener("click", () => {
        window.listDis.splice(index, 1);
        renderList();
      });

      item.appendChild(span);
      item.appendChild(btnRemove);
      listContainer.appendChild(item);
    });
  }

  // =========================
  // LOADING / PROGRESS
  // =========================
  function setLoading(isLoading) {
    if (isLoading) {
      loadingOverlay.classList.remove("hidden");
      if (progressMsg) progressMsg.textContent = "Iniciando download das DIs...";
      if (progressCount) progressCount.textContent = "0 / 0";
      if (progressFill) progressFill.style.width = "0%";
      if (progressWrap) progressWrap.style.display = "none";
    } else {
      loadingOverlay.classList.add("hidden");
    }

    btnAdicionar.disabled = isLoading;
    btnAdicionarSaida.disabled = isLoading;
    btnParser.disabled = isLoading;
    lblCode.disabled = isLoading;

    if (btnCancelar) {
      btnCancelar.disabled = !isLoading;
      btnCancelar.textContent = cancelRequested ? "Cancelando..." : "Cancelar";
    }
  }

  // =========================
  // CANCELAR
  // =========================
  if (btnCancelar) {
    btnCancelar.addEventListener("click", async () => {
      if (cancelRequested) return;
      cancelRequested = true;
      btnCancelar.disabled = true;
      btnCancelar.textContent = "Cancelando...";

      try {
        await window.api.cancelBaixarDi();
      } catch (e) {
        console.warn("Falha ao cancelar Baixar DI:", e);
      }
    });
  }

  // =========================
  // ADICIONAR DIs
  // =========================
  btnAdicionar.addEventListener("click", () => {
    const value = lblCode.value;
    if (!value) return;

    const regex = /[,\s]+/;

    const dis = value
      .split(regex)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    window.listDis.push(...dis);
    lblCode.value = "";
    renderList();
  });

  // =========================
  // SELECIONAR PASTA
  // =========================
  btnAdicionarSaida.addEventListener("click", async () => {
    const caminho = await window.api.selectFolder(false);
    if (caminho) {
      lblSaida.value = caminho;
    }
  });

  // =========================
  // ABRIR PASTA
  // =========================
  let openingFolder = false;

  btnAbrirPasta.addEventListener("click", async () => {
    if (openingFolder) return;

    const pasta = (lblSaida?.value || "").trim();
    if (!pasta || /nenhum selecionado/i.test(pasta)) {
      alert("Selecione uma pasta de saída antes de abrir.");
      return;
    }

    openingFolder = true;
    try {
      const r = await window.api.openFolder(pasta);
      const isErro =
        (typeof r === "string" && r.trim().length > 0) ||
        (r && r.status === false) ||
        (r && r.error);

      if (isErro) {
        alert(`Não consegui abrir a pasta:\n${pasta}`);
      }
    } finally {
      openingFolder = false;
    }
  });

  // =========================
  // EXECUTAR DOWNLOAD
  // =========================
  btnParser.addEventListener("click", async () => {
    const pathOut = lblSaida.value;

    if (!window.listDis.length) {
      alert("Adicione pelo menos uma DI.");
      return;
    }

    if (!pathOut) {
      alert("Selecione uma pasta de saída.");
      return;
    }

    cancelRequested = false;
    setLoading(true);

    try {
      const result = await window.api.baixarDi(window.listDis, pathOut);

      if (result?.status === "sucesso") {
        alert(result.mensagem || "Download das DIs concluído com sucesso.");
      } else {
        alert(result?.mensagem || "Erro ao baixar DIs.");
      }
    } catch (e) {
      alert("Erro inesperado durante o download das DIs.");
    } finally {
      cancelRequested = false;
      setLoading(false);
    }
  });
}

window.initBaixarDi = initBaixarDi;