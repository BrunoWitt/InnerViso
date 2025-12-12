// src/scripts/src_parser.js
function initParser() {
  console.log("initParser inicializado");
  console.log("initParser chamado — view wsvisoparser carregada");

  const btnEnt = document.getElementById("btnSelectEntrada");
  const lblEnt = document.getElementById("entradaLabel");
  const btnSai = document.getElementById("btnSelectSaida");
  const lblSai = document.getElementById("saidaLabel");
  const btnRun = document.getElementById("btnIniciar");
  const btnSave = document.getElementById("btnSalvar");
  const btnClean = document.getElementById("btnLimpar");

  // ========= helpers =========
  function bindSafe(el, event, handler) {
    if (!el) return;
    const key = `__handler_${event}`;
    if (el[key]) el.removeEventListener(event, el[key]);
    el.addEventListener(event, handler);
    el[key] = handler;
  }

  // ========= carregar padrao.json =========
  async function carregarJson() {
    try {
      console.log("📂 Verificando padrao.json...");
      const data = await window.api.fileExists("padrao.json");
      if (!data) {
        console.log("❌ Arquivo padrao.json não encontrado.");
        return;
      }

      if (data.entrada) {
        lblEnt.value = data.entrada;
        console.log("✅ Caminho de entrada restaurado:", data.entrada);
      }
      if (data.saida) {
        lblSai.value = data.saida;
        console.log("✅ Caminho de saída restaurado:", data.saida);
      }
    } catch (error) {
      console.error("⚠️ Erro ao carregar padrao.json:", error);
    }
  }

  carregarJson();

  // ========= limpar config =========
  btnClean?.addEventListener("click", async () => {
    lblEnt.value = "Nenhum selecionado";
    lblSai.value = "Nenhum selecionado";

    try {
      const result = await window.api.clearPaths();
      if (result.success) {
        alert("Configurações limpas com sucesso!");
      } else {
        alert("Nenhum arquivo de configuração encontrado para limpar.");
      }
    } catch (error) {
      console.error("Erro ao limpar configurações:", error);
      alert("Erro ao limpar configurações. Veja o console para mais detalhes.");
    }
  });

  // ========= abrir pasta de saída =========
  let openingFolder = false;

  requestAnimationFrame(() => {
    const btnAbrir = document.getElementById("btnAbrir");
    const lblSai2 = document.getElementById("saidaLabel");

    bindSafe(btnAbrir, "click", async () => {
      if (openingFolder) return;

      const pasta_saida = (lblSai2?.value || "").trim();
      if (!pasta_saida || /nenhum selecionado/i.test(pasta_saida)) {
        alert("Selecione uma pasta de saída antes de abrir.");
        return;
      }

      if (!window.api?.openFolder) {
        console.warn("API openFolder indisponível no preload.");
        alert("Não foi possível abrir a pasta (API indisponível).");
        return;
      }

      openingFolder = true;
      try {
        const r = await window.api.openFolder(pasta_saida);
        if (!r?.ok) {
          console.error("Falha ao abrir pasta:", r?.error);
          alert(
            `Não consegui abrir a pasta:\n${pasta_saida}\n\nDetalhe: ${
              r?.error || "erro desconhecido"
            }`
          );
        }
      } finally {
        openingFolder = false;
      }
    });
  });

  // ========= valida elementos =========
  if (!btnEnt || !btnSai || !btnRun) {
    console.warn("⚠️ Elementos da view wsvisoparser ainda não estão disponíveis.");
    return;
  }

  // ========= salvar caminhos =========
  btnSave?.addEventListener("click", async () => {
    const entrada = lblEnt.value;
    const saida = lblSai.value;
    await window.api.savePath(entrada, saida);
    alert("Caminhos salvos com sucesso!");
  });

  // ========= dropdown entrada =========
  const dropdown = document.createElement("div");
  dropdown.className = "dropdown";

  const optPasta = document.createElement("button");
  optPasta.textContent = "Selecionar pasta...";
  const optZip = document.createElement("button");
  optZip.textContent = "Selecionar .zip...";

  dropdown.appendChild(optPasta);
  dropdown.appendChild(optZip);
  document.body.appendChild(dropdown);

  btnEnt.addEventListener("click", () => {
    const rect = btnEnt.getBoundingClientRect();
    dropdown.style.left = `${rect.left}px`;
    dropdown.style.top = `${rect.bottom + window.scrollY}px`;
    dropdown.style.display = dropdown.style.display === "flex" ? "none" : "flex";
  });

  document.addEventListener("click", (e) => {
    if (!dropdown.contains(e.target) && e.target !== btnEnt) {
      dropdown.style.display = "none";
    }
  });

  optPasta.addEventListener("click", async () => {
    dropdown.style.display = "none";
    const caminho = await window.api.selectFolder(true);
    if (caminho) lblEnt.value = caminho;
  });

  optZip.addEventListener("click", async () => {
    dropdown.style.display = "none";

    if (!window.api?.selectFileZip) {
      alert("Função selectFileZip não está disponível.");
      return;
    }

    const caminho = await window.api.selectFileZip();
    if (caminho) {
      lblEnt.value = caminho;
      console.log("📦 ZIP de entrada (no servidor):", caminho);
    }
  });

  // ========= selecionar saída =========
  btnSai.addEventListener("click", async () => {
    const caminho = await window.api.selectFolder(false);
    if (caminho) lblSai.value = caminho;
  });

  // ========= executar parser =========
  btnRun.addEventListener("click", async () => {
    const entrada = lblEnt.value;
    const saida = lblSai.value;
    const tipoParser = document.querySelector('input[name="parser"]:checked')?.value;

    const status = document.getElementById("statusLabel");
    const overlay = document.getElementById("loadingOverlay");
    const progressBar = document.getElementById("progressBar");
    const loadingText = document.getElementById("loadingText");
    const progressCount = document.getElementById("progressCount");
    const btnCancelar = document.getElementById("btnCancelar");

    const token = Date.now().toString();

    status.textContent = "⏳ Iniciando parser...";
    btnRun.disabled = true;
    overlay.style.display = "flex";

    let cancelado = false;
    let progTimer, doneTimer;

    btnCancelar.onclick = async () => {
      cancelado = true;
      loadingText.textContent = "Cancelado.";
      status.textContent = "🛑 Execução cancelada pelo usuário.";
      clearInterval(progTimer);
      clearInterval(doneTimer);
      overlay.style.display = "none";
      btnRun.disabled = false;
      const r = await window.api.parserCancel(token);
      if (!r?.ok) console.warn("Falha ao solicitar cancelamento:", r?.error);
    };

    progTimer = setInterval(async () => {
      if (cancelado) return;
        const pr = await window.api.parserProgress(token);
      if (pr?.ok && pr.exists) {
        const atual = pr.current || 0;
        const total = pr.total || 0;
        const pct = total ? Math.min(100, (atual / total) * 100) : 0;
        progressBar.style.width = pct + "%";
        progressCount.textContent = `${atual}/${total}`;
        loadingText.textContent = `Processando... (${atual}/${total})`;
      }
    }, 600);

    try {
      await window.api.iniciarParser(entrada, saida, tipoParser, token);
    } catch (err) {
      console.error("Erro ao iniciar parser:", err);
      clearInterval(progTimer);
      overlay.style.display = "none";
      btnRun.disabled = false;
      alert(`Erro ao iniciar parser:\n${err?.message || err}`);
      return;
    }

    // polling de finalização via token (Node sabe a saidaServidor)
    doneTimer = setInterval(async () => {
      if (cancelado) return;

      const st = await window.api.parserStatus(token);

      if (!st?.ok) {
        clearInterval(progTimer);
        clearInterval(doneTimer);
        overlay.style.display = "none";
        btnRun.disabled = false;
        alert(`Falha ao consultar status:\n${st?.error || "desconhecido"}`);
        return;
      }

      if (st.state === "error") {
        clearInterval(progTimer);
        clearInterval(doneTimer);
        status.textContent = "❌ Falha na execução.";
        overlay.style.display = "none";
        btnRun.disabled = false;
        alert(`Erro no parser:\n${st.message || "desconhecido"}`);
        return;
      }

      if (st.state === "done") {
        clearInterval(progTimer);
        clearInterval(doneTimer);
        status.textContent = "✅ Execução concluída!";
        overlay.style.display = "none";
        btnRun.disabled = false;

        const result = st.result;
        if (result) {
          mostrarResumo({
            Resultado: result?.Resultado || result?.status || "Concluído",
            Resumo: result?.Resumo || {},
            Log: result?.Log || {},
          });
        }
      }
    }, 800);
  });

  // ========= popup resumo =========
  function mostrarResumo(data) {
    const modal = document.getElementById("popupResumo");
    if (!modal) return;

    modal.style.display = "flex";
    document.getElementById("resStatus").textContent = data.Resultado || "—";

    const resumo = data.Resumo || {};
    document.getElementById("resInicio").textContent = resumo.inicio || "—";
    document.getElementById("resFim").textContent = resumo.fim || "—";
    document.getElementById("resDuracao").textContent = (resumo.duracao_seg ?? "—") + " s";
    document.getElementById("resArq").textContent = resumo.arquivos_encontrados ?? "—";
    document.getElementById("resOk").textContent = resumo.arquivos_processados_ok ?? "—";
    document.getElementById("resErros").textContent = resumo.qtd_erros ?? "—";

    const listaErros = resumo.erros?.length ? resumo.erros.join("\n") : "— sem erros —";
    document.getElementById("resListaErros").textContent = listaErros;

    document.getElementById("resLog").textContent = data.Log?.trecho || "— log não disponível —";
  }

  const btnFechar = document.getElementById("btnFecharPopup");
  if (btnFechar) {
    btnFechar.addEventListener("click", () => {
      document.getElementById("popupResumo").style.display = "none";
    });
  }
}

// 🔸 expõe globalmente para o router.js chamar depois de carregar o HTML
window.initParser = initParser;
