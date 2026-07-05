# Status do projeto Brasin

Atualizado em: 05/07/2026

Este arquivo resume o que foi feito neste chat e ainda está valendo no código. A ideia é manter este documento atualizado sempre que uma tela, consulta, banco local ou comportamento importante mudar.

## Atualização mais recente

- O sistema passou a exigir senha para acesso: todas as telas e rotas internas ficam atrás de login, com exceção explícita do portal público do fornecedor.
- Foi criado o fluxo completo de cotações de compra: tela de solicitações (`/solicitacoes-compra`), portal de cotações (`/cotacoes`), detalhe da cotação (`/cotacoes/[id]`) e portal público do fornecedor (`/portal-cotacao/[token]`).
- A tela `/cotacoes` foi revisada e separada em componentes por responsabilidade: filtros, origem/criação no Sienge, estatísticas, abas rápidas de status, lista/exportação e helpers.
- O detalhe da cotação mantém cada aba em arquivo próprio dentro de `components/purchases/quotation-detail/tabs`, com os tipos e a ordem centralizados em `components/purchases/quotation-detail/types.ts`.
- O fornecedor recebe um link assinado com validade padrão de 7 dias e responde a cotação sem precisar de conta; a resposta fica salva no banco local `supplier-quotations.sqlite`.
- Links do fornecedor podem ser revogados a qualquer momento pela aba Links da cotação; link revogado deixa de abrir o portal e de aceitar propostas.
- As rotas públicas do portal ganharam limite de requisições por IP e limite global, para conter abuso sem login.
- O login ganhou bloqueio de força bruta com teto global independente do IP informado, fechando o desvio por cabeçalho `x-forwarded-for` forjado.
- As comparações de assinatura de sessão e de token usam comparação em tempo constante.
- O segredo local do portal do fornecedor é gravado de forma atômica, evitando que dois processos concorrentes invalidem os links um do outro.
- A decisão da cotação pode ser aprovada por cotação inteira ou item a item, com justificativa registrada e comparativo de melhor preço por insumo.
- A criação da cotação no Sienge usa dry-run antes de confirmar, com eventos de integração registrados na timeline da cotação.
- A aba Mapa ganhou análise de decisão com melhor cesta, cobertura, parciais, economias relevantes e ranking de fornecedores.
- A aba Aprovar virou uma central de decisão com recomendação automática, status de prontidão, análise do fornecedor escolhido, checklist e layout responsivo.
- Textos das telas de cotação foram revisados para remover plurais técnicos como `item(ns)` e padronizar mensagens comerciais; o CSS das abas Mapa/Aprovar foi revisado para evitar sobrescritas antigas em telas médias.
- Foi documentado o mapa real das conexões Sienge em cotações: telas abrem pelo espelho local, escritas passam por dry-run em `/api/sienge/purchase-quotations`, e o portal público do fornecedor não chama o Sienge diretamente.
- O portal do fornecedor passou a validar forma de pagamento também no backend, gerar novo link automaticamente quando o fornecedor solicita revisão de uma proposta já enviada, e permitir que a equipe exclua uma resposta pela aba Respostas.
- A integração Sienge de cotações mantém histórico de gravações na própria aba Sienge, bloqueia envios confirmados duplicados por chave de operação e faz pré-consulta ao Sienge antes das escritas confirmadas.

## Acesso e autenticação

- O acesso ao sistema é protegido por senha única definida em `APP_ACCESS_PASSWORD` (mínimo de 12 caracteres) no `.env`; `APP_AUTH_SECRET` pode definir um segredo de assinatura separado.
- O `middleware.ts` valida um cookie de sessão HMAC (`brasin_session`) em toda requisição; sessão dura 12 horas, cookie `httpOnly`, `sameSite lax` e `secure` em produção.
- A tela `/login` faz o acesso e preserva a rota de destino; o botão Sair fica no topo do sistema.
- Rotas públicas são uma lista explícita no middleware: `/login`, `/api/auth/*`, `/portal-cotacao/*`, `/api/supplier-portal/responses`, `/api/supplier-portal/link-requests` e `/api/supplier-portal/suppliers`. Todo o resto exige sessão.
- Ao criar uma nova rota pública de fornecedor, é preciso lembrar de adicioná-la à lista `publicPath` do middleware.
- O login bloqueia força bruta: 8 falhas por 15 minutos por IP e teto global de 40 falhas por 15 minutos independente do IP informado (o cabeçalho `x-forwarded-for` pode ser forjado quando não há proxy confiável na frente).
- As verificações de assinatura (sessão no middleware e senha no login) usam comparação em tempo constante.
- Páginas públicas (`/login` e `/portal-cotacao`) não renderizam o shell interno de navegação.

## Solicitações de compra

- A tela `/solicitacoes-compra` mostra a fila de compras com as solicitações abertas, itens em cotação e insumos na carteira, lidas do espelho local de compras.
- É possível cadastrar solicitações manuais com centro de custo e data de necessidade; solicitações criadas na tela ficam guardadas no navegador.
- A lista de insumos pode ser exportada para orientar a cotação.

## Cotações e portal do fornecedor

