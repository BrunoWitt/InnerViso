// src/scripts/src_parser.js

function initParser() {
  console.log("🔥 initParser inicializado");
  console.log("initParser chamado — view wsvisoparser carregada");

  const btnEnt = document.getElementById("btnSelectEntrada");
  const lblEnt = document.getElementById("entradaLabel");
  const btnSai = document.getElementById("btnSelectSaida");
  const lblSai = document.getElementById("saidaLabel");
  const btnRun = document.getElementById("btnIniciar");

  if (!btnEnt || !btnSai || !btnRun) {
    console.warn("⚠️ Elementos da view wsvisoparser ainda não estão disponíveis.");
    return;
  }

  // Selecionar pasta/ZIP de ENTRADA
  btnEnt.addEventListener("click", async () => {
    const caminho = await window.api.selectFolder();
    if (caminho) lblEnt.value = caminho;
  });

  // Selecionar pasta de SAÍDA
  btnSai.addEventListener("click", async () => {
    const caminho = await window.api.selectFolder();
    if (caminho) lblSai.value = caminho;
  });

  // Executar parser
  btnRun.addEventListener("click", async () => {
    console.log("➡️ Botão clicado!");
    const selecionado = document.querySelector('input[name="parser"]:checked');
    const tipoParser = selecionado ? selecionado.value : null;

    const entrada = lblEnt.value;
    const saida = lblSai.value;

    console.log("Tipo parser:", tipoParser);
    console.log("Entrada:", entrada);
    console.log("Saída:", saida);

    if (!entrada || entrada === "Nenhum selecionado") {
      alert("Por favor, selecione a pasta ou arquivo ZIP de entrada.");
      return;
    }
    if (!saida || saida === "Nenhum selecionado") {
      alert("Por favor, selecione a pasta de saída.");
      return;
    }

    const status = document.getElementById("statusLabel");
    status.textContent = "⏳ Executando parser... Aguarde.";
    btnRun.disabled = true;

    try {
      const result = await window.api.iniciarParser(entrada, saida, tipoParser);
      console.log("Resposta do parser:", result);

      if (result.success) {
        mostrarResumo(result.data);
        status.textContent = "✅ Execução concluída.";
      } else {
        status.textContent = "❌ Erro: " + result.error;
        alert("Erro ao executar parser: " + result.error);
      }
    } catch (err) {
      console.error(err);
      status.textContent = "❌ Falha na comunicação com o backend.";
    } finally {
      btnRun.disabled = false;
    }
  });

  // Função de exibição de resumo
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

    document.getElementById("resLog").textContent = data.Log?.trecho || "";
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
