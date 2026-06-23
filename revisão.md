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
| Revisado | Média | `/` | `app/page.tsx` | Tela inicial confirmada como abertura rápida: não carrega dados pesados e mantém atalhos para os portais principais. |
| Revisado | Média | `/dashboard` | `app/dashboard/page.tsx`, `features/dashboard/data.ts` | Revisado: a tela segue local, usa consultas resumidas por período e separa corretamente visão passada, futura, previsto, realizado e pendente. |
| Revisado | Média | `/financeiro` | `app/financeiro/page.tsx` | Central financeira revisada: removido atalho direto para `Novo lançamento`; a central fica como ponto de acesso a consultas, baixas e conciliação. |
| Revisado | Média | `/sales` | `app/sales/page.tsx`, `components/sales/sales-explorer.tsx` | Revisada a lógica de período, permutas e listagem enxuta. Sem ajuste agora: o volume atual é baixo e os contratos do recorte seguem paginados na tela. |
| Revisado | Alta | `/compras` | `app/compras/page.tsx`, `components/purchases/purchases-portal.tsx` | Corrigida a aba Registros: deixou de receber só 500 itens e passou a buscar páginas filtradas em `/api/purchases/records`, lendo somente o SQLite local. |
| Pendente | Média | `/estoque` | `app/estoque/page.tsx`, `components/inventory/inventory-explorer.tsx` | Conferir se valores zerados e propriedade própria/terceiro estão claros. A tela já usa lista local paginada. |
| Revisado | Alta | `/contratos` | `app/contratos/page.tsx`, `features/contracts/data.ts` | Revisado: a abertura lê somente SQLite local e o estado vazio orienta atualizar Contratos em Configurações. A carga usa `/v1/supply-contracts/all` pelo job. |
| Revisado | Alta | `/conciliacao` | `app/conciliacao/page.tsx`, `components/reconciliation/reconciliation-portal.tsx`, `app/api/sienge/reconciliation/route.ts` | Revisado: a primeira leitura local é renderizada no servidor; a rota client-side com progresso ficou apenas para recarga explícita dos dados salvos. |
| Revisado | Média | `/contas-pagar` | `app/contas-pagar/page.tsx`, `features/payables-schedule/data.ts` | Revisado: agenda segue lendo SQLite local e o atalho direto para `Novo lançamento` foi removido para não misturar consulta com escrita no Sienge. |
| Revisado | Alta | `/contas-receber` | `app/contas-receber/page.tsx`, `components/tables/receivables-forecast-table.tsx` | Corrigida a listagem principal: deixou de receber só 200 parcelas e passou a buscar páginas filtradas em `/api/receivables/forecast`, lendo somente o SQLite local. |
| Revisado | Média | `/lancamentos/baixa` | `app/lancamentos/baixa/page.tsx`, `components/forms/advanced-payables-search.tsx`, `components/forms/installment-settlement.tsx` | Revisado: busca avançada e consulta de parcelas ficam como conferência local; removida a escrita Pix/PATCH no Sienge. |
| Revisado | Média | `/lancamentos/baixa-receber` | `app/lancamentos/baixa-receber/page.tsx`, `components/forms/advanced-receivables-search.tsx`, `components/forms/receivable-settlement.tsx` | Revisado: tela renomeada como consulta de recebimentos e mantém aviso de que baixa efetiva precisa ser feita no Sienge. |
| Revisado | Alta | `/lancamentos/novo` | `app/lancamentos/novo/page.tsx`, `components/forms/bill-entry-form.tsx`, `app/api/sienge/bills/route.ts` | Revisado: mantido como única operação transacional explícita, com aviso visível antes do formulário e confirmação final antes do envio. |
| Revisado | Média | `/relatorios` | `app/relatorios/page.tsx`, `features/reports/data.ts` | Revisado: a central deixou de montar DRE completa e lista completa de contratos na abertura; usa resumos locais leves e abre o relatório completo só no portal correspondente. |
| Revisado | Alta | `/dre-gerencial` | `app/dre-gerencial/page.tsx`, `features/dre/data.ts` | Revisado: retirada carga de compras não usada, reforçada leitura de margem POC e separados saldos acumulados até o exercício do resultado anual. |
| Revisado | Média | `/sienge` | `app/sienge/page.tsx`, `features/sienge-coverage/data.ts` | Revisado: mapa operacional confirmado como leitura local dos bancos e contagens por fonte, mantendo detalhe técnico apenas por ser uma tela de cobertura do Sienge. |
| Revisado | Alta | `/configuracoes` | `app/configuracoes/page.tsx`, `components/settings/sienge-update-controls.tsx`, `lib/sienge-update-runner.ts` | Revisado: status conta somente áreas atualizáveis, job mostra falhas retornadas por loaders e também falhas de subcargas em lote. |

## Achados transversais

### 0. Etapa 1 revisada - navegação e fluxo

Revisado nesta etapa:

- Menu lateral em `components/ui/app-shell.tsx`: está alinhado ao fluxo atual, sem `Início` e sem `Novo lançamento` como item de menu.
- Tela inicial `/`: continua sem carga pesada e serve como abertura rápida.
- Central financeira `/financeiro`: removido o atalho direto para `Novo lançamento`, mantendo a operação dentro do contexto de Contas a pagar.