- A tela `/cotacoes` lista as cotações do espelho local com filtros por status, comprador, pesquisa e origem, cards de resumo (abertas, em decisão, total), abas rápidas por status e exportação CSV.
- A implementação da tela `/cotacoes` fica separada em `components/purchases/quotations`: `filters-bar.tsx`, `request-bridge.tsx`, `summary-stats.tsx`, `status-tabs.tsx`, `quotations-list.tsx` e `helpers.ts`.
- O detalhe `/cotacoes/[id]` organiza a operação em abas: Resumo, Sienge, Insumos, Fornecedores, Links, Respostas, Mapa, Aprovar, Cadastros e Histórico.
- As abas do detalhe ficam separadas em arquivos próprios em `components/purchases/quotation-detail/tabs`, enquanto `index.tsx` coordena estado, chamadas e navegação entre abas.
- A aba de fornecedores permite escolher um credor do Sienge (busca local com criação quando necessário) e gerar o link público de resposta em um modal na própria tela do fornecedor.
- Cada link é um token assinado (HMAC) com validade padrão de 7 dias, vinculado à cotação e, quando informado, ao documento do fornecedor.
- A aba Links mostra validade, status (aguardando, respondido, vencido, revogado), contagem de respostas e ações de copiar, regerar e revogar; a criação inicial do convite fica concentrada na aba Fornecedores.
- Revogar um link registra o evento e bloqueia imediatamente o portal público e o envio de propostas por aquele token.
- O portal público `/portal-cotacao/[token]` permite ao fornecedor informar, item a item: se atende, preço unitário, quantidade, prazo diferente do pedido e observação; preço zero informado é tratado como valor válido.
- Itens parciais usam quantidade menor que a solicitada e destaque amarelo. Itens que o fornecedor não cotou aparecem separados no detalhe final/impressão, também com fundo amarelo.
- Depois que a proposta é enviada, reabrir o link mostra somente o detalhe da proposta, com ação de imprimir/salvar PDF. Quando o fornecedor solicita revisão, o portal gera automaticamente um novo link para envio de nova proposta; a proposta já enviada não fica editável.
- A aba Respostas permite excluir uma resposta do fornecedor. A exclusão remove aprovações vinculadas àquela resposta, registra evento e libera o token original para novo envio caso o link ainda esteja válido e não revogado.
- Quando o documento do fornecedor não existe na base local, a resposta entra com cadastro pendente para revisão (nome fantasia, cidade e estado), e a equipe pode preparar a criação do credor no Sienge.
- O comparativo por item marca o melhor preço entre as respostas recebidas e alimenta a aba de aprovação.
- A aba Mapa mostra leitura gerencial da cotação: melhor cesta por item, cobertura de preços, itens parciais, maiores economias e ranking por fornecedor.
- A aprovação registra vencedor por cotação inteira ou por item, com justificativa obrigatória, salva no banco local.
- A aba Aprovar mostra prontidão da decisão, recomendação automática, cobertura salva, checklist e análise do fornecedor selecionado antes de enviar a decisão ao Sienge.
- A timeline de eventos registra: link enviado, novo link solicitado, link revogado, resposta recebida, resposta excluída, fornecedor aprovado, erro de integração e criação no Sienge.
- Respostas, convites, aprovações, revisões de cadastro e eventos ficam em `supplier-quotations.sqlite`, dentro de `.sienge-data`.
- O segredo de assinatura vem de `SUPPLIER_PORTAL_SECRET` ou é gerado localmente uma única vez, com gravação atômica para evitar corrida entre processos.
- Segurança das rotas públicas: envio de propostas limitado a 20 por 10 minutos por IP (200 global), solicitação de novo link a 8 por 10 minutos por IP (80 global) e consulta de fornecedor a 30 por 10 minutos por IP (300 global); corpo do envio limitado a 128 KB e campos saneados antes de gravar.
- A integração com o Sienge cria a cotação (`/v1/purchase-quotations`), anexa itens da solicitação e inclui fornecedores por item, sempre com dry-run de conferência antes de confirmar a gravação.
- As ações reais de escrita em cotações ficam concentradas em `/api/sienge/purchase-quotations`: criar cotação, vincular item de solicitação, incluir fornecedor por item, criar insumo direto, criar/atualizar negociação e autorizar a última negociação.
- Escritas confirmadas no Sienge registram `integrationKey` no histórico local; antes de gravar novamente, a rota verifica se a mesma criação, vínculo de item, vínculo de fornecedor, insumo direto, negociação, autorização ou criação de credor já foi integrada.
- Antes das escritas confirmadas em cotação, a rota consulta a cotação/negociações no Sienge, consulta o credor quando há fornecedor, reaproveita negociação já existente e retorna o bloco `preflight` com os indícios encontrados.
- A aba Sienge mostra o histórico de integrações e erros da cotação, marca temas já integrados, deixa o menu de temas mais compacto e prioriza a área operacional maior.
- O insumo direto exige apropriação de obra antes de confirmar: unidade construtiva, referência do item de orçamento e percentual total de 100%.
- O PDF do mapa comparativo usa a rota interna `/api/sienge/purchase-quotations?type=comparison-map&quotationId={id}`, que consulta o Sienge em `/v1/purchase-quotations/comparison-map/pdf?purchaseQuotationId={id}`.
- A criação de fornecedor pendente usa `/api/sienge/suppliers`, com dry-run antes da confirmação real em `/v1/creditors`.
- A rota `/api/sienge/suppliers` busca credores no Sienge e, antes de criar credor por cadastro pendente, consulta `/v1/creditors` por CPF/CNPJ para bloquear cadastro duplicado.
- Configurações ganhou a área de atualização `Fornecedores`, que espelha os credores do Sienge (`/v1/creditors`) usados para localizar e vincular fornecedores nas cotações.

