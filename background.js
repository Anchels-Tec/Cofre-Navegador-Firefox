'use strict';
// ══════════════════════════════════════════════════════════════════
//  background.js — o cofre. Trava = redireciona TODAS as abas pra
//  lock.html (guardando as URLs) e barra qualquer navegação nova até
//  a senha certa. Destrava = restaura as abas guardadas.
// ══════════════════════════════════════════════════════════════════

const LOCK_URL = browser.runtime.getURL('lock.html');
const ehLock = url => typeof url === 'string' && url.startsWith(LOCK_URL);

// ── TRAVAR ─────────────────────────────────────────────────────────
async function travarAgora() {
  if (!(await temSenha())) return { ok: false, error: 'sem senha configurada' };  // nunca trancar sem senha (senão prende o usuário)
  const jaTravado = await estaTravado();
  await definirTravado(true);
  atualizarBadge(true);

  const abas = await browser.tabs.query({});

  // Só salva as URLs na PRIMEIRA travada. Se já estava travado (ex: ociosidade
  // travando de novo), as abas já são lock.html — salvar aqui apagaria a lista
  // e as abas (fixadas inclusive) não voltariam no desbloqueio.
  if (!jaTravado) {
    const guardadas = {};
    for (const t of abas) {
      if (t.url && !ehLock(t.url)) guardadas[t.id] = { url: t.url, pinned: !!t.pinned };
    }
    await browser.storage.session.set({ abasGuardadas: guardadas });
  }

  for (const t of abas) {
    if (!ehLock(t.url || '')) {
      try { await browser.tabs.update(t.id, { url: LOCK_URL }); } catch (_) {}
    }
  }
  return { ok: true };
}

// ── DESTRAVAR (verifica a senha) ───────────────────────────────────
async function destravar(senha) {
  if (!(await verificarSenha(senha))) return { ok: false, error: 'Senha incorreta' };
  await definirTravado(false);
  atualizarBadge(false);

  const { abasGuardadas } = await browser.storage.session.get('abasGuardadas');
  if (abasGuardadas) {
    for (const [id, info] of Object.entries(abasGuardadas)) {
      // compat: versões antigas salvavam só a string da url
      const url = typeof info === 'string' ? info : info.url;
      const pinned = typeof info === 'object' ? info.pinned : undefined;
      const patch = { url };
      if (pinned != null) patch.pinned = pinned;   // devolve o estado "fixada"
      try { await browser.tabs.update(Number(id), patch); } catch (_) {}
    }
  }
  await browser.storage.session.remove('abasGuardadas');
  return { ok: true };
}

// Guarda a URL real de uma aba (pra restaurar no desbloqueio). Mantém o 1º
// endereço real visto e não sobrescreve — cobre abas fixadas que o Firefox
// restaura com atraso no boot (elas navegam pra URL real e a gente captura).
let _guardaChain = Promise.resolve();          // serializa as gravações (evita corrida no boot)
function guardarAba(tabId, url) {
  _guardaChain = _guardaChain.then(() => _guardarAbaImpl(tabId, url)).catch(() => {});
  return _guardaChain;
}
async function _guardarAbaImpl(tabId, url) {
  if (!url || ehLock(url) || url === 'about:blank' || url === 'about:newtab') return;
  const { abasGuardadas } = await browser.storage.session.get('abasGuardadas');
  const g = abasGuardadas || {};
  if (g[tabId]) return;                       // já tem a URL real dessa aba
  let pinned = false;
  try { const t = await browser.tabs.get(tabId); pinned = !!t.pinned; } catch (_) {}
  g[tabId] = { url, pinned };
  await browser.storage.session.set({ abasGuardadas: g });
}

// ── enforcement: enquanto travado, tudo que não for a tela de senha
//    volta pra tela de senha (cobre até about:addons/about:config) ──
async function forcar(tabId, url) {
  if (!(await estaTravado())) return;
  if (ehLock(url)) return;
  await guardarAba(tabId, url);               // captura a URL real ANTES de mandar pro lock
  try { await browser.tabs.update(tabId, { url: LOCK_URL }); } catch (_) {}
}

browser.webNavigation.onBeforeNavigate.addListener(d => { if (d.frameId === 0) forcar(d.tabId, d.url); });
browser.webNavigation.onCommitted.addListener(d => { if (d.frameId === 0) forcar(d.tabId, d.url); });
browser.tabs.onCreated.addListener(async tab => {
  if (await estaTravado()) {
    await guardarAba(tab.id, tab.url);
    try { await browser.tabs.update(tab.id, { url: LOCK_URL }); } catch (_) {}
  }
});
browser.tabs.onUpdated.addListener((tabId, info) => { if (info.url) forcar(tabId, info.url); });

// ── mensagens das páginas (lock / popup / options) ─────────────────
browser.runtime.onMessage.addListener((msg) => {
  switch (msg && msg.type) {
    case 'destravar':   return destravar(msg.senha);
    case 'travarAgora': return travarAgora();
    case 'estaTravado': return estaTravado();
    case 'temSenha':    return temSenha();
    case 'pegarConfig': return pegarConfig();
    case 'setConfig':   return salvarConfig(msg.patch).then(c => { aplicarIdle(); return c; });
    case 'definirSenha':
      return (async () => {
        const auth = await pegarAuth();
        if (auth) {  // trocar senha exige a atual
          if (!(await verificarSenha(msg.atual || ''))) return { ok: false, error: 'Senha atual incorreta' };
        }
        if (!msg.nova || msg.nova.length < 4) return { ok: false, error: 'A senha precisa de pelo menos 4 caracteres' };
        await definirSenhaMestra(msg.nova);
        return { ok: true };
      })();
    default: return false;
  }
});

// ── ociosidade ─────────────────────────────────────────────────────
async function aplicarIdle() {
  const c = await pegarConfig();
  if (c.idleMinutes > 0) browser.idle.setDetectionInterval(Math.max(15, c.idleMinutes * 60));
}
browser.idle.onStateChanged.addListener(async (estado) => {
  const c = await pegarConfig();
  if (c.idleMinutes > 0 && (estado === 'idle' || estado === 'locked')) travarAgora();
});

// ── ciclo de vida ──────────────────────────────────────────────────
browser.runtime.onStartup.addListener(async () => {
  const c = await pegarConfig();
  if (c.lockOnStartup !== false) travarAgora();
  aplicarIdle();
});
browser.runtime.onInstalled.addListener(async (details) => {
  aplicarIdle();
  // 1ª instalação sem senha → abre a tela de criar senha (aba dedicada, confiável)
  if (details.reason === 'install' && !(await temSenha())) {
    try { await browser.tabs.create({ url: browser.runtime.getURL('options.html') }); }
    catch (_) { try { await browser.runtime.openOptionsPage(); } catch (__) {} }
  }
});

function atualizarBadge(travado) {
  try {
    browser.action.setBadgeText({ text: travado ? '🔒' : '' });
    browser.action.setBadgeBackgroundColor({ color: '#b91c1c' });
    browser.action.setTitle({ title: travado ? 'Cofre — TRAVADO' : 'Cofre do Navegador' });
  } catch (_) {}
}

aplicarIdle();
