const { ipcMain } = require("electron");
const axios = require("axios");

function registerColetarDiIpc() {
  const running = new Map();

  // ============================
  // CANCELAR COLETA
  // ============================
  ipcMain.handle("cancelar-coletar-di", async (event) => {
    const run = running.get(event.sender.id);
    if (!run) return { ok: false };

    if (run.controller) run.controller.abort();
    return { ok: true };
  });

  // ============================
  // COLETAR DI
  // ============================
  ipcMain.handle("coletar-di", async (event) => {
    const controller = new AbortController();
    running.set(event.sender.id, { controller });

    try {
      // 🔴 URL REAL DO BACKEND
      const url = "http://10.0.0.230:1071/di/collect/today";

      const resp = await axios.get(url, {
        timeout: 0,
        signal: controller.signal,
      });

      const data = resp?.data ?? {};

      /*
        Exemplo real do backend:
        {
          sistema: "...",
          process: "...",
          responses: [
            { response: "2608320570", warning: null, exceptions: null },
            { response: "2608320202", warning: null, exceptions: null },
            { response: null, warning: "Foram coletados 3 DIs...", exceptions: null }
          ]
        }
      */

      // 🔹 Extrai SOMENTE responses[].response válidos
      const dis = Array.isArray(data.responses)
        ? data.responses
            .map((r) => r?.response)
            .filter(
              (v) =>
                typeof v === "string" &&
                v.trim().length > 0
            )
        : [];

      return {
        status: "sucesso",
        dis,
        mensagem: dis.length
          ? `Foram coletadas ${dis.length} DIs:\n\n${dis.join(", ")}`
          : "Nenhuma DI encontrada.",
      };
    } catch (err) {
      if (
        err?.name === "CanceledError" ||
        err?.name === "AbortError"
      ) {
        return {
          status: "erro",
          mensagem: "Coleta cancelada pelo usuário.",
        };
      }

      return {
        status: "erro",
        mensagem: `Erro ao coletar DIs: ${err?.message || err}`,
      };
    } finally {
      running.delete(event.sender.id);
    }
  });
}

module.exports = { registerColetarDiIpc };
