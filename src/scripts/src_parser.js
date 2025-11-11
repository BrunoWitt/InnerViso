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

async function carregarJson() {
  try {
    console.log("📂 Verificando padrao.json...");
    const data = await window.api.fileExists("padrao.json");
    if (!data) {
      console.log("❌ Arquivo padrao.json não encontrado.");
      return;
    }

    // Se veio JSON válido, preenche os campos
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

// logo depois de definir os elementos:
carregarJson();

btnClean.addEventListener("click", async () => {
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


  // 🔹 Aguarda o DOM da view finalizar antes de anexar listeners
  requestAnimationFrame(() => {
    const btnAbrir = document.getElementById("btnAbrir");
    console.log("🔍 btnAbrir encontrado?", !!btnAbrir);

    if (btnAbrir) {
      btnAbrir.addEventListener("click", () => {
        console.log("✅ Clique detectado em Abrir pasta!");
        const pasta_saida = lblSai.value;
        if (!pasta_saida || pasta_saida === "Nenhum selecionado") {
          console.warn("⚠️ Nenhuma pasta de saída selecionada ainda.");
          alert("Selecione uma pasta de saída antes de abrir.");
          return;
        }

        // Se a API de abrir pasta estiver disponível no preload:
        if (window.api?.openFolder) {
          window.api.openFolder(pasta_saida);
        } else {
          console.log("📂 Caminho da pasta:", pasta_saida);
        }
      });
    } else {
      console.warn("⚠️ Botão 'Abrir pasta' não encontrado no DOM.");
    }
  });

  if (!btnEnt || !btnSai || !btnRun) {
    console.warn("⚠️ Elementos da view wsvisoparser ainda não estão disponíveis.");
    return;
  }

  btnSave.addEventListener("click", async (caminho_entrada, caminho_saida) => {
    const entrada = lblEnt.value;
    const saida = lblSai.value;
    await window.api.savePath(entrada, saida);
    alert("Caminhos salvos com sucesso!");
  });

  // Dropdown de seleção de entrada
  const dropdown = document.createElement("div");
  dropdown.className = "dropdown";

  const optPasta = document.createElement("button");
  optPasta.textContent = "Selecionar pasta...";
  const optZip = document.createElement("button");
  optZip.textContent = "Selecionar .zip...";

  dropdown.appendChild(optPasta);
  dropdown.appendChild(optZip);
  document.body.appendChild(dropdown);

  btnEnt.addEventListener("click", (e) => {
    const rect = btnEnt.getBoundingClientRect();
    dropdown.style.left = `${rect.left}px`;
    dropdown.style.top = `${rect.bottom + window.scrollY}px`;
    dropdown.style.display =
      dropdown.style.display === "flex" ? "none" : "flex";
  });

  document.addEventListener("click", (e) => {
    if (!dropdown.contains(e.target) && e.target !== btnEnt) {
      dropdown.style.display = "none";
    }
  });

  // ==============================
  // Ações das opções do dropdown
  // ==============================
  optPasta.addEventListener("click", async () => {
    dropdown.style.display = "none";
    const caminho = await window.api.selectFolder(true);
    if (caminho) lblEnt.value = caminho;
  });

  optZip.addEventListener("click", async () => {
    dropdown.style.display = "none";
    const caminho = await window.api.selectFileZip();
    if (caminho) lblEnt.value = caminho;
  });

  // ==============================
  // Selecionar pasta de saída
  // ==============================
  btnSai.addEventListener("click", async () => {
    const caminho = await window.api.selectFolder(false);
    if (caminho) lblSai.value = caminho;
  });

  // ==============================
  // Botão EXECUTAR PARSER
  // ==============================
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

  const { saidaServidor } = await window.api.prepararParser();

  let cancelado = false;
  let progTimer, doneTimer;

  // 🟥 Corrigido: cancela timers e fecha overlay
  btnCancelar.onclick = () => {
    cancelado = true;
    loadingText.textContent = "Cancelando...";
    status.textContent = "🛑 Execução cancelada pelo usuário.";
    clearInterval(progTimer);
    clearInterval(doneTimer);
    overlay.style.display = "none";
    btnRun.disabled = false;
  };

  // inicia polling de progresso
  progTimer = setInterval(async () => {
    if (cancelado) return; // ✅ para se cancelado
    const progresso = await window.api.lerProgresso(saidaServidor, token);
    if (progresso && progresso.includes("/")) {
      const [atual, total] = progresso.split("/").map(n => parseInt(n || "0", 10));
      const pct = total ? Math.min(100, (atual / total) * 100) : 0;
      progressBar.style.width = pct + "%";
      progressCount.textContent = `${atual}/${total}`;
      loadingText.textContent = `Processando... (${atual}/${total})`;
    }
  }, 600);

  void window.api.iniciarParser(entrada, saida, tipoParser, token, saidaServidor);

  // loop de finalização
  doneTimer = setInterval(async () => {
    if (cancelado) return; // ✅ para se cancelado

    if (await window.api.existeErro(saidaServidor, token)) {
      clearInterval(progTimer);
      clearInterval(doneTimer);
      const msg = await window.api.lerErro(saidaServidor, token);
      status.textContent = "❌ Falha na execução.";
      overlay.style.display = "none";
      btnRun.disabled = false;
      alert(`Erro no parser:\n${msg || 'desconhecido'}`);
      return;
    }

    if (await window.api.existeDone(saidaServidor, token)) {
      clearInterval(progTimer);
      clearInterval(doneTimer);
      const result = await window.api.lerResultado(saidaServidor, token);
      status.textContent = "✅ Execução concluída!";
      overlay.style.display = "none";
      btnRun.disabled = false;

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


  // ==============================
  // Função de exibição de resumo
  // ==============================
  function mostrarResumo(data) {
    const modal = document.getElementById("popupResumo");
    if (!modal) return;

    modal.style.display = "flex";
    document.getElementById("resStatus").textContent = data.Resultado || "—";
    const resumo = data.Resumo || {};
    document.getElementById("resInicio").textContent = resumo.inicio || "—";
    document.getElementById("resFim").textContent = resumo.fim || "—";
    document.getElementById("resDuracao").textContent =
      (resumo.duracao_seg ?? "—") + " s";
    document.getElementById("resArq").textContent =
      resumo.arquivos_encontrados ?? "—";
    document.getElementById("resOk").textContent =
      resumo.arquivos_processados_ok ?? "—";
    document.getElementById("resErros").textContent =
      resumo.qtd_erros ?? "—";

    const listaErros = resumo.erros?.length
      ? resumo.erros.join("\n")
      : "— sem erros —";
    document.getElementById("resListaErros").textContent = listaErros;

    document.getElementById("resLog").textContent =
      data.Log?.trecho || "— log não disponível —";
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
