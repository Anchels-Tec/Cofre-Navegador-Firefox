# 🔐 Cofre do Navegador (Firefox MV3)

Trava o Firefox com uma **senha-mestra**. Ao abrir o navegador e depois de ficar ocioso,
**todas as abas** são cobertas por uma tela de senha e nada funciona até digitar a senha certa.

## Como funciona
- Quando trava: o background guarda a URL de cada aba e redireciona **todas** para `lock.html`.
- Enquanto travado: qualquer navegação nova (inclusive `about:addons`, `about:config`, aba nova)
  é jogada de volta para a tela de senha.
- Ao acertar a senha: as abas voltam para as URLs originais.
- Senha guardada como **PBKDF2-SHA256 + salt** (210k iterações). Nunca em texto puro.
- Estado "travado" fica em `storage.session` → limpa ao fechar o Firefox, então na próxima
  abertura o `onStartup` trava de novo.

## Arquivos
| Arquivo | Papel |
|---|---|
| `manifest.json` | MV3, permissões (`storage`, `tabs`, `idle`, `webNavigation`, `<all_urls>`) |
| `background.js` | O cofre: travar/destravar + enforcement de navegação |
| `common.js` | Cripto da senha + storage (compartilhado) |
| `lock.html/js` | Tela de senha (destravar + criar 1ª senha) |
| `options.html/js` | Definir/trocar senha, travar no boot, ociosidade |
| `popup.html/js` | Botão "Travar agora" + status |
| `policies.example.json` | Enforcement de verdade (impede desligar a extensão) |

## Testar rápido (temporário)
1. Firefox → `about:debugging#/runtime/this-firefox`
2. **Carregar extensão temporária…** → escolha o `manifest.json` desta pasta.
3. Abre as Configurações sozinho → **defina a senha-mestra**.
4. Clique no ícone da extensão → **🔒 Travar agora** (ou reinicie pra ver o boot travar).

> ⚠ Extensão temporária **some ao fechar o Firefox**. Pra uso real, veja abaixo.

## Deixar permanente
O Firefox normal só instala extensão **assinada pela Mozilla**. Opções:
- **Assinar no AMO** (addons.mozilla.org) como *unlisted* → gera um `.xpi` assinado que instala
  em qualquer Firefox. É o caminho recomendado.
- **Firefox ESR ou Developer Edition** com `xpinstall.signatures.required = false` no `about:config`
  → instala `.xpi` não assinado direto.

Empacotar o `.xpi`: **use o `empacotar.ps1`** desta pasta (clique direito → Executar com
PowerShell, ou `powershell -ExecutionPolicy Bypass -File empacotar.ps1`). Ele gera o
`..\cofre-navegador.xpi` com as entradas em **barra normal** (`/`) e o `manifest.json` na raiz.

> ⚠ NÃO use `Compress-Archive` do PowerShell: ele grava os caminhos com barra invertida (`\`)
> e o Firefox rejeita o `.xpi` como inválido. Por isso existe o `empacotar.ps1`.

## 🔒 Enforcement DE VERDADE (recomendado)
Uma extensão sozinha é **impeditivo**, não segurança absoluta: dá pra desligar pelo
`about:addons` ou pelo Modo de Segurança. Pra fechar isso, use **políticas empresariais**
do Firefox (não precisa de servidor):

1. Edite `policies.example.json`:
   - Ajuste `install_url` pro caminho do seu `.xpi` assinado.
   - `force_installed` = usuário **não consegue remover/desligar** a extensão.
   - `BlockAboutAddons` / `DisableSafeMode` = fecham as saídas de escape.
2. Renomeie para `policies.json` e coloque em:
   - **Windows:** `C:\Program Files\Mozilla Firefox\distribution\policies.json`
   - (crie a pasta `distribution` se não existir)
3. Reinicie o Firefox. Pronto — com `force_installed` o Firefox **some com o botão
   Remover/Desativar em todo lugar** (ícone, painel de extensões, sidebar, about:addons).

### ⚠ Remoção pelo menu nativo (botão direito no ícone → "Remover extensão")
Isso é UI nativa do Firefox — **nenhuma extensão consegue bloquear a própria remoção por
código** (é proteção do navegador). O redirecionamento do about:addons só cobre a página.
A ÚNICA forma de impedir o "Remover" do menu/sidebar é a política `force_installed` acima.

### Pra a política aceitar a extensão (escolha 1):
- **Caminho A — Firefox ESR (mais simples, sem conta):** instale o **Firefox ESR**, coloque
  `xpinstall.signatures.required = false` no `about:config` (ou via autoconfig `.cfg` pra já
  vir travado). Aí o `install_url` do `force_installed` pode ser o `.xpi` **não assinado**
  por `file:///`.
- **Caminho B — Firefox normal:** o Firefox release exige extensão **assinada**. Envie o `.xpi`
  pro AMO como *unlisted* (self-distribution, grátis) → baixa o `.xpi` assinado → aponta o
  `install_url` pra ele. Dá pra automatizar com `web-ext sign` (precisa da API key do AMO).

## Limitações honestas
- Sem as políticas, um usuário avançado burla: **Remover extensão** pelo menu do ícone,
  Modo de Segurança, ou outro perfil. Só a política fecha isso.
- Não protege contra quem tem acesso de administrador ao Windows (aí é conta de usuário do SO).
- Se **esquecer a senha**: remova/reinstale a extensão (limpa o storage) — por isso, sem as
  políticas, "esqueci a senha" também é uma porta de saída. Guarde a senha.
