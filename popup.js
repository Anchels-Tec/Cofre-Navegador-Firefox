'use strict';
const $ = id => document.getElementById(id);

function send(msg, ms = 3000) {
  return Promise.race([
    browser.runtime.sendMessage(msg),
    new Promise((_, rej) => setTimeout(() => rej(new Error('sem resposta do background')), ms)),
  ]);
}

async function atualizar() {
  try {
    const tem = await send({ type: 'temSenha' });
    const travado = await send({ type: 'estaTravado' });
    const st = $('status');
    if (!tem) {
      st.textContent = 'sem senha';
      st.className = 'badge on';
      $('aviso').textContent = 'Defina a senha-mestra em ⚙️ Configurações antes de usar.';
      $('btn-lock').disabled = true;
    } else {
      st.textContent = travado ? 'TRAVADO' : 'aberto';
      st.className = 'badge ' + (travado ? 'on' : 'off');
      $('aviso').textContent = '';
      $('btn-lock').disabled = false;
    }
  } catch (e) {
    $('status').textContent = 'erro';
    $('status').className = 'badge on';
    $('aviso').textContent = 'Falha ao falar com a extensão: ' + e.message;
  }
}

$('btn-lock').addEventListener('click', async () => {
  try { await send({ type: 'travarAgora' }); } catch (_) {}
  window.close();
});
$('btn-opts').addEventListener('click', () => { browser.runtime.openOptionsPage(); window.close(); });

atualizar();
