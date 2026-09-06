# TraineRobot

Landing page em português sobre o app Hub (gravação de tarefas domésticas para treinar robôs de IA), com lista de 84 tarefas traduzidas, programa de indicações e simulador de ganhos.

Site estático — um único `index.html`, sem build.

## Deploy no Vercel

Opção 1 — CLI:

```sh
npm i -g vercel
vercel --prod
```

Opção 2 — GitHub:

1. Suba este repositório para o GitHub
2. Em vercel.com → Add New Project → importe o repositório
3. Framework: **Other** (site estático, sem build) → Deploy

## Editar

- Link de referral: procure por `RG4WW24V` nos `index.html` (pt/en/es + guias)
- Valores de comissão: constantes `L1` e `L2` no `<script>` no fim do arquivo
- Lista de tarefas: as 84 tarefas ficam **direto no HTML** (`<div class="task" data-cat data-s>`),
  dentro de `#task-list`. Isso é proposital: crawlers que não executam JS (Bingbot) precisam
  ler as tarefas no HTML cru. O JavaScript apenas mostra/esconde os elementos existentes —
  não gere a lista por JS de novo.
  - `data-cat`: `kitchen` | `laundry` | `tidy` | `misc`
  - `data-s`: `"nome em inglês nome em português"` em minúsculas, usado pela busca

## SEO / Analytics

Instalado no `index.html`:

- GA4 `G-WC63WTTXZD` e Google Ads `AW-945891303` na mesma tag gtag
- Conversão do Ads (`AW-945891303/CCu5COi-1NIcEOfPhMMD`) dispara no clique de qualquer
  link `ai.hub.xyz` — não existe página de obrigado, a saída para o Hub é a conversão
- JSON-LD: WebSite, Organization, HowTo, FAQPage
- `og-image.png` (1200×630), `favicon.ico`, `favicon.svg`, `apple-touch-icon.png`
  são gerados; para alterar, edite a imagem e mantenha os mesmos nomes

### Pendências manuais

1. **Bing Webmaster Tools** — https://www.bing.com/webmasters
   Token já está na meta `msvalidate.01` do `index.html`. Depois do deploy, clicar
   em **Verify** no painel e submeter `sitemap.xml` em Sitemaps.

2. **IndexNow** — a chave já está no repositório:
   `96c6c73c74a72cef0d2c29bb080c887f.txt`. Depois de cada deploy que mudar conteúdo:

   ```sh
   curl "https://api.indexnow.org/indexnow?url=https://trainerobot.vercel.app/&key=96c6c73c74a72cef0d2c29bb080c887f"
   ```

3. **Domínio próprio** — `.vercel.app` não acumula autoridade de marca. Ao trocar,
   atualizar: `canonical`, `og:url`, `og:image`, `twitter:image`, os `url`/`logo` do JSON-LD,
   `sitemap.xml`, `robots.txt` e a chave IndexNow.