## Estado geral

- O projeto principal está em `frontend`, usando Next.js 14, React 18 e TypeScript.
- As credenciais do Sienge e a senha de acesso ficam em `.env` para uso local. Esse arquivo não entra no Git.
- Os dados consultados no Sienge são gravados em SQLite local como um espelho da API.
- Bancos locais, `.env`, `node_modules`, builds e arquivos temporários estão ignorados no Git.
- O histórico de etapas concluídas fica registrado em commits pequenos e descritivos no Git.

## Padrão atual do projeto

- Telas comuns não devem consultar o Sienge ao abrir.
- Toda tela operacional deve ler os dados salvos no SQLite local.
- A consulta ao Sienge deve ficar concentrada em `/configuracoes`, nos botoes de atualizacao.
- Quando uma tela não encontrar dado local, deve orientar o usuário a atualizar a área em Configurações.
- Atualizacao normal deve preservar dados pagos, baixados, recebidos, cancelados ou finalizados quando forem identificados.
- Atualizacao com forca pode substituir tambem dados finalizados.
- Toda lista exibida ao usuario deve mostrar a data de integracao com o Sienge quando o registro tiver essa informacao.
- Listas grandes devem usar o componente padrao de listagem local com paginacao inicial de 100 registros, opcao de troca e, quando fizer sentido operacional, exportacao CSV.
- Textos visíveis fora de Configurações devem ser comerciais e claros, evitando termos técnicos como endpoint, bulk, SQLite e detalhes internos.
- Configuracoes pode concentrar linguagem mais administrativa, historico de integracao, periodo de atualizacao, tamanho dos bancos e acoes de carga.
- Rotas acessiveis sem login sao excecao explicita e precisam constar na lista de rotas publicas do middleware; rotas publicas que recebem dados de fora devem ter limite de requisicoes e validacao de tamanho/conteudo.
- Operacoes de escrita no Sienge devem oferecer dry-run de conferencia antes de confirmar a gravacao.
- Dashboard abre por padrao em 7 dias e permite trocar periodo e passado/futuro na propria tela.
- Graficos de periodo devem agrupar por dia em recortes curtos, por semana em 60/90 dias e por mes em recortes maiores.
- `.env`, bancos SQLite, cache, builds, `node_modules` e arquivos temporarios nao devem entrar no Git.
- Ao terminar uma etapa completa e validada, deve ser feito um commit pequeno e descritivo.
- Antes de fechar etapa com codigo relevante, validar com `npm run build` e/ou `npx tsc --noEmit --incremental false`.

## Banco local e espelho do Sienge

- Foi criado um modelo de armazenamento local em SQLite para reduzir chamadas repetidas na API do Sienge.
- As telas deixam de usar cache diario como fonte principal.
- Dashboard, vendas, compras, contas, estoque e conciliacao leem o banco local ao abrir.
- A consulta ao Sienge fica concentrada na tela de Configuracoes, pelos botoes de atualizacao.
- Quando uma tela nao encontra dado local, ela orienta atualizar a area em Configuracoes, em vez de chamar o Sienge automaticamente.
- Todo registro de lista retornado pelo Sienge recebe metadados de integracao para a tela mostrar o dia em que aquele dado foi carregado.
- Os dados foram separados por responsabilidade para acompanhar melhor o crescimento dos arquivos:
  - contas a pagar
  - contas a receber
  - conciliacao
  - estoque e patrimonio
  - compras
  - vendas comerciais
  - cotacoes com fornecedores (respostas, links, aprovacoes e eventos)
- Cada banco de responsabilidade possui tabela de espelho da API e historico de integracao.
- As respostas da API sao armazenadas em tabelas mantendo o padrao dos dados retornados, com chave de registro para evitar repeticao sempre que possivel.
- As consultas bulk devem usar o maior periodo util possivel e gravar o resultado localmente, para manter um banco paralelo consultavel.
- Ao atualizar dados comuns, registros que parecem pagos, baixados, recebidos, cancelados ou finalizados sao preservados.
- A opcao "atualizar com forca" em Configuracoes permite substituir tambem dados finalizados.

## Dump oficial do Sienge

- Dumps oficiais extraidos do Sienge podem ser mantidos como fonte auxiliar em `.sienge-data`, fora do Git, para complementar campos internos que a API publica nao entrega.
- A tela `/configuracoes` tem a opção `Importar dump do Sienge`, que permite selecionar um arquivo `.dmpc` local e iniciar a conversão em segundo plano.
- A importação valida o arquivo `PGDMP`, restaura em PostgreSQL local temporário, gera catálogos, converte as tabelas para `.sienge-data/sienge-dump.sqlite` e publica o SQLite de forma atômica.
- O progresso aparece por etapas reais: validar arquivo, preparar ferramentas locais, restaurar dump, ler catálogo, gerar SQLite e publicar dados.
- A rota `/api/sienge/dump-import` inicia a carga e consulta o status salvo em `.sienge-data/dump-import-status.json`.
- O dump `sie5204-24062026-diario3.dmpc` foi restaurado e convertido, gerando um SQLite auxiliar com 2.150 tabelas e 1.040.331 linhas validadas.
- O dump convertido é usado hoje para enriquecer recebimentos com usuário e data/hora real de cadastro da baixa (tabela interna `ecrcbaixa`).

