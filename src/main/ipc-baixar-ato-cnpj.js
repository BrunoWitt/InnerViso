// src/main/ipc-baixar-ato-cnpj.js
const { ipcMain } = require("electron");
const axios = require("axios");

function registerBaixarAtoCnpj() {
    const running = new Map();

    // ✅ evita “ficar preso” em handler antigo / duplicado
    try { ipcMain.removeHandler("cancelar-baixar-ato-cnpj"); } catch {}
    try { ipcMain.removeHandler("baixar-ato-cnpj"); } catch {}

    // ============================
    // CANCELAR BAIXAR ATO (CNPJ)
    // ============================
    ipcMain.handle("cancelar-baixar-ato-cnpj", async (event) => {
        const run = running.get(event.sender.id);
        if (!run) return { ok: false };

        try {
        if (run.controller) run.controller.abort();
        return { ok: true };
        } finally {
        running.delete(event.sender.id);
        }
    });

  // ============================
  // BAIXAR ATO POR CNPJ
  // ============================
    ipcMain.handle("baixar-ato-cnpj", async (event, payload = {}) => {
        const controller = new AbortController();
        running.set(event.sender.id, { controller });

        try {
        const cnpjs = Array.isArray(payload?.cnpjs) ? payload.cnpjs : [];

        const cleanCnpjs = cnpjs
            .map((c) => String(c || "").replace(/\D+/g, ""))
            .filter((c) => c.length === 14);

        if (cleanCnpjs.length === 0) {
            return {
            status: "erro",
            docs: [],
            mensagem: "Nenhum CNPJ válido informado (precisa ter 14 dígitos).",
            };
        }

        const url = "http://10.0.0.230:2026/ato/collect/Documents/due_cnpj";

        const headers = { cnpj: cleanCnpjs.join(",") };

        const resp = await axios.get(url, {
            timeout: 0,
            signal: controller.signal,
            headers,
        });

        const rawData = resp?.data;
        let httpStatus = resp?.status;
        let data = rawData;

        // ✅ wrapper [payload, 200]
        if (Array.isArray(rawData) && rawData.length === 2 && typeof rawData[1] === "number") {
            data = rawData[0];
            httpStatus = rawData[1];
        }

        let docs = [];

        // ✅ CASO PRINCIPAL: backend retorna lista pura
        if (Array.isArray(data)) {
            docs = data
            .map((v) => (v === null || v === undefined ? "" : String(v).trim()))
            .filter((v) => v.length > 0);
        } else if (data && typeof data === "object") {
            let responses = data?.responses;

            if (typeof responses === "string") {
            try { responses = JSON.parse(responses); } catch {}
            }

            if (Array.isArray(responses)) {
            docs = responses
                .map((r) => r?.response ?? r?.file ?? r?.path ?? r?.name ?? r)
                .map((v) => (v === null || v === undefined ? "" : String(v).trim()))
                .filter((v) => v.length > 0);
            }

            if (!docs.length) {
            const candidates =
                data?.documents || data?.docs || data?.files || data?.atos || data?.result;

            if (Array.isArray(candidates)) {
                docs = candidates
                .map((v) => (v === null || v === undefined ? "" : String(v).trim()))
                .filter((v) => v.length > 0);
            }
            }
        } else if (typeof data === "string") {
            docs = String(data)
            .split(/\r?\n|,|;/g)
            .map((s) => s.trim())
            .filter(Boolean);
        }

        docs = Array.from(new Set(docs));

        return {
            status: "sucesso",
            docs,
            mensagem: docs.length
            ? `Foram obtidos ${docs.length} documento(s).`
            : "Nenhum documento encontrado para os CNPJs informados.",
            raw: data,
            httpStatus,
        };
        } catch (err) {
        if (err?.name === "CanceledError" || err?.name === "AbortError") {
            return {
            status: "erro",
            docs: [],
            mensagem: "Processo cancelado pelo usuário.",
            };
        }

        const backendMsg =
            err?.response?.data?.message ||
            err?.response?.data ||
            err?.message ||
            String(err);

        return {
            status: "erro",
            docs: [],
            mensagem: `Erro ao baixar ATO por CNPJ: ${backendMsg}`,
        };
        } finally {
        running.delete(event.sender.id);
        }
    });
}

module.exports = { registerBaixarAtoCnpj };
