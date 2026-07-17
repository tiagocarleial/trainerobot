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

- Link de referral: procure por `ROBOT1` no `index.html` (aparece 4 vezes)
- Valores de comissão: constantes `L1` e `L2` no `<script>` no fim do arquivo
- Lista de tarefas: array `TASKS` no `<script>`
