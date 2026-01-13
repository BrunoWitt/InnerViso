// src/main/ipc-baixar-ato-cnpj.js
const { ipcMain } = require("electron");
const axios = require("axios");

function registerBaixarAtoCnpj() {
    const running = new Map();

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

        // ✅ AJUSTE A URL CONFORME SEU SWAGGER
        // Pelo print que você mandou, existe:
        //   GET /ato/collect/Documents/due_cnpj  (header: cnpj)
        // Se o ATO “por CNPJ” for outro path, troca aqui.
        const url = "http://10.0.0.230:2026/ato/collect/Documents/due_cnpj";

        const headers = {
            cnpj: cleanCnpjs.join(","),
        };

        const resp = await axios.get(url, {
            timeout: 0,
            signal: controller.signal,
            headers,
        });

        // Normaliza retorno (pode vir objeto ou [obj, 200])
        const rawData = resp?.data;
        let data = rawData ?? {};
        let httpStatus = resp?.status;

        if (Array.isArray(rawData)) {
            data = rawData[0] ?? {};
            if (typeof rawData[1] === "number") httpStatus = rawData[1];
        }

        // Extrai lista de “docs” (bem tolerante)
        let docs = [];

        // caso venha { responses: [...] }
        let responses = data?.responses;

        if (typeof responses === "string") {
            try {
            responses = JSON.parse(responses);
            } catch {
            // deixa como string e tenta regex depois
            }
        }

        if (Array.isArray(responses)) {
            docs = responses
            .map((r) => r?.response ?? r?.file ?? r?.path ?? r?.name ?? r)
            .map((v) => (v === null || v === undefined ? "" : String(v).trim()))
            .filter((v) => v.length > 0);
        }

        // caso venha algo como { documents: [...] } / { docs: [...] } / { files: [...] }
        if (!docs.length) {
            const candidates =
            data?.documents || data?.docs || data?.files || data?.atos || data?.result;

            if (Array.isArray(candidates)) {
            docs = candidates
                .map((v) => (v === null || v === undefined ? "" : String(v).trim()))
                .filter((v) => v.length > 0);
            }
        }

        // caso venha "string"
        if (!docs.length && typeof data === "string") {
            // tenta quebrar por linhas/virgula
            docs = String(data)
            .split(/\r?\n|,|;/g)
            .map((s) => s.trim())
            .filter(Boolean);
        }

        // fallback: se responses era string com paths, tenta extrair tokens "parecidos"
        if (!docs.length && typeof responses === "string") {
            const matches = responses.match(/[A-Za-z0-9._-]+\.(pdf|zip|xml)\b/gi);
            docs = Array.from(new Set(matches || []));
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