## Dashboard inicial

- A rota `/` nao abre mais o dashboard automaticamente.
- A rota `/` agora e uma tela de boas-vindas leve, sem consulta ao Sienge e sem carregamento pesado de dados.
- O menu lateral foi simplificado: `Inicio` saiu da lista e o logo/nome Brasin passou a ser o atalho para a tela inicial.
- A tela inicial do dashboard agora traz uma visao geral com um pouco de cada portal.
- O dashboard passou a abrir com periodo inicial curto de 7 dias para carregar e renderizar mais rapido.
- O dashboard permite trocar a visao do periodo na propria tela, por botoes de Hoje, 7 dias, 15 dias, 30 dias, 60 dias, 90 dias, 6 meses, 12 meses e 24 meses.
- Mesmo com a opcao Hoje disponivel, a abertura padrao do dashboard continua em 7 dias.
- O dashboard permite escolher se o periodo analisado e futuro ou passado, preservando essa escolha ao trocar a quantidade de dias.
- Os cards de atraso do dashboard ficam restritos a visao de periodo passado.
- O dashboard nao exibe mais atalho visual para atraso acumulado; a leitura principal fica concentrada no periodo escolhido.
- Os cards financeiros do dashboard foram renomeados para explicitar quando mostram valores em aberto no periodo, separando isso do saldo realizado por baixas/recebimentos.
- Os cards de receber/pagar foram separados entre valores em aberto, a vencer e em atraso, deixando claro quando um periodo passado concentra quase tudo em vencido.
- A tela do dashboard foi reorganizada visualmente para leitura estrategica: primeiro leitura de caixa, depois blocos separados de recebimentos, pagamentos e operacao.
- Quando o dashboard esta em periodo passado, os blocos financeiros mostram leitura de realizacao: previsto, recebido/pago e nao recebido/nao pago. Quando esta em periodo futuro, os blocos mostram previsao por vencimento, valores ja recebidos/pagos e saldo futuro, sem card de atraso.
- No periodo futuro, os blocos financeiros tambem mostram valores ja recebidos ou ja pagos vinculados a parcelas que vencem no recorte, mesmo quando a baixa ocorreu antes do vencimento.
- O topo executivo da visao futura mostra saldo futuro liquido, a receber restante, a pagar restante e ja realizado vinculado ao recorte, sem usar saldo realizado por data.
- Na visao futura, o dashboard remove graficos operacionais que dependem de historico, como vendas, compras e estoque, para evitar cards vazios ou fora de contexto.
- Na visao futura, os blocos de previsao de recebimento e previsao de pagamento ocupam a largura total em duas colunas, com listas lado a lado de recebiveis por cliente, pagamentos por fornecedor e pagamentos por obra/empresa.
- Na visao passada, entradas x saidas e vendas por mes ocupam a largura total, enquanto compras e pedidos de compra ficam lado a lado.
- O seletor de visao do dashboard foi compactado para mostrar apenas modo, periodo e datas, com botoes de periodo em uma barra horizontal.
- O card de contas a pagar em aberto passou a excluir parcelas que ja possuem baixa registrada no SQLite.
- O dashboard monta seus indicadores por consultas resumidas diretas no SQLite local, sem carregar os portais completos de contas, vendas, estoque e compras por tras da tela.
- A configuracao antiga de dashboard em meses foi neutralizada para nao abrir 90 dias por engano quando ainda nao existir a nova configuracao em dias.
- O grafico de entradas x saidas casa entradas e saidas no mesmo calendario, com agrupamento diario ate 30 dias, semanal em 60/90 dias e mensal acima disso; na visao passada usa recebimentos e pagamentos realizados por data de baixa, na futura usa previsao por vencimento.
- O grafico de pedidos de compra e o de vendas por mes usam o mesmo agrupamento do periodo selecionado; vendas mostra tambem a quantidade em cada coluna.
- O bloco de unidades por situacao e um grafico de pizza com percentual e quantidade por situacao comercial, com legenda em duas colunas.
- O resumo de compras por periodo foi padronizado para mostrar Total comprado, Pendentes, Concluidos e Atrasados, sempre com valor e contagens coerentes do recorte.
- A revisao card a card padronizou os rankings para mostrar unidades corretas, como parcelas em contas e contratos em vendas.
- A tela de Configuracoes continua guardando preferencias gerais, mas a troca rapida do periodo do dashboard fica disponivel no proprio dashboard.
- O dashboard tem tela de carregamento propria, mostrando que a visao geral esta sendo atualizada a partir do banco local.
- Cards de resumo: contas a receber, contas a receber em atraso, contas a pagar, contas a pagar em atraso, saldo previsto, saldo realizado, vendas e compras pendentes.
- Graficos: entradas x saidas, compras feitas x pendentes, vendas por mes, pedidos de compra por mes, unidades por situacao comercial, recebiveis por cliente, compras por periodo e vendas por empreendimento.
- Se alguma area falhar, o dashboard exibe visao parcial e continua mostrando os modulos que carregaram.

## Contas a pagar

