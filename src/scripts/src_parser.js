// src/scripts/src_parser.js
function initParser() {
  const btn = document.getElementById('btn-test');
  const out = document.getElementById('out');
  if (!btn || !out) return;
  btn.addEventListener('click', () => {
    out.textContent = 'Troca de view funcionando!';
  });
}
window.initParser = initParser;
