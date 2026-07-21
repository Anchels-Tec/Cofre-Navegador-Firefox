'use strict';
// ══════════════════════════════════════════════════════════════════
//  common.js — helpers compartilhados (cripto da senha + storage).
//  Carregado no background E referenciado pelas páginas via import? Não:
//  no background entra pelo array de scripts; nas páginas cada uma tem o
//  seu <script src="common.js"> antes do script da página.
// ══════════════════════════════════════════════════════════════════

const CFG_PADRAO = {
  idleMinutes: 5,        // travar após X min ocioso (0 = desliga)
  lockOnStartup: true,   // travar ao abrir o Firefox
};

// ── util hex ───────────────────────────────────────────────────────
function bufToHex(buf) {
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
function hexToBuf(hex) {
  const a = new Uint8Array(hex.length / 2);
  for (let i = 0; i < a.length; i++) a[i] = parseInt(hex.substr(i * 2, 2), 16);
  return a;
}
// comparação em tempo ~constante (evita timing attack bobo)
function hexIgual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// ── senha-mestra (PBKDF2-SHA256, nunca guarda texto puro) ──────────
async function derivarHash(senha, saltBytes, iteracoes) {
  const enc = new TextEncoder();
  const km = await crypto.subtle.importKey('raw', enc.encode(senha), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBytes, iterations: iteracoes, hash: 'SHA-256' }, km, 256);
  return bufToHex(bits);
}
async function definirSenhaMestra(senha) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iteracoes = 210000;
  const hash = await derivarHash(senha, salt, iteracoes);
  await browser.storage.local.set({ auth: { salt: bufToHex(salt), iteracoes, hash, em: Date.now() } });
}
async function pegarAuth() {
  const { auth } = await browser.storage.local.get('auth');
  return auth || null;
}
async function temSenha() {
  return !!(await pegarAuth());
}
async function verificarSenha(senha) {
  const auth = await pegarAuth();
  if (!auth) return false;
  const hash = await derivarHash(senha, hexToBuf(auth.salt), auth.iteracoes);
  return hexIgual(hash, auth.hash);
}

// ── configurações ─────────────────────────────────────────────────
async function pegarConfig() {
  const { config } = await browser.storage.local.get('config');
  return Object.assign({}, CFG_PADRAO, config || {});
}
async function salvarConfig(patch) {
  const c = await pegarConfig();
  const novo = Object.assign(c, patch || {});
  await browser.storage.local.set({ config: novo });
  return novo;
}

// ── estado travado (storage.session → limpa ao fechar o navegador,
//    então na próxima abertura começa "não travado" e o onStartup trava)
async function estaTravado() {
  const { travado } = await browser.storage.session.get('travado');
  return !!travado;
}
async function definirTravado(v) {
  await browser.storage.session.set({ travado: !!v });
}