- Foi criado portal de contas a pagar com visao do que esta programado para hoje, semana, mes atual e proximos meses configurados.
- A tela abre lendo apenas o SQLite local; consulta ao Sienge fica restrita a atualizacao em Configuracoes.
- A agenda le a tabela local `bulk_outcome_installments`, respeitando saldo em aberto, vencimento e metadados de integracao.
- A listagem da agenda mostra fornecedor, empresa, documento, titulo/parcela, autorizacao e data de integracao sem campos `undefined`.
- A tela deixou de exibir atalho direto para `Novo lancamento`, mantendo-se como agenda e consulta local; o lancamento fica em `/lancamentos/novo` como excecao transacional explicita.
- A busca avancada consulta tambem parcelas nao baixadas, nao apenas baixas, diretamente nas tabelas estruturadas do SQLite, com filtros por data, empresa, obra e baixa aplicados no banco local.
- Foram adicionados indices locais para acelerar consultas por vencimento, emissao, competencia, pagamento, empresa e obra.
- A consulta de parcelas de um titulo na tela de baixa tambem le o SQLite local, sem depender dos endpoints REST de detalhe do titulo.
- A tela mostra vencimento, forma, envio ao banco, situacao, valor original, valor corrigido, acrescimo corrigido e multa/juros pagos a mais quando esses dados existem no espelho local.
- Foi criado um modal de analise de cobranca para detectar possiveis cobrancas acima do criterio de 2% no ato mais 1% ao mes, usando os dados salvos como triagem operacional.
- A busca avancada tem filtro para exibir somente possiveis cobrancas abusivas, com dashboard em modal agrupado por credor, ranking dos 10 maiores por percentual/valor e lista completa paginada ordenada pela soma do possivel excesso.
- O numero do titulo foi aumentado visualmente, com botao para copiar; o CNPJ aparece quando disponivel e a busca por CNPJ e feita sobre o resultado ja carregado.
- A tela informa melhor erros de autorizacao, permissao e limite de consultas, diferenciando limite REST de limite bulk quando possivel.
- Nas buscas avancadas de contas a pagar e contas a receber, pesquisar com `#385` filtra exatamente o titulo 385.

## Lancamento e baixa

- Foi criada tela de lancamento de titulo (`/lancamentos/novo`), mantida como excecao transacional explicita, com aviso visivel antes do formulario.
- Foi criada tela de baixa/consulta de baixa (`/lancamentos/baixa`), que funciona somente como conferencia de parcelas, baixas registradas e cobrancas abusivas.
- O PATCH de instrucao Pix no Sienge foi removido da tela de baixa, junto com a rota backend correspondente.
- A baixa efetiva pela API publica permanece bloqueada quando nao existe endpoint publico seguro para registrar a operacao; a tela evita prometer uma operacao que nao seria realmente gravada no Sienge.
- Foi criada uma tela separada de baixa a receber, em `/lancamentos/baixa-receber`, reforcada como consulta de recebimentos, sem promessa de baixa efetiva pela API.
- A tela de baixa a receber consulta parcelas e recebimentos ja registrados no banco local `finance-receivables.sqlite`, usando as tabelas estruturadas do espelho `/bulk-data/v1/income`.
- Quando o dump auxiliar `sienge-dump.sqlite` estiver disponivel, a baixa a receber cruza os recebimentos com `ecrcbaixa` para mostrar quando a baixa foi cadastrada no Sienge e por qual usuario.
- A baixa a receber mostra `Cadastro da baixa`, com data/hora real do cadastro (`dtusuariocad`) e usuario responsavel (`nmusuariocad`), alem da data financeira do recebimento; quando o dump nao esta disponivel, a tela informa que essa data nao veio na API publica.
- A busca avancada de baixa a receber tem filtro por `Data de registro da baixa`, diferente da data financeira de recebimento, e exporta CSV com todos os registros filtrados, em uma linha por recebimento.
- Na listagem de recebimentos, titulo, parcela e vencimento aparecem conectados lado a lado; o numero do titulo copia pelo botao compacto e o vencimento fica verde quando recebido, vermelho quando vencido e branco quando ainda nao venceu.
- A consulta por codigo do titulo a receber mostra parcelas, saldo, recebimentos registrados, movimentos vinculados, cliente, projeto e data de integracao.
- A tela foi adicionada ao menu de Operacoes, a Central financeira e como acao da tela de Contas a receber.

## Contas a receber

- A previsao de recebimentos nao depende de selecionar um cliente manualmente e usa dados bulk de recebiveis quando disponiveis.
- A tela tem foco em responder o que deve entrar de dinheiro, em vez de exigir cadastro de cliente antes de abrir.
- A tela abre lendo apenas o SQLite local; consulta ao Sienge fica restrita a atualizacao em Configuracoes.
- A previsao le a tabela local `bulk_income_installments`, considerando saldo corrigido, saldo em aberto ou valor original quando necessario.
- A listagem principal pagina/filtra toda a base local por `/api/receivables/forecast`, em vez de receber somente uma amostra.
- Os rankings e graficos usam "parcela" como unidade, e a listagem mostra titulo, cliente, vencimento, projeto/unidade, valor em aberto, recebido, situacao e data de integracao.
- A busca avancada pode filtrar por vencimento, emissao, competencia, data de recebimento ou data real de cadastro da baixa (quando o dump auxiliar estiver disponivel).
- O detalhe do recebimento mostra data financeira, tipo de recebimento, cadastro da baixa e usuario responsavel quando esses dados existem, com destaque visual para o cadastro da baixa.
- A busca avancada exporta CSV com todos os registros filtrados, em uma linha por recebimento/baixa, incluindo titulo, parcela, cliente, valores, data de recebimento, cadastro da baixa, usuario da baixa e data de integracao.

