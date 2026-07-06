# Revisão das telas

Atualizado em: 2026-07-06

Este arquivo é o quadro de acompanhamento da revisão das telas do projeto. A ideia é revisar por etapas, corrigir uma frente por vez e manter este arquivo atualizado a cada ciclo.

## Critério de revisão

Cada tela deve ser conferida pelos mesmos pontos:

- Fonte dos dados: abertura da tela deve ler SQLite/local quando for tela de consulta.
- Consulta ao Sienge: deve ficar em Configurações, exceto operações explicitamente transacionais.
- Volume renderizado: listas grandes devem usar paginação e não enviar milhares de registros desnecessários ao navegador.
- Clareza comercial: texto da tela deve falar com usuário de negócio, não com detalhe técnico.
- Estado vazio/erro: deve explicar o que falta fazer sem parecer falha invisível.
- Integração: registros de lista devem indicar data de integração quando fizer sentido.
- Exportação: listas operacionais com conferência ou auditoria devem oferecer CSV quando a informação precisar sair da tela.
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
| Revisado | Alta | `/cotacoes` | `app/cotacoes/page.tsx`, `components/purchases/quotations-portal.tsx`, `components/purchases/quotations/*`, `app/api/sienge/purchase-quotations/route.ts` | Revisado: a tela lê o espelho local, mantém filtros/status/exportação CSV e chama o Sienge somente nos botões de preparo/confirmação de criação da cotação. |
| Revisado | Alta | `/cotacoes/[id]` | `components/purchases/quotation-detail/index.tsx`, `components/purchases/quotation-detail/types.ts`, `components/purchases/quotation-detail/tabs/*`, `app/api/sienge/purchase-quotations/route.ts`, `app/api/sienge/suppliers/route.ts`, `app/globals.css` | Revisado: o detalhe mantém 10 abas separadas por arquivo, com ações Sienge concentradas nas abas Sienge, Respostas, Aprovar, Mapa e Cadastros; Mapa/Aprovar seguem em layout de decisão. |
| Revisado | Alta | `/portal-cotacao/[token]` | `app/portal-cotacao/[token]/page.tsx`, `components/suppliers/*`, `lib/supplier-quote-portal.ts` | Revisado: portal público sem login, com validação de e-mail/telefone, frete obrigatório sem opção pré-selecionada, desconto à vista por porcentagem ou valor manual sem seleção inicial, itens parciais em amarelo, itens não cotados separados no detalhe final/impressão e proposta enviada apenas para consulta. |
| Revisado | Média | `/estoque` | `app/estoque/page.tsx`, `components/inventory/inventory-explorer.tsx`, `features/inventory/data.ts` | Revisado e ampliado: tela virou visão estratégica de estoque, com carteira vendável, reservas/propostas, qualidade da base de valores, propriedade, mapa imobiliário e insumos quando configurados. |
| Revisado | Alta | `/contratos` | `app/contratos/page.tsx`, `features/contracts/data.ts` | Revisado: a abertura lê somente SQLite local e o estado vazio orienta atualizar Contratos em Configurações. A carga usa `/v1/supply-contracts/all` pelo job. |
| Revisado | Alta | `/conciliacao` | `app/conciliacao/page.tsx`, `components/reconciliation/reconciliation-portal.tsx`, `app/api/sienge/reconciliation/route.ts` | Revisado: a primeira leitura local é renderizada no servidor; a rota client-side com progresso ficou apenas para recarga explícita dos dados salvos. |
| Revisado | Média | `/contas-pagar` | `app/contas-pagar/page.tsx`, `features/payables-schedule/data.ts` | Revisado: agenda segue lendo SQLite local e o atalho direto para `Novo lançamento` foi removido para não misturar consulta com escrita no Sienge. |
| Revisado | Alta | `/contas-receber` | `app/contas-receber/page.tsx`, `components/tables/receivables-forecast-table.tsx` | Corrigida a listagem principal: deixou de receber só 200 parcelas e passou a buscar páginas filtradas em `/api/receivables/forecast`, lendo somente o SQLite local. |
| Revisado | Média | `/lancamentos/baixa` | `app/lancamentos/baixa/page.tsx`, `components/forms/advanced-payables-search.tsx`, `components/forms/installment-settlement.tsx` | Revisado: busca avançada e consulta de parcelas ficam como conferência local; removida a escrita Pix/PATCH no Sienge. |
| Revisado | Média | `/lancamentos/baixa-receber` | `app/lancamentos/baixa-receber/page.tsx`, `components/forms/advanced-receivables-search.tsx`, `components/forms/receivable-settlement.tsx`, `app/api/sienge/receivables/search/route.ts`, `app/api/sienge/receivable-bills/[billId]/installments/route.ts` | Revisado: consulta recebimentos locais, mostra cadastro real da baixa quando o dump auxiliar existe, filtra por data de registro da baixa e exporta CSV pela paginação. |
| Revisado | Alta | `/lancamentos/novo` | `app/lancamentos/novo/page.tsx`, `components/forms/bill-entry-form.tsx`, `app/api/sienge/bills/route.ts` | Revisado: mantido como única operação transacional explícita, com aviso visível antes do formulário e confirmação final antes do envio. |
| Revisado | Média | `/relatorios` | `app/relatorios/page.tsx`, `features/reports/data.ts` | Revisado: a central deixou de montar DRE completa e lista completa de contratos na abertura; usa resumos locais leves e abre o relatório completo só no portal correspondente. |
| Revisado | Alta | `/dre-gerencial` | `app/dre-gerencial/page.tsx`, `features/dre/data.ts` | Revisado: retirada carga de compras não usada, reforçada leitura de margem POC e separados saldos acumulados até o exercício do resultado anual. |
| Revisado | Média | `/sienge` | `app/sienge/page.tsx`, `features/sienge-coverage/data.ts` | Revisado: mapa operacional confirmado como leitura local dos bancos e contagens por fonte, mantendo detalhe técnico apenas por ser uma tela de cobertura do Sienge. |
| Revisado | Alta | `/configuracoes` | `app/configuracoes/page.tsx`, `components/settings/sienge-update-controls.tsx`, `components/settings/sienge-dump-import-control.tsx`, `lib/sienge-update-runner.ts`, `lib/sienge-dump-import.ts` | Revisado: status conta somente áreas atualizáveis, job mostra falhas de loaders e subcargas em lote, e a tela agora importa dump `.dmpc` para SQLite com progresso em etapas. |

