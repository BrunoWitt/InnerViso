// src/scripts/src_comparador.js
console.log("[comparador] script carregado");

function initComparador() {
  // Não precisa de requestAnimationFrame se você chamar só depois
  // que a view já foi injetada pelo router.
  const btnCompare   = document.getElementById("btnComparar");
  const btnLimpar    = document.getElementById("btnLimpar");
  const lblList1     = document.getElementById("lista1");
  const lblList2     = document.getElementById("lista2");
  const lblResultado = document.getElementById("lista3");
  const spanQtd      = document.getElementById("qtdItens");
  const btnCopiar    = document.getElementById("btnCopiar");

  if (!btnCompare || !btnLimpar || !lblList1 || !lblList2 || !lblResultado) {
    console.warn("[comparador] Elementos do comparador não encontrados.");
    return;
  }

  console.log("✅ initComparador carregado!");

  btnLimpar.addEventListener("click", () => {
    lblList1.value = "Nenhum selecionado";
    lblList2.value = "Nenhum selecionado";
    lblResultado.value = "";
    if (spanQtd) spanQtd.textContent = "Quantidade de itens: 0";
  });

  btnCompare.addEventListener("click", async () => {
    console.log("🔄 Iniciando comparação...");
    const strList1 = lblList1.value || "";
    const strList2 = lblList2.value || "";

    try {
      const compareResult = await window.api.compararListas(strList1, strList2);
      const resultStr = compareResult || "Sem resultado";
      lblResultado.value = resultStr;

      if (spanQtd) {
        const qtd = resultStr
          .split(",")
          .map(v => v.trim())
          .filter(v => v !== "").length;
        spanQtd.textContent = `Quantidade de itens: ${qtd}`;
      }
    } catch (err) {
      console.error("[comparador] Erro ao comparar:", err);
      lblResultado.value = `Erro: ${err?.message || err}`;
    }
  });

  if (btnCopiar && navigator.clipboard) {
  btnCopiar.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(lblResultado.value || "");
      console.log("📋 Resultado copiado para a área de transferência.");

      // Mostra o toast
      const toast = document.getElementById("toast");
      if (toast) {
        toast.textContent = "Resultado copiado!";
        toast.classList.add("show");

        // Esconde automaticamente após 2 segundos
        setTimeout(() => toast.classList.remove("show"), 2000);
      }

    } catch (err) {
      console.error("Erro ao copiar:", err);
    }
  });
}

}

// expõe para o router
window.initComparador = initComparador;