## Portal comercial / vendas

- Foi criado o portal `/sales`, lendo contratos de venda salvos em `commercial-sales.sqlite`, sem consultar o Sienge automaticamente.
- A listagem exibe por ordem de venda, com grafico de vendas por mes.
- A tela tem seletor de periodo no mesmo padrao visual do Dashboard (Hoje, 7, 15, 30, 60, 90 dias, 6, 12 e 24 meses, visao passada ou futura), abrindo por padrao em 12 meses passados.
- Cards, grafico mensal, ranking, situacao dos contratos e listagem respeitam o recorte selecionado.
- A tela separa valor bruto contratado, permutas e carteira liquida comercial: condicoes de pagamento do tipo `PE` ou com nome de permuta nao inflam os indicadores, evitando contar duas vezes bens dados em outros negocios.
- Cards, graficos e rankings usam valor liquido comercial; o detalhe do contrato mostra bruto, permuta abatida e valor liquido para conferencia.
- A listagem enxuta preserva `conditionTypeId`, `totalValue` e `totalValueInterest`, garantindo que permutas continuem sendo identificadas no detalhe.
- A busca/listagem recebe todos os contratos locais enxutos, com paginacao na tela.

## Contratos de fornecimento

- A tela `/contratos` exibe contratos de fornecimento lidos dos dados salvos de `/v1/supply-contracts`, carregados pelo endpoint de listagem `/v1/supply-contracts/all` com periodo definido em Configuracoes.
- A DRE POC, o Mapa Sienge e o historico de integracao usam o mesmo endpoint, evitando leitura vazia por endpoint incorreto.
- A ausencia de `contracts-supply.sqlite` e tratada como dado local ainda nao salvo, sem exibir detalhes tecnicos de API na abertura.
- A atualizacao dos contratos fica em Configuracoes, junto das demais areas.
- A tela mostra valor contratado, saldo estimado, contratos ativos, fornecedores, ranking por situacao e listagem paginada.

## Relatórios

- A tela `/relatorios` funciona como central de relatorios geraveis, separada do Dashboard, lendo somente dados salvos.
- A central apresenta cartoes para financeiro por periodo, contas a pagar, contas a receber, compras, vendas, contratos, estoque e DRE POC estimada.
- Cada relatorio mostra escopo, metricas rapidas e botao para abrir o portal detalhado; a exportacao PDF/Excel esta sinalizada como proxima etapa.
- A central nao monta mais a DRE completa nem a listagem completa de contratos ao abrir; usa resumos locais leves de `features/reports/data.ts` e delega o relatorio completo para cada tela.
- A central permite escolher o periodo padrao e a visao passado/futuro, e pode iniciar em segundo plano a atualizacao dos dados usados nos relatorios.
- A atualizacao "Todos os relatorios" carrega financeiro, contas a receber, vendas, contratos, estoque e compras sem puxar conciliacao junto.

## DRE POC estimada

- Foi criada a rota `/dre-gerencial`, lendo somente os dados salvos nos bancos locais, sem consultar o Sienge na abertura.
- A tela foi renomeada visualmente para DRE POC estimada, deixando claro que ainda nao substitui a apuracao contabil por unidade vendida.
- A visao separa resultado por POC e caixa realizado: POC usa vendas contratadas multiplicadas pelo avanco da obra, cancelamentos, custos e despesas; caixa usa recebimentos efetivos menos pagamentos efetivos.
- O avanco da obra e estimado pelos contratos de fornecimento salvos, usando valor medido sobre valor contratado quando esses campos existem.
- A tela mostra se o resultado POC estimado foi lucro ou prejuizo no ano escolhido e exibe margem POC estimada como indicador proprio.
- A DRE avisa quando nao ha contratos de fornecimento medidos suficientes para reconhecer receita por avanco de obra.
- Vendas sem vinculo com obra/contrato ficam fora da Receita POC e aparecem como item a revisar.
- A tela mostra a base usada no POC: valor contratado, valor medido, contratos com medicao e ranking de avanco por obra.
- O seletor anual usa somente anos com vendas ou contratos salvos; link antigo para ano sem base ajusta para o exercicio valido mais recente, informando o usuario.
- A tela apresenta cards executivos, graficos mensais, ranking de custos por fornecedor, ranking de vendas por empreendimento e tabela mes a mes.
- Os saldos a receber e a pagar sao acumulados ate o fim do exercicio selecionado, nao apenas movimentos do ano.
- A DRE nao carrega compras na abertura, porque compras nao entram no calculo exibido; custos e despesas vem de contas a pagar.
- A tela exibe resumo de integracao por area usada na DRE, indicando registros salvos e data de integracao quando disponivel.
- A metodologia informa que, sem historico mensal de medicoes e sem apropriacao por unidade vendida, a receita POC e uma estimativa anual baseada na ultima medicao salva.

## Estoque, patrimonio e unidades imobiliarias