## Achados transversais

### 0. Etapa 1 revisada - navegação e fluxo

Revisado nesta etapa:

- Menu lateral em `components/ui/app-shell.tsx` e `components/ui/app-shell-client.tsx`: esta alinhado ao fluxo atual, sem `Inicio` e sem `Novo lancamento` como item de menu.
- A navegacao foi reorganizada em areas com submenus recolhiveis e opcao de sidebar compacta; a abertura padrao agora vem recolhida e com grupos fechados, reduzindo espaco horizontal em telas de operacao sem perder acesso as rotas.
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

### Etapa 8 revisada - Baixa a receber, dump auxiliar e CSV

Revisado nesta etapa:

- O dump `sie5204-24062026-diario3.dmpc` foi restaurado, convertido para `sienge-dump.sqlite` e mantido em `.sienge-data`, fora do Git.
- A tabela interna `ecrcbaixa` do dump passou a complementar a consulta de baixa a receber com `dtusuariocad` e `nmusuariocad`.
- `/lancamentos/baixa-receber` passou a exibir `Cadastro da baixa` em linha própria dentro de cada recebimento.
- A busca avançada de contas a receber ganhou o filtro `Data de registro da baixa`, usando a data real de cadastro no Sienge quando o dump auxiliar existe.
- O componente `LocalDataList` ganhou exportação CSV opcional, preservando a paginação padrão sem obrigar todas as telas a exibirem o botão.
- A busca avançada de contas a receber passou a exportar todos os registros filtrados, com uma linha por recebimento/baixa e campos de auditoria da baixa.

Resultado: a tela passou a separar três conceitos que antes ficavam misturados: vencimento da parcela, data financeira do recebimento e data/hora em que o usuário registrou a baixa no Sienge.

