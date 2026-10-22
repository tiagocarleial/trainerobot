# TraineRobot

## Controle privado de pagamentos

O painel fica em `/controle-pagamentos`. Ele não aparece na navegação nem no sitemap. O acesso depende de senha; esconder o endereço sozinho não protege os dados. Cada usuário recebe um link privado `/pagamento?client=...` para consulta sem cadastro. Ao criar outra transação, selecione o usuário existente: o mesmo link mostrará todo o histórico dele. Quem tiver esse link poderá ver os valores, status, hash e comprovantes das transações daquele usuário. A chave PIX e as notas internas ficam apenas no painel.

A página `/transacoes` reúne todas as operações sem exigir senha. Ela não aparece na navegação nem no sitemap. Exibe o nome ou identificação do usuário, @ do Telegram quando informado, valores, cotação, status e hash público da Base. Chaves PIX e imagens dos comprovantes continuam fora da visão geral.

Antes de usar em produção:

1. Crie um projeto Supabase e execute `supabase/payments.sql` no SQL Editor. Ele cria a tabela com RLS e um bucket **privado** para comprovantes.
2. Configure no projeto Vercel as variáveis de ambiente `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `ADMIN_PASSWORD` e `ADMIN_SESSION_SECRET`. Use uma senha forte e uma chave aleatória longa para a sessão. A secret key e a senha nunca devem ir para arquivos públicos ou para o navegador. A antiga variável `SUPABASE_SERVICE_ROLE_KEY` ainda é aceita pelo código como alternativa.
3. Faça um novo deploy. Acesse `/controle-pagamentos`, entre com a senha, crie uma transação e copie o link individual para o usuário.

O painel registra manualmente a cotação BRL por USDC na data/hora indicada e calcula `USDC × cotação × 0,80`, arredondado para centavos. Imagens JPG, PNG e WebP de até 2 MB podem ser anexadas a cada transação.

O painel também mostra a comissão bruta de cada operação: `USDC × cotação registrada − PIX registrado`, arredondando o valor convertido para centavos. O resumo separa as comissões de PIX enviados das comissões previstas para depósitos recebidos com PIX pendente. Ajustes manuais do PIX entram na conta; depósitos provisórios sem cotação ficam fora dos totais. Custos de rede e conversão não são descontados.
Os valores em reais aparecem junto do equivalente estimado em dólares, calculado pela cotação de cada transação antes da soma dos totais.

### Detecção automática de USDC na Base

A carteira de recebimento está fixada em `0x8f362ECd2DF3FBa1F3Ffd74CE73F4325965767cB`. O sistema aceita apenas USDC **nativo** na Base, contrato `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`. ETH e USDbC não são registrados. Antes de ativar:

1. Execute novamente `supabase/payments.sql` no SQL Editor do projeto. Ele acrescenta a carteira de origem ao cadastro e cria a tabela de depósitos e as funções de associação.
2. Crie um app **Base Mainnet** na Alchemy e configure `BASE_RPC_URL` no Vercel com a URL HTTPS RPC dele. Crie um webhook **Address Activity** para a Base Mainnet, monitorando a carteira acima, com destino `https://trainerobot.vercel.app/api/base-webhook`.
3. No Vercel, configure `ALCHEMY_WEBHOOK_SIGNING_KEY` com a signing key desse webhook. Guarde essa chave só nas variáveis de ambiente. Faça um novo deploy para aplicar as variáveis.

O webhook valida a assinatura da Alchemy, consulta o recibo diretamente na Base, verifica o contrato, destino e valor bruto em 6 casas, e registra uma vez cada evento `Transfer`. Se houver **uma única** transação aguardando com mesmo valor, mesma carteira de origem e mesma carteira de destino, ela muda automaticamente para **USDC recebido**. Caso contrário, o sistema cria uma transação **provisória** com valor em USDC, carteira de origem, hash e horário de recebimento. Essa transação fica só no painel até o administrador identificá-la, escolher um usuário existente ou informar um novo nome, registrar cotação e data, e confirmar o PIX previsto. Pode ajustar manualmente o valor do PIX; o ajuste fica sinalizado no histórico. O mínimo por depósito para enviar PIX é **5 USDC**. Abaixo disso, o painel e as observações internas mostram que o mínimo não foi atingido, e o sistema impede marcar o PIX como enviado. O PIX continua sendo enviado e marcado manualmente pelo administrador; não existe integração bancária.

O registro ocorre após o recibo confirmar inclusão em bloco. Antes de enviar PIX, confira o depósito no explorador e respeite seu critério de confirmações. Webhooks podem falhar ou ser perdidos após as tentativas de entrega; confira periodicamente a carteira e a lista de depósitos. Depósitos anteriores à criação do webhook não são importados automaticamente.

No painel, o botão **Excluir** remove uma transação após confirmação e tenta apagar também os comprovantes anexados. Ela desaparece da visão geral e do histórico do usuário.

Para visualizar localmente sem Supabase, crie `.env.local` com `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET` e `PAYMENTS_DEMO_MODE=1`, depois execute `npm run dev`. O modo de demonstração guarda os registros em `.dev-payments.json`, arquivo ignorado pelo Git. Ele só é ativado fora do ambiente de produção.

Landing page em português sobre o app Hub (gravação de tarefas domésticas para treinar robôs de IA), com lista de 84 tarefas traduzidas, programa de indicações e simulador de ganhos.

O conteúdo público é estático. O controle de pagamentos usa funções Vercel e Supabase.

## Deploy no Vercel

Opção 1 — CLI:

```sh
npm i -g vercel
vercel --prod
```

Opção 2 — GitHub:

1. Suba este repositório para o GitHub
2. Em vercel.com → Add New Project → importe o repositório
3. Framework: **Other** → Deploy

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