Pendência mantida:

- `/lancamentos/novo` continua existindo como operação transacional direta no Sienge e será revisada na etapa financeira operacional.

### 1. Listas cortadas antes da paginação

Revisado nesta etapa:

- `/compras`: removido o limite inicial de 500 registros na aba Registros. A tela agora pagina e filtra via rota local `/api/purchases/records`.
- `/contas-receber`: removido o limite inicial de 200 parcelas na tabela principal. A tela agora pagina e filtra via rota local `/api/receivables/forecast`.
- `/sales`: revisado o fluxo atual; contratos são enviados de forma enxuta por recorte e paginados na tela. Não recebeu mudança nesta etapa.

Resultado: as listas que escondiam registros salvos deixaram de depender de amostra inicial. A busca passa a considerar toda a base local sem consultar o Sienge.

### Etapa 3 revisada - Integração e Configurações

Revisado nesta etapa:

- `/contratos`: confirmada abertura somente pelo SQLite local, sem consulta direta ao Sienge na tela.
- `features/contracts/data.ts`: atualização de contratos segue pelo job, usando `/v1/supply-contracts/all` e período salvo em Configurações.
- `/configuracoes`: a contagem de áreas prontas passou a considerar somente áreas atualizáveis pelos botões da própria tela.
- `lib/sienge-update-runner.ts`: falhas retornadas por loaders e subcargas em lote agora derrubam a etapa correspondente, em vez de aparecerem como atualização concluída.

Resultado: a tela de Configurações fica mais fiel ao estado real da integração, e uma falha parcial de carga não fica escondida como sucesso.

### 2. Etapa 5 revisada - Financeiro operacional

Revisado nesta etapa:

- `/contas-pagar`: removido o botão direto para `Novo lançamento`, mantendo a tela como agenda/consulta local.
- `/lancamentos/baixa`: removida a escrita de instrução Pix e a rota PATCH correspondente. A tela virou conferência de parcelas, baixas registradas e cobranças abusivas.
- `/lancamentos/baixa-receber`: reforçada como consulta de recebimentos já registrados, sem promessa de baixa pela API.
- `/lancamentos/novo`: mantida como exceção transacional explícita, com aviso visível de que cria título diretamente no Sienge.
- `features/sienge-coverage/data.ts`: o mapa Sienge passou a marcar `payment-information` como escrita bloqueada no fluxo atual.

Resultado: as telas de consulta operacional não fazem escrita no Sienge. A única escrita ainda exposta é criação de título em `/lancamentos/novo`, separada e sinalizada como operação real.

### 3. Etapa 4 revisada - Conciliação

Revisado nesta etapa:

- `/conciliacao`: deixou de iniciar `fetch` automático para `/api/sienge/reconciliation` ao abrir.
- `app/conciliacao/page.tsx`: passou a montar a primeira leitura no servidor, usando `loadReconciliationMovements()` e `analyzeReconciliation()`.
- `components/reconciliation/reconciliation-portal.tsx`: passou a receber `initialPayload`, preservar seleção de contas e visão mensal, e usar progresso apenas no botão `Recarregar dados salvos`.

Resultado: a abertura normal da conciliação usa diretamente o SQLite local renderizado pelo servidor. O painel de etapas continua disponível, mas apenas quando o usuário pede uma recarga explícita.

### Etapa 6 revisada - Análise gerencial

Revisado nesta etapa:

- `/dashboard`: conferida a separação entre período passado e futuro, previsto, realizado e pendente. A tela continua usando consultas resumidas no SQLite.
- `/relatorios`: removida a montagem pesada da DRE completa e da lista completa de contratos na abertura. A central agora usa resumos locais leves para orientar a escolha do relatório.
- `/dre-gerencial`: removida a carga de compras que não era usada no cálculo, adicionada margem POC estimada e ajustados os cards de saldos para deixar claro que são acumulados até o fim do exercício.
- `/sienge`: confirmado como mapa operacional local, com contagens por fonte e detalhamento técnico mantido apenas porque a tela serve para auditoria de cobertura.

Pendências mantidas:

- Exportação PDF/Excel dos relatórios ainda está sinalizada como próxima etapa, sem implementação.
- A DRE POC continua sendo estimativa gerencial: para virar apuração contábil completa, ainda precisa apropriação histórica por unidade vendida e medição mensal detalhada.

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

### Etapa 6 - Análise gerencial concluída

- Revisar `/dashboard` card a card.
- Revisar `/dre-gerencial` com foco em POC.
- Revisar `/relatorios` para virar central de relatórios geráveis.
- Revisar `/sienge` como mapa de cobertura operacional.

## Como atualizar este arquivo

- Ao iniciar uma etapa, mudar o status da rota para `Em revisão`.
- Ao corrigir, mudar para `Revisado` e registrar o commit.
- Se encontrar problema novo, adicionar em `Achados transversais` ou na linha da rota.
- Ao terminar uma etapa completa, atualizar também `STATUS_DO_PROJETO.md`.
