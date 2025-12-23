// main/modelo7.js
const { ipcMain } = require("electron");
const { spawn } = require("child_process");
const fs = require("fs");

const MODELO7_PATH = String.raw`G:\Público\APP Viso Modelo 7\VisoModelo7.exe`;

function registerModelo7Ipc() {
  ipcMain.handle("modelo7:run", async (_event, args = []) => {
    if (!fs.existsSync(MODELO7_PATH)) {
      return {
        ok: false,
        code: null,
        out: "",
        err: `Executável não encontrado em: ${MODELO7_PATH}`,
      };
    }

    return await new Promise((resolve) => {
      const child = spawn(MODELO7_PATH, args, {
        windowsHide: true,
        cwd: undefined, // se precisar, posso ajustar pro diretório do exe
        env: process.env,
      });

      let out = "";
      let err = "";

      child.stdout.on("data", (d) => (out += d.toString()));
      child.stderr.on("data", (d) => (err += d.toString()));

      child.on("error", (e) => {
        resolve({ ok: false, code: null, out, err: err + "\n" + e.message });
      });

      child.on("close", (code) => {
        resolve({ ok: code === 0, code, out, err });
      });
    });
  });
}

module.exports = { registerModelo7Ipc };
