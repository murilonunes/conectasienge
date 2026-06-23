# Revisão das telas

Atualizado em: 2026-06-23

Este arquivo é o quadro de acompanhamento da revisão das telas do projeto. A ideia é revisar por etapas, corrigir uma frente por vez e manter este arquivo atualizado a cada ciclo.

## Critério de revisão

Cada tela deve ser conferida pelos mesmos pontos:

- Fonte dos dados: abertura da tela deve ler SQLite/local quando for tela de consulta.
- Consulta ao Sienge: deve ficar em Configurações, exceto operações explicitamente transacionais.
- Volume renderizado: listas grandes devem usar paginação e não enviar milhares de registros desnecessários ao navegador.
- Clareza comercial: texto da tela deve falar com usuário de negócio, não com detalhe técnico.
- Estado vazio/erro: deve explicar o que falta fazer sem parecer falha invisível.
- Integração: registros de lista devem indicar data de integração quando fizer sentido.
- Consistência visual: cards, filtros, rankings e listas devem seguir o padrão do projeto.

## Prioridade

- Alta: risco de dado errado, travamento, consulta indevida ao Sienge ou tela que não cumpre o fluxo local.
- Média: tela funciona, mas pode confundir, ficar pesada ou destoar do padrão.
- Baixa: melhoria de acabamento, texto ou organização.

## Revisão por menu

| Status | Prioridade | Rota | Evidência no código | O que precisa arrumar |
| --- | --- | --- | --- | --- |
| Pendente | Média | `/` | `app/page.tsx` | Revisar textos e atalhos da tela inicial para garantir que continua sem carga pesada e com links alinhados ao menu atual. |
| Pendente | Média | `/dashboard` | `app/dashboard/page.tsx`, `features/dashboard/data.ts` | Auditar card a card contra as consultas SQL resumidas. A tela está local e otimizada, mas é a mais sensível a inconsistência de fórmula. |
| Pendente | Média | `/financeiro` | `app/financeiro/page.tsx` | Revisar a central financeira: ainda exibe atalho para `Novo lançamento`, que é uma operação direta no Sienge e pode destoar do padrão atual de consulta local. |
| Pendente | Média | `/sales` | `app/sales/page.tsx`, `components/sales/sales-explorer.tsx` | A listagem usa paginação, mas todos os contratos do recorte são enviados para o cliente. Revisar volume em períodos longos e confirmar se filtros, permutas e totais continuam coerentes. |
| Pendente | Alta | `/compras` | `app/compras/page.tsx`, `components/purchases/purchases-portal.tsx` | A página corta a lista inicial em 500 registros antes de enviar para a aba Registros. Isso deixa a tela mais leve, mas a busca não alcança tudo que existe no SQLite. |
| Pendente | Média | `/estoque` | `app/estoque/page.tsx`, `components/inventory/inventory-explorer.tsx` | Conferir se valores zerados e propriedade própria/terceiro estão claros. A tela já usa lista local paginada. |
| Pendente | Alta | `/contratos` | `app/contratos/page.tsx`, `features/contracts/data.ts` | Validar atualização via Configurações e estado vazio. A abertura lê SQLite, mas precisa confirmar em uso real se o job grava contratos e se o card muda depois da carga. |
| Pendente | Alta | `/conciliacao` | `app/conciliacao/page.tsx`, `components/reconciliation/reconciliation-portal.tsx`, `app/api/sienge/reconciliation/route.ts` | A tela abre fazendo fetch interno para uma rota API, mesmo lendo local por padrão. Melhorar para renderizar a primeira leitura local no servidor e deixar progresso só para atualização/recarga quando necessário. |
| Pendente | Média | `/contas-pagar` | `app/contas-pagar/page.tsx`, `features/payables-schedule/data.ts` | Conferir se agenda, valores corrigidos, juros/multa e abuso usam a mesma base local e se a navegação para busca avançada está clara. |
| Pendente | Alta | `/contas-receber` | `app/contas-receber/page.tsx`, `components/tables/receivables-forecast-table.tsx` | A página corta a listagem inicial em 200 parcelas. Isso melhora o HTML, mas a busca/lista principal não cobre todos os registros salvos. |
| Pendente | Média | `/lancamentos/baixa` | `app/lancamentos/baixa/page.tsx`, `components/forms/advanced-payables-search.tsx`, `components/forms/installment-settlement.tsx` | Busca avançada e consulta de parcelas leem rotas locais, mas a atualização de dados Pix ainda faz PATCH no Sienge. Decidir se esta operação continua permitida ou se deve sair da tela. |
| Pendente | Média | `/lancamentos/baixa-receber` | `app/lancamentos/baixa-receber/page.tsx`, `components/forms/advanced-receivables-search.tsx`, `components/forms/receivable-settlement.tsx` | Revisar espelhamento visual com contas a pagar e remover qualquer texto que pareça prometer baixa efetiva quando a API pública não confirmou esse endpoint. |
| Pendente | Alta | `/lancamentos/novo` | `app/lancamentos/novo/page.tsx`, `components/forms/bill-entry-form.tsx`, `app/api/sienge/bills/route.ts` | Esta tela cria título direto no Sienge. Precisa decisão: manter como operação transacional explícita, mover para área separada ou remover do fluxo atual. |
| Pendente | Média | `/relatorios` | `app/relatorios/page.tsx` | A central está diferente do dashboard, mas carrega dashboard, DRE e contratos na abertura. Revisar custo da tela e transformar cards em relatórios realmente geráveis/exportáveis. |
| Pendente | Alta | `/dre-gerencial` | `app/dre-gerencial/page.tsx`, `features/dre/data.ts` | Revisar cálculo POC com base na documentação oficial e separar melhor estimativa gerencial, caixa realizado, contratos sem vínculo e base de avanço. |
| Pendente | Média | `/sienge` | `app/sienge/page.tsx`, `features/sienge-coverage/data.ts` | Revisar se o mapa operacional mostra corretamente o que está em uso, parcial ou não usado. Validar contagens por arquivo SQLite e endpoints. |
| Pendente | Alta | `/configuracoes` | `app/configuracoes/page.tsx`, `components/settings/sienge-update-controls.tsx`, `lib/sienge-update-runner.ts` | Conferir atualização por área, força de atualização, histórico e status após job. É a tela central do novo padrão e precisa ser a referência das integrações. |

