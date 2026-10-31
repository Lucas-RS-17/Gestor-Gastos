# Gestor de Gastos (PWA)

Controle mensal de faturamento e gastos (fixos e variáveis), com vencimentos,
"marcar como pago" e alerta de atraso. Funciona offline e pode ser instalado
no Android como um app.

## Estrutura

```
gestor-gastos/
├── index.html             # o app inteiro (HTML + CSS + JS, sem dependências)
├── manifest.webmanifest   # nome, cores, ícones e atalhos do app instalado
├── sw.js                  # service worker: cache offline e atualizações
└── icons/                 # ícones (normais e "maskable" para Android)
```

## Por que precisa de hospedagem

O Android só instala um PWA se ele for aberto por **HTTPS**. Abrindo o
`index.html` direto do arquivo, o app funciona, mas não vira app instalável.
Servir pela rede local (`http://192.168.x.x`) também não serve, porque não é HTTPS.

## Publicar no GitHub Pages (gratuito)

1. Crie uma conta em <https://github.com> (se ainda não tiver).
2. Clique em **New repository** → nome, por exemplo, `gestor-gastos` → **Public** → **Create repository**.
3. Na página do repositório: **Add file → Upload files** → arraste **o conteúdo**
   da pasta (`index.html`, `manifest.webmanifest`, `sw.js` e a pasta `icons`) → **Commit changes**.
   > Os arquivos devem ficar na raiz do repositório, não dentro de uma subpasta.
4. Vá em **Settings → Pages** → em *Branch*, escolha `main` e `/ (root)` → **Save**.
5. Aguarde 1–2 minutos. O endereço será algo como
   `https://SEU-USUARIO.github.io/gestor-gastos/`.

Pela linha de comando (com git instalado):

```bash
cd gestor-gastos
git init && git add . && git commit -m "Gestor de Gastos PWA"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/gestor-gastos.git
git push -u origin main
# depois ative em Settings → Pages (branch main, pasta root)
```

> **Privacidade:** o repositório público expõe apenas o **código**. Seus valores
> ficam salvos só no seu celular (localStorage) e nunca são enviados ao GitHub.

Alternativas equivalentes: Netlify Drop (<https://app.netlify.com/drop>, arraste a
pasta) ou Cloudflare Pages.

## Instalar no Android

1. No celular, abra o endereço no **Chrome**.
2. Toque em **⋮ → Instalar app** (ou **Adicionar à tela inicial**).
   Também dá para usar o menu **⋮** do próprio app → **Instalar app no celular**.
3. O ícone "Gastos" aparece na tela inicial e abre em tela cheia, sem barra do navegador.
4. Pressionando e segurando o ícone, aparecem os atalhos **Novo gasto** e **Novo faturamento**.

Depois de aberto uma vez, o app funciona **sem internet**.

## Seus dados

- Ficam no armazenamento do app **no aparelho**. Celular e computador **não se sincronizam**.
- Para levar dados de um aparelho a outro: menu **⋮ → Exportar backup** em um,
  **⋮ → Importar backup** no outro.
- **Desinstalar o app ou limpar os dados do site no Chrome apaga tudo.** Exporte backups com frequência.

## Publicar uma nova versão

1. Altere os arquivos.
2. Em `sw.js`, mude `const VERSION = "v1.0.0";` para uma nova versão (ex.: `"v1.0.1"`).
3. Envie para o GitHub.
4. Ao abrir o app, aparece a barra **"Nova versão disponível → Atualizar"**.

Se esquecer de mudar a versão, o `index.html` ainda é atualizado na próxima
abertura com internet, mas os demais arquivos (ícones, manifesto) podem continuar em cache.

## Testar localmente no computador

```bash
cd gestor-gastos
python3 -m http.server 8080
# abra http://localhost:8080  (localhost é tratado como seguro, então o PWA funciona)
```