- Foi criado portal de estoque combinando unidades imobiliarias, bens moveis e bens imoveis, lendo dados salvos em `inventory-assets.sqlite`.
- Fontes usadas: `/v1/units`, `/v1/patrimony/movable`, `/v1/patrimony/fixed`, `/v1/price-tables`, `/v1/real-estate-map`, `/v1/stock-reservations` e `/v1/stock-inventories/{costCenterId}/items`.
- O portal prioriza uma visao estrategica antes da lista: estoque precificado, unidades disponiveis para venda, reservas/propostas, itens sem valor informado, propriedade propria/terceiro, mapa imobiliario e insumos quando integrados.
- Cards, graficos e rankings principais consideram a carteira comercial ativa; vendidos, locados, transferidos e terceiros aparecem na listagem ao trocar o filtro para "Historico completo".
- A lista tem filtro para separar itens com valor informado e sem valor informado; valores zerados sao tratados como ausencia de valor quando nao existe incorporacao, valor contabil, avaliacao, tabela especial, fracao de VGV ou terreno.
- A classificacao proprio/terceiro usa proprietario anterior, origem contabil, indicador de uso e estoque comercial quando esses campos vem do Sienge.
- Mapa imobiliario e insumos por centro de custo dependem do campo `Centros de custo para estoque avancado` em Configuracoes.
- A tela considera datas de entrada, valores e origem quando a API retorna esses campos, mostrando a data de entrada na listagem.

## Conciliacao

- Foi criado portal de conciliacao usando movimentos bancarios e extratos/contas quando disponiveis na API.
- A tela abre lendo apenas o SQLite local (`finance-reconciliation.sqlite`, espelho de `/bulk-data/v1/bank-movement`); consulta ao Sienge fica restrita a atualizacao em Configuracoes.
- A primeira leitura local e renderizada no servidor a partir do SQLite, sem carregamento client-side na abertura; o painel de progresso ficou restrito ao botao `Recarregar dados salvos`, mostrando etapas reais (pendente, em andamento, concluido) em vez de apenas porcentagem.
- A proposta do portal e acompanhar o que ja esta conciliado, o que esta em aberto e o que precisa de revisao.
- A listagem mostra movimento, data, valor, conta, status, vinculo, historico e data de integracao.
- A visao mensal abre no mes mais recente, mostra conciliados, a conciliar, vinculados e avulsos do periodo, e filtra a lista pelo mes selecionado, com barra mensal clicavel comparando percentual e volumes por mes.
- Em Configuracoes e possivel escolher uma ou varias contas bancarias para o portal, usando um modal com checkboxes; a visao mensal, os cards e a lista respeitam as contas selecionadas.

## Compras

- Foi criado portal de compras lendo o banco `purchases.sqlite`, com os registros espelhados de pedidos, notas, solicitacoes e cotacoes.
- A tela abre lendo apenas o SQLite local; a atualizacao (inclusive forcada) fica em Configuracoes.
- A visao principal mostra pendencias, o que foi comprado, solicitacoes, pedidos, valores por periodo e andamento por etapa, com recortes de ultimos 12 meses, ultimos 6 meses, mes anterior e futuro.
- Os registros detalhados ficam em aba separada, que pagina/filtra toda a base local por `/api/purchases/records`, mantendo apenas os campos exibidos e os metadados de integracao.
- Fontes usadas: pedidos de compra, notas/faturas de compra, itens de solicitacoes e cotacoes de compra.
- O fluxo operacional de cotacao com fornecedores fica nas telas dedicadas `/solicitacoes-compra`, `/cotacoes` e no portal publico do fornecedor (ver secao propria).

## Componentes e estrutura

- A estrutura do frontend esta organizada em `app`, `components`, `features` e `lib`, com `middleware.ts` na raiz para o controle de acesso.
- Foram criados componentes reutilizaveis para cards de indicadores, cabecalho de pagina, aviso de erro de API, graficos (pizza, linha, barras/ranking e fluxo), tabelas e exploradores de registros.
- O componente padrao `LocalDataList` cuida das listas de dados salvos com paginacao inicial de 100 registros, troca de quantidade e exportacao CSV opcional; e usado em compras, conciliacao, estoque, vendas, buscas avancadas e tabela financeira generica.
- A camada `lib/api` centraliza chamadas ao Sienge, espelho local e persistencia.
- `lib/supplier-quote-portal.ts` concentra tokens, respostas, convites, aprovacoes e eventos do portal do fornecedor; `lib/rate-limit.ts` concentra o limite de requisicoes das rotas publicas.
- `features/quotations` e `features/suppliers` concentram as leituras locais de cotacoes e fornecedores; `features/reports/data.ts` concentra resumos leves de relatorios.
- `components/purchases/quotations` concentra os blocos da tela `/cotacoes`; `components/purchases/quotation-detail/tabs` concentra as abas do detalhe da cotação.
- As listas principais exibem `Integrado em ...` por registro, padronizado no componente `IntegrationStamp`; a formatacao de datas opcionais esta centralizada em `formatOptionalDate`.
- Separadores especiais foram trocados por hifen simples para evitar caracteres quebrados em Windows/terminal.
- As telas `/compras`, `/contas-receber` e `/sales` foram otimizadas para reduzir o HTML inicial enviado pelo Next.js: em medicao local, `/compras` caiu de ~9,5 MB para 253 KB, `/contas-receber` de ~6,9 MB para 232 KB e `/sales` de ~1 MB para 255 KB, mantendo cards e graficos calculados com todos os dados do SQLite.
- Textos visiveis fora de Configuracoes foram revisados: acentos corrigidos, mensagens claras e termos tecnicos (banco local, SQLite, endpoint, bulk) fora da leitura principal.