## Achados transversais

### 1. Listas cortadas antes da paginação

Telas afetadas:

- `/compras`: limite inicial de 500 registros.
- `/contas-receber`: limite inicial de 200 registros.

Decisão técnica pendente: trocar o envio parcial para paginação/consulta local sob demanda, mantendo a tela leve sem esconder registros do usuário.

### 2. Operações diretas no Sienge fora de Configurações

Telas/rotas afetadas:

- `/lancamentos/novo`: cria título em `POST /api/sienge/bills`.
- `/lancamentos/baixa`: atualização Pix usa `PATCH /api/sienge/bills/[billId]/installments/[installmentId]/payment-information/pix`.

Decisão de produto pendente: essas operações são transacionais, então podem ser exceções ao padrão local. Mas precisam ficar muito explícitas na interface ou sair do fluxo.

### 3. Conciliação ainda depende de carregamento client-side

Mesmo lendo SQLite por padrão, `/conciliacao` sempre inicia uma chamada para `/api/sienge/reconciliation` ao abrir. Isso explica a sensação de tela carregando. A melhoria é entregar a primeira visão local já renderizada pelo servidor e usar chamada client-side só para recarregar/progresso.

### 4. Relatórios ainda não são relatórios exportáveis

`/relatorios` virou catálogo e está melhor separado do dashboard, mas ainda abre cards de navegação. Falta a etapa de relatório gerável com filtros próprios e exportação futura.

### 5. DRE POC precisa nova rodada específica

A DRE já avisa que é estimativa, mas o cálculo é sensível. Precisa revisão dedicada usando a documentação oficial do Sienge/POC e dados reais disponíveis no SQLite.

## Plano por etapas

### Etapa 1 - Navegação e fluxo

- Revisar `/`, menu lateral e `/financeiro`.
- Decidir destino de `Novo lançamento`.
- Garantir que os atalhos refletem o padrão atual do sistema.

### Etapa 2 - Listas grandes

- Corrigir `/compras` para consultar/paginar todos os registros locais.
- Corrigir `/contas-receber` para buscar todos os registros locais sem enviar tudo no HTML inicial.
- Revisar `/sales` em períodos longos.

### Etapa 3 - Integração e Configurações

- Validar atualização de `/contratos`.
- Conferir status, histórico e força de atualização em `/configuracoes`.
- Garantir que falhas de job aparecem com mensagem útil.

### Etapa 4 - Conciliação

- Renderizar primeira leitura local no servidor.
- Manter seleção de contas e visão mensal.
- Usar progresso apenas quando houver atualização ou recarga explícita.

### Etapa 5 - Financeiro operacional

- Revisar `/contas-pagar`, `/lancamentos/baixa` e `/lancamentos/baixa-receber`.
- Separar consulta local de operação real no Sienge.
- Padronizar avisos, datas de integração e filtros.

### Etapa 6 - Análise gerencial

- Revisar `/dashboard` card a card.
- Revisar `/dre-gerencial` com foco em POC.
- Revisar `/relatorios` para virar central de relatórios geráveis.
- Revisar `/sienge` como mapa de cobertura operacional.

## Como atualizar este arquivo

- Ao iniciar uma etapa, mudar o status da rota para `Em revisão`.
- Ao corrigir, mudar para `Revisado` e registrar o commit.
- Se encontrar problema novo, adicionar em `Achados transversais` ou na linha da rota.
- Ao terminar uma etapa completa, atualizar também `STATUS_DO_PROJETO.md`.