Pendência mantida:

- Levar a exportação CSV para outras listagens operacionais quando houver necessidade real de conferência fora da tela.

### Etapa 10 revisada - Cotações, abas e portal do fornecedor

Revisado nesta etapa:

- `/cotacoes` foi separado em componentes por bloco visual e responsabilidade: `filters-bar`, `request-bridge`, `summary-stats`, `status-tabs`, `quotations-list` e `helpers`.
- `/cotacoes/[id]` foi conferido contra a declaração de abas em `types.ts`; as abas atuais são Resumo, Sienge, Insumos, Fornecedores, Links, Respostas, Mapa, Aprovar, Cadastros e Histórico.
- As abas do detalhe continuam em arquivos próprios dentro de `components/purchases/quotation-detail/tabs`, com `index.tsx` apenas coordenando estado, ações e navegação.
- O portal público do fornecedor foi revisado no fluxo final: após enviar proposta, o link reabre em modo somente consulta, com opção de imprimir/salvar PDF e solicitação de novo link quando aplicável.
- A solicitação de novo link pelo fornecedor passou a gerar um link automaticamente, com limite por IP e global, mantendo a proposta já enviada apenas para consulta.
- A aba Respostas ganhou exclusão administrativa de proposta recebida; a ação remove aprovações vinculadas, registra evento e permite novo envio pelo token original quando ele ainda estiver válido e não revogado.
- Itens parciais e itens não cotados foram padronizados como atenção amarela; itens não cotados aparecem em card separado no detalhe final e na impressão.

Resultado: o fluxo de cotações ficou documentado de ponta a ponta e os códigos das áreas principais ficaram separados por arquivo, reduzindo acoplamento visual dentro dos componentes maiores.

### Etapa 11 revisada - Textos, CSS e experiência das abas de decisão

Revisado nesta etapa:

- As abas Mapa e Aprovar do detalhe da cotação foram conferidas como experiência de decisão, não apenas como formulários.
- Mapa passou a destacar melhor cesta, cobertura, parciais, economia relevante, risco de fechamento e ranking de fornecedores.
- Aprovar passou a mostrar central de decisão, recomendação automática, análise do fornecedor selecionado, checklist, cobertura salva e ações de integração em barra fixa.
- Textos visíveis de cotação foram limpos para trocar plurais técnicos como `item(ns)`, `dia(s)` e `fornecedor(es)` por frases naturais.
- O CSS das abas de decisão foi revisado para impedir que regras antigas sobrescrevam cards, colunas e estados amarelos em telas médias.

Resultado: as abas de decisão ficaram mais consistentes com o padrão visual do projeto e mais claras para quem precisa escolher fornecedor, validar parciais e registrar decisão no Sienge.

### Etapa 12 revisada - Conexões Sienge em cotações

Revisado nesta etapa:

- `/cotacoes` e `/cotacoes/[id]` foram conferidos contra o código real para separar leitura local, dry-run e gravação no Sienge.
- A abertura das telas continua usando o espelho local de compras e as tabelas locais do portal do fornecedor; não há consulta direta ao Sienge apenas por abrir a tela.
- `/api/sienge/purchase-quotations` concentra as ações reais de cotações: criar cotação, vincular item de solicitação, incluir fornecedor no item, criar insumo direto, consultar negociações, criar/atualizar negociação, atualizar itens negociados, autorizar negociação e buscar o PDF do mapa comparativo.
- `/api/sienge/suppliers` concentra a criação real de fornecedor/credor em `/v1/creditors`, também com dry-run antes da confirmação.
- O portal público do fornecedor foi confirmado como fluxo local: gera links, valida token, recebe proposta, salva resposta, registra aprovação/eventos e não chama o Sienge diretamente.

Pontos de atenção registrados:

- A ação `add-item`/Insumo direto passou a exigir apropriação de obra antes de confirmar, reduzindo o risco de payload incompleto no Sienge. A conferência de contrato deve ser repetida apenas quando houver mudança de versão da API.

Resultado: ficou documentado o que de fato acontece em cotações e detalhamento de cotações, incluindo quais ações escrevem no Sienge e quais ficam apenas no banco local.

