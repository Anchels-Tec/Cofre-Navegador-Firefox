'use strict';
// Tela de bloqueio: se já tem senha → pede senha; se não tem → cria a 1ª.
// Blindado: renderiza algo imediatamente e NUNCA fica em branco (mostra erro na tela).

const $ = id => document.getElementById(id);

// sendMessage com timeout — se o background não responder, não trava a tela
function send(msg, ms = 3000) {
  return Promise.race([
    browser.runtime.sendMessage(msg),
    new Promise((_, rej) => setTimeout(() => rej(new Error('sem resposta do background')), ms)),
  ]);
}

function erro(el, cardShake) {
  return (txt) => {
    $(el).textContent = txt || '';
    if (txt && cardShake) {
      const c = $('card');
      c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake');
    }
  };
}
const errUnlock = erro('err', true);
const errSetup = erro('err2', false);

async function init() {
  // 1) mostra a tela de desbloquear JÁ (evita tela branca se a mensagem falhar)
  $('modo-unlock').hidden = false;
  $('pw').focus();
  // 2) descobre se ainda não tem senha → troca pro modo "criar senha"
  try {
    const tem = await send({ type: 'temSenha' });
    if (!tem) {
      $('modo-unlock').hidden = true;
      $('modo-setup').hidden = false;
      $('np').focus();
    }
  } catch (e) {
    // background não respondeu: mantém o modo desbloquear e avisa
    errUnlock('Falha ao falar com a extensão: ' + e.message);
  }
}

async function tentarDestravar() {
  const senha = $('pw').value;
  if (!senha) return;
  $('btn-unlock').disabled = true;
  errUnlock('');
  try {
    const r = await send({ type: 'destravar', senha });
    if (r && r.ok) { $('pw').value = ''; }          // o background restaura as abas
    else { errUnlock((r && r.error) || 'Senha incorreta'); $('pw').value = ''; $('pw').focus(); }
  } catch (e) {
    errUnlock('Erro: ' + e.message);
  } finally {
    $('btn-unlock').disabled = false;
  }
}

async function criarSenha() {
  const a = $('np').value, b = $('np2').value;
  errSetup('');
  if (a.length < 4) return errSetup('A senha precisa de pelo menos 4 caracteres.');
  if (a !== b) return errSetup('As senhas não conferem.');
  $('btn-setup').disabled = true;
  try {
    const r = await send({ type: 'definirSenha', nova: a });
    if (r && r.ok) { await send({ type: 'travarAgora' }).catch(() => {}); location.reload(); }
    else { $('btn-setup').disabled = false; errSetup((r && r.error) || 'Não foi possível salvar.'); }
  } catch (e) {
    $('btn-setup').disabled = false;
    errSetup('Erro: ' + e.message);
  }
}

// listeners (fora do init pra sempre ligarem, mesmo se o init falhar)
$('btn-unlock').addEventListener('click', tentarDestravar);
$('pw').addEventListener('keydown', e => { if (e.key === 'Enter') tentarDestravar(); });
$('btn-setup').addEventListener('click', criarSenha);
$('np2').addEventListener('keydown', e => { if (e.key === 'Enter') criarSenha(); });

init();