## Mapa Sienge

- Foi criada a rota `/sienge` como auditoria de cobertura operacional do Sienge dentro do sistema.
- A abertura le somente os bancos locais e nao consulta o Sienge.
- A visao mostra modulos em uso, parciais, preparados e nao usados; fontes/endpoints mapeados; registros locais por fonte; ultima integracao detectada; telas onde cada modulo e usado; melhor uso operacional; lacunas e proximos passos.
- O Mapa Sienge e o historico de integracao por portal reconhecem as fontes de estoque e os contratos de fornecimento pelos endpoints atuais.
- A tela ajuda a decidir quais integracoes precisam ser completadas para aproveitar melhor o Sienge.

## Validacoes recentes

- Em 05/07/2026, a revisão das conexões Sienge de cotações passou em `tsc --noEmit --incremental false` e atualizou a documentação técnica (`lib/api/README.md`) com endpoints, telas envolvidas e pontos de atenção.
- TypeScript passou com `tsc --noEmit` e a build passou com `next build` apos as mudancas de autenticacao, cotacoes, seguranca, portal do fornecedor e separacao dos componentes de abas/blocos de cotacao.
- O fluxo do portal do fornecedor foi testado de ponta a ponta: link ativo abre o portal, link revogado retorna 404 no portal e 401 no envio de proposta.
- Os limites de requisicao foram testados: a consulta publica bloqueia com 429 apos o limite por IP, e o login bloqueia forca bruta mesmo com IP forjado diferente a cada tentativa.
- O aviso de SQLite experimental do Node pode aparecer, mas nao impede a build.
- O erro antigo do Next `Cannot find module './948.js'` esta relacionado a cache/build local quebrado da pasta `.next`; essa pasta esta ignorada no Git.

## Pontos de atencao

- A API do Sienge ainda pode bloquear chamadas por limite de uso, principalmente em consultas bulk.
- Atualizacoes amplas devem ser feitas com cuidado em Configuracoes, porque consultam o Sienge e podem atingir limites da API.
- Algumas telas dependem dos campos que o Sienge realmente retorna para a empresa; quando o campo nao vem na resposta, a tela mostra vazio ou "nao informado".
- O limite de requisicoes das rotas publicas e em memoria, por processo: zera a cada reinicio e nao e compartilhado entre instancias. Suficiente para o app rodando em um unico processo; multiplas instancias exigiriam armazenamento compartilhado.
- O token bruto dos links de fornecedor fica salvo na tabela de convites para permitir o botao Copiar; quem tiver acesso ao arquivo SQLite tem links validos. A revogacao mitiga, mas remover o token bruto e uma melhoria futura.
- Se o sistema for exposto fora da rede local, e preciso colocar um proxy com TLS confiavel na frente; so entao o cabecalho `x-forwarded-for` passa a ser confiavel para o limite por IP.
- Cada link de fornecedor aceita apenas uma resposta; revisões devem usar novo link. Excluir uma resposta é uma ação administrativa destrutiva e remove aprovações vinculadas àquela resposta.
- O contrato oficial do Sienge para insumo direto em cotações deve ser revisado quando houver mudança de versão da API, principalmente nos nomes dos campos de apropriação de obra.

## Configuracoes

- Foi criada a tela `/configuracoes` em um menu separado, funcionando como central de dados do sistema.
- A area principal mostra o estado do espelho local, ultima integracao e botoes de atualizacao por area, cada uma com acao de atualizar normal e atualizar com forca.
- A atualizacao normal preserva dados pagos, baixados ou finalizados quando identificados; a com forca pode substituir tambem registros finalizados.
- A tela permite parametrizar: nome, funcao e iniciais exibidos no topo; quantidade de meses nos graficos do dashboard; data inicial e final usadas nas atualizacoes do Sienge; quantidade de meses futuros na agenda de contas a pagar; centros de custo para estoque avancado; contas bancarias da conciliacao; e exibicao de avisos de atualizacao.
- As configuracoes ficam salvas em SQLite local, no arquivo `app-settings.sqlite`.
- Os botoes de atualizacao iniciam um job em segundo plano, liberando a tela imediatamente; o andamento fica visivel por etapas (pendente, em andamento, concluido ou erro), e os cartoes de status atualizam automaticamente quando o job termina.
- O sistema permite apenas uma carga do Sienge por vez para reduzir risco de limite de API e travas no banco local.
- O runner de atualizacao trata falhas em subcargas em lote como erro real da etapa, evitando status de sucesso quando parte da carga falhou.
- A contagem de `Areas prontas` considera somente areas atualizaveis pelos botoes da tela.
- As atualizacoes de contas a pagar, contas a receber, conciliacao e cotacoes de compras usam o periodo de integracao escolhido quando o endpoint aceita data.
- Cada chamada real ao Sienge grava um historico resumido em SQLite com endpoint, area responsavel, dia, status e horario.
- A tela mostra a ultima atualizacao por portal e o tamanho dos bancos SQLite locais.
- A tela tambem concentra a importacao de dump do Sienge (ver secao "Dump oficial do Sienge").