### Etapa 13 revisada - Revisões de propostas do fornecedor

Revisado nesta etapa:

- O backend do envio de proposta passou a repetir a validação da forma de pagamento: ao menos uma opção marcada e, quando houver prazo, parcelas somando 100%.
- Reabrir um link já respondido continua mostrando a proposta em modo somente consulta, com imprimir/salvar PDF.
- A rota pública `/api/supplier-portal/link-requests` gera novo link automaticamente para o mesmo fornecedor e documento quando quem solicita possui o token de uma proposta já enviada.
- A rota de novo link bloqueia token revogado e tem limite de requisições por IP e global.
- A criação inicial do link pela equipe fica concentrada na aba Fornecedores do detalhe da cotação, com modal para copiar/abrir o convite sem desviar o usuário para a aba Sienge.
- Links gerados para fornecedor pré-definido carregam os dados conhecidos no portal público e travam nome, documento, e-mail e telefone quando esses valores vêm no convite/base local; a rota de envio também rejeita tentativa de alteração manual.
- A etapa de pagamento à vista exige escolher Sim/Não para desconto sem padrão inicial; ao escolher Sim, o fornecedor seleciona porcentagem ou valor manual antes de informar o desconto.
- A etapa de pagamento a prazo do portal exige escolher Sim/Não sem padrão inicial; ao escolher Sim, a tabela começa vazia e o fornecedor deve gerar parcelas automaticamente ou adicionar manualmente.
- O resumo final do portal ganhou visual mais próprio para impressão e botão para anexar a proposta gerada no sistema do fornecedor; o arquivo fica disponível no detalhe enviado e na aba Respostas.
- A aba Respostas permite excluir uma resposta recebida; a rota dinâmica de exclusão permanece protegida por sessão, porque o middleware só libera a rota pública exata de envio de propostas.
- A exclusão de resposta remove aprovações vinculadas e registra evento `response_deleted` na timeline.

Resultado: revisão de proposta deixou de depender de edição do envio anterior. O fornecedor recebe um novo link para revisar, enquanto a equipe mantém controle para excluir uma resposta incorreta quando necessário.

### Etapa 14 revisada - Integração Sienge e anti-duplicidade

Revisado nesta etapa:

- `/api/sienge/purchase-quotations` passou a calcular `integrationKey` por operação confirmada e bloquear repetição antes de chamar o Sienge.
- A criação de cotação a partir de detalhe já existente é bloqueada por padrão, porque a cotação já tem ID no Sienge; a criação real fica para o fluxo de solicitação em `/cotacoes`.
- A criação de cotação vinda de solicitação agora usa chave global pela solicitação e, ao retornar ID do Sienge, registra a criação e os vínculos de itens no histórico local.
- `attach-items`, `add-supplier`, `add-item` e `send-negotiation` registram a chave usada, permitindo que a tela bloqueie novo envio idêntico e peça confirmação explícita para repetir.
- `/api/sienge/suppliers` passou a bloquear criação duplicada de credor por CPF/CNPJ em qualquer cotação já registrada.
- A aba Sienge ganhou histórico de integrações e erros, status por tema e aviso quando uma operação já foi integrada.
- O insumo direto passou a exigir apropriação de obra antes de confirmar, com unidade construtiva, referência do orçamento e percentual total de 100%.

Resultado: a integração ficou mais segura contra cliques repetidos e reprocessamentos acidentais. Conferências (`dryRun`) continuam livres; apenas gravações confirmadas são deduplicadas.

### Etapa 15 revisada - Aba Sienge e pré-consulta

Revisado nesta etapa:

- A aba Sienge foi reorganizada para deixar o menu de temas menor e a área operacional maior.
- O seletor de fornecedor passou a mostrar mais contexto: nome fantasia, documento, ID, cidade/UF e status ativo/inativo quando esses campos existem no espelho local.
- `/api/sienge/purchase-quotations` passou a montar um `preflight` antes das escritas confirmadas, consultando cotação/negociações e, quando houver fornecedor, o credor no Sienge.
- A inclusão de fornecedor bloqueia duplicidade quando a pré-consulta indica o mesmo fornecedor no mesmo item; a criação de insumo direto bloqueia quando o insumo já aparece na consulta da cotação.
- O envio de negociação reaproveita a última negociação existente do fornecedor na cotação antes de tentar criar uma nova.
- `/api/sienge/suppliers` passou a consultar `/v1/creditors` por CPF/CNPJ antes de criar credor, retornando `409` quando o documento já existe.

Resultado: a operação ficou mais clara na tela e as gravações confirmadas passaram a consultar o Sienge antes de escrever, reduzindo o risco de duplicidade fora do histórico local.

### Etapa 9 revisada - Importação do dump em Configurações

Revisado nesta etapa:

- `/configuracoes` ganhou o bloco `Importar dump do Sienge`, com seleção do arquivo `.dmpc` e acompanhamento visual.
- `/api/sienge/dump-import` foi criada para receber o arquivo, salvar em `.sienge-data/imports` e iniciar a conversão em segundo plano.
- `scripts/import-sienge-dump.py` passou a formalizar o fluxo local: validar `PGDMP`, subir PostgreSQL temporário, restaurar o dump, gerar catálogos, converter para SQLite e publicar `sienge-dump.sqlite`.
- O status da importação fica salvo em `.sienge-data/dump-import-status.json`, permitindo reabrir Configurações e continuar vendo a última etapa conhecida.

Resultado: o dump auxiliar deixou de depender de conversão manual fora do sistema. A atualização continua local, fora do Git, e passa a alimentar o SQLite complementar usado pelas telas.

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

### Etapa 7 revisada - Estoque e patrimônio

Revisado nesta etapa:

- `/estoque`: deixou de ser apenas uma lista de bens e passou a abrir com visão estratégica de estoque.
- Foram adicionados cards e blocos para estoque precificado, unidades disponíveis para venda, reservas/propostas, itens sem valor informado, mapa imobiliário, insumos em estoque e propriedade própria/terceiro.
- A visão principal passou a considerar a carteira comercial ativa; negócios concluídos e itens de terceiros ficam disponíveis na lista pelo filtro `Histórico completo`.
- A integração de Estoque em Configurações passou a buscar também tabelas de preço, reservas de insumos e, quando houver centros de custo configurados, mapa imobiliário consolidado e insumos por centro de custo.
- A lista operacional ganhou filtro para separar itens com valor informado e sem valor informado.
- O mapa Sienge e o histórico por portal passaram a considerar as novas fontes de estoque.

Pendência mantida:

- Mapa imobiliário e insumos por centro de custo dependem do preenchimento de centros de custo em Configurações e de permissão no Sienge para esses endpoints.

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

### Etapa 7 - Estoque e patrimônio concluída

- Revisar `/estoque` como visão estratégica comercial.
- Incluir novas fontes de estoque, mapa imobiliário e insumos quando configurados.
- Separar carteira ativa, histórico e itens sem valor informado.

### Etapa 8 - Baixa a receber, dump auxiliar e CSV concluída

- Usar o dump convertido para complementar dados que a API pública não entrega.
- Mostrar data/hora e usuário de cadastro da baixa a receber.
- Filtrar recebimentos por data de registro da baixa.
- Exportar a busca avançada de contas a receber em CSV pelo componente padrão de paginação.

### Etapa 10 - Cotações e portal do fornecedor concluída

- Revisar `/cotacoes`, `/cotacoes/[id]` e `/portal-cotacao/[token]`.
- Confirmar que as abas do detalhe estão separadas por arquivo e documentadas.
- Separar a tela principal de cotações em componentes por bloco.
- Conferir o detalhe final/impressão do fornecedor para itens parciais e não cotados.

## Como atualizar este arquivo

- Ao iniciar uma etapa, mudar o status da rota para `Em revisão`.
- Ao corrigir, mudar para `Revisado` e registrar o commit.
- Se encontrar problema novo, adicionar em `Achados transversais` ou na linha da rota.
- Ao terminar uma etapa completa, atualizar também `STATUS_DO_PROJETO.md`.
