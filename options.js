'use strict';
const $ = id => document.getElementById(id);

function send(msg, ms = 3000) {
  return Promise.race([
    browser.runtime.sendMessage(msg),
    new Promise((_, rej) => setTimeout(() => rej(new Error('sem resposta do background')), ms)),
  ]);
}

function flash(el, txt, erro) {
  const e = $(el);
  e.textContent = txt;
  e.className = erro ? 'err' : 'ok';
  setTimeout(() => { e.textContent = ''; }, 5000);
}

async function init() {
  try {
    const tem = await send({ type: 'temSenha' });
    $('campo-atual').hidden = !tem;
    $('bemvindo').hidden = tem;                              // banner de boas-vindas só no 1º uso
    $('tit-senha').textContent = tem ? 'Trocar senha-mestra' : 'Definir senha-mestra (1ª vez)';
    if (!tem) $('nova').focus();                             // já foca no campo pra criar a senha

    const c = await send({ type: 'pegarConfig' });
    $('lockStartup').checked = c.lockOnStartup !== false;
    $('idle').value = c.idleMinutes;
  } catch (e) {
    flash('msg-senha', 'Falha ao falar com a extensão: ' + e.message, true);
  }
}

$('btn-senha').addEventListener('click', async () => {
  const atual = $('atual').value, nova = $('nova').value, nova2 = $('nova2').value;
  if (nova.length < 4) return flash('msg-senha', 'A senha precisa de pelo menos 4 caracteres.', true);
  if (nova !== nova2) return flash('msg-senha', 'As senhas não conferem.', true);
  try {
    const r = await send({ type: 'definirSenha', atual, nova });
    if (r && r.ok) { flash('msg-senha', '✓ Senha salva.'); $('atual').value = $('nova').value = $('nova2').value = ''; init(); }
    else flash('msg-senha', (r && r.error) || 'Erro ao salvar.', true);
  } catch (e) { flash('msg-senha', 'Erro: ' + e.message, true); }
});

$('btn-cfg').addEventListener('click', async () => {
  const patch = {
    lockOnStartup: $('lockStartup').checked,
    idleMinutes: Math.max(0, Math.min(120, parseInt($('idle').value, 10) || 0)),
  };
  try { await send({ type: 'setConfig', patch }); flash('msg-cfg', '✓ Comportamento salvo.'); }
  catch (e) { flash('msg-cfg', 'Erro: ' + e.message, true); }
});

$('btn-lock').addEventListener('click', async () => {
  try {
    const tem = await send({ type: 'temSenha' });
    if (!tem) return flash('msg-cfg', 'Defina a senha primeiro.', true);
    await send({ type: 'travarAgora' });
  } catch (e) { flash('msg-cfg', 'Erro: ' + e.message, true); }
});

init();
