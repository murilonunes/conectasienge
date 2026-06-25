# Status do projeto Brasin

Atualizado em: 23/06/2026

Este arquivo resume o que foi feito neste chat e ainda esta valendo no codigo. A ideia e manter este documento atualizado sempre que uma tela, consulta, banco local ou comportamento importante mudar.

## Atualização mais recente

- A revisão de `/estoque` foi concluída.
- O portal de estoque virou uma visão estratégica: mostra estoque precificado, unidades disponíveis para venda, reservas/propostas, itens sem valor informado, propriedade própria/terceiro, mapa imobiliário e insumos quando esses dados estiverem integrados.
- A integração de Estoque e patrimônio passou a incluir novas fontes oficiais do Sienge: tabelas de preço, mapa imobiliário consolidado, reservas de insumos e insumos em estoque por centro de custo.
- Configurações ganhou o campo `Centros de custo para estoque avançado`, usado pelas consultas que exigem centro de custo.
- A lista de estoque ganhou filtro para separar itens com valor informado e sem valor informado.
- O Mapa Sienge e o histórico de integração por portal passaram a reconhecer as novas fontes de estoque.
- A Etapa 6 da revisão foi concluída para análise gerencial.
- `/relatorios` deixou de montar a DRE completa e a lista completa de contratos na abertura; agora usa resumos locais leves e abre o relatório detalhado somente quando o usuário entra no portal correspondente.
- Foi criado `features/reports/data.ts` para concentrar resumos leves de relatórios, como contratos e base disponível da DRE.
- `/dre-gerencial` deixou de carregar compras, porque esses dados não eram usados no cálculo da DRE POC.
- A DRE POC passou a exibir margem POC estimada e ajustou os cards de saldos para indicar que são valores acumulados até o fim do exercício selecionado.
- `/dashboard` foi revisado contra o padrão atual e permanece lendo resumos locais por período, separando passado, futuro, previsto, realizado e pendente.
- `/sienge` foi revisado como mapa de cobertura operacional local, mantendo detalhes de fontes por ser uma tela de auditoria do uso do Sienge.
- A Etapa 5 da revisão foi concluída para o financeiro operacional.
- `/contas-pagar` deixou de exibir atalho direto para `Novo lançamento`, mantendo a tela como agenda e consulta local.
- `/lancamentos/baixa` deixou de fazer PATCH de instrução Pix no Sienge; agora é somente conferência de parcelas, baixas registradas e cobranças abusivas.
- A rota backend de Pix em `/api/sienge/bills/[billId]/installments/[installmentId]/payment-information/pix` foi removida.
- `/lancamentos/baixa-receber` foi reforçada como consulta de recebimentos, sem promessa de baixa efetiva pela API.
- `/lancamentos/novo` foi mantida como exceção transacional explícita, com aviso visível antes do formulário.
- A Etapa 4 da revisão foi concluída para `/conciliacao`.
- O Portal de conciliação deixou de iniciar carregamento client-side ao abrir; a primeira leitura local agora é renderizada no servidor a partir do SQLite.
- O painel de progresso da conciliação ficou restrito ao botão `Recarregar dados salvos`, mantendo a abertura normal mais direta.
- A Etapa 3 da revisão foi concluída para `/contratos` e `/configuracoes`.
- A contagem de `Áreas prontas` em Configurações passou a considerar somente áreas atualizáveis pelos botões da tela.
- O runner de atualização agora trata falhas em subcargas em lote como erro real da etapa, evitando status de sucesso quando parte da carga falhou.
- A etapa de revisão de listas grandes foi concluída para `/compras`, `/contas-receber` e `/sales`.
- A aba Registros de `/compras` deixou de receber só 500 itens e passou a paginar/filtrar toda a base local por `/api/purchases/records`.
- A listagem principal de `/contas-receber` deixou de receber só 200 parcelas e passou a paginar/filtrar toda a base local por `/api/receivables/forecast`.
- `/sales` foi revisada quanto a período, permutas e volume exibido; não recebeu ajuste nesta etapa porque já usa contratos enxutos e paginação no recorte.
- A primeira etapa da revisão de telas foi iniciada e documentada: `/`, menu lateral e `/financeiro` foram revisados.
- A Central financeira deixou de exibir atalho direto para `Novo lançamento`; essa operação permanece contextualizada em Contas a pagar e será revisada como operação transacional.
- Foi criado o arquivo `revisão.md` para acompanhar a revisão tela por tela, com critérios, prioridades, achados transversais e plano por etapas.
- A atualização em Configurações passou a marcar a etapa como erro quando uma área retorna falha de carga, em vez de exibir conclusão sem dados gravados.
- Os cartões de status da tela de Configurações são atualizados automaticamente quando o job em segundo plano termina.
- O menu lateral foi simplificado: `Início` saiu da lista e o logo/nome Brasin passou a ser o atalho para a tela inicial.
- `Novo lançamento` saiu do menu lateral de operações e passou a ficar como botão dentro da tela `/contas-pagar`.
- A rota `/contratos` passou a tratar ausência de `contracts-supply.sqlite` como dado local ainda não salvo, sem exibir detalhes técnicos de API na abertura.
- A abertura de `/contratos` continua lendo somente o SQLite local; a consulta ao Sienge fica restrita à atualização feita em Configurações.
- A rota `/contratos` foi corrigida para carregar contratos de fornecimento pelo endpoint de listagem `/v1/supply-contracts/all`, com período definido em Configurações.
- A DRE POC, o Mapa Sienge e o histórico de integração passaram a usar o mesmo endpoint de contratos de fornecimento, evitando leitura vazia por endpoint incorreto.
- A rota `/sales` ganhou seletor de período no mesmo padrão visual do Dashboard, com Hoje, 7, 15, 30, 60, 90 dias, 6, 12 e 24 meses, além de visão passada ou futura.
- Cards, gráfico mensal, ranking, situação dos contratos e listagem de `/sales` agora respeitam o recorte selecionado.
- O padrão inicial de `/sales` ficou em 12 meses passados para manter a abertura comercial útil, sem perder a troca rápida de período na própria tela.
- A listagem enxuta de `/sales` passou a preservar `conditionTypeId`, `totalValue` e `totalValueInterest`, garantindo que permutas continuem sendo identificadas corretamente no detalhe.
- A rota `/sales` foi revisada para separar valor bruto contratado, permutas e carteira líquida comercial.
- Condições de pagamento do tipo `PE` ou com nome de permuta deixam de inflar os indicadores comerciais, evitando contar duas vezes bens dados em outros negócios.
- Os cards, gráfico mensal, ranking por empreendimento/situação e listagem de contratos de vendas agora usam valor líquido comercial; o detalhe do contrato mostra bruto, permuta abatida e valor líquido para conferência.
- A busca/listagem de `/sales` passou a receber todos os contratos locais enxutos, com paginação na tela, em vez de filtrar apenas uma amostra inicial.
- Foi criada a tela `/lancamentos/baixa-receber` para consultar recebimentos e baixas de contas a receber.
- A especificação pública disponível foi revisada e não foi encontrado endpoint seguro para efetivar baixa de contas a receber; a tela informa essa limitação e não promete uma operação que não seria gravada.
- A nova tela lê somente o banco local `finance-receivables.sqlite`, usando as tabelas estruturadas de parcelas e recebimentos do espelho `/bulk-data/v1/income`.
- A busca avançada de contas a receber permite consultar por vencimento, emissão, competência ou data de recebimento, filtrando por situação do recebimento, empresa, projeto, área de negócio e cliente.
- Nas buscas avançadas de contas a pagar e contas a receber, pesquisar com `#385` filtra exatamente o título 385.
- A listagem de recebimentos passou a mostrar o vencimento diretamente na linha principal, sem precisar expandir o detalhe, mantendo a data de integração dentro do detalhe expandido para não pesar o layout.
- Na listagem de recebimentos, título, parcela e vencimento aparecem conectados lado a lado para facilitar conferência; o número do título copia pelo próprio botão compacto e o vencimento fica colorido em verde claro quando recebido, vermelho quando vencido e branco quando ainda não venceu.
- A consulta por código do título a receber mostra parcelas, saldo, recebimentos registrados, movimentos vinculados, cliente, projeto e data de integração.
- A tela foi adicionada ao menu de Operações, à Central financeira e como ação da tela de Contas a receber.
- As telas `/compras`, `/contas-receber` e `/sales` foram otimizadas para reduzir o HTML inicial enviado pelo Next.js.
- Os cards, gráficos e indicadores continuam sendo calculados com todos os dados salvos no SQLite local.
- As listagens client-side dessas telas passam a receber apenas uma amostra inicial para consulta rápida, mostrando ao usuário quantos registros existem no total.
- Em compras, o registro bruto completo da API deixou de ser enviado para a aba de registros; a tela mantém apenas os campos exibidos e os metadados de integração.
- Em contas a receber e vendas, os registros enviados para as listas foram reduzidos aos campos efetivamente exibidos, preservando data de integração.
- A medição em build local reduziu `/compras` de cerca de 9,5 MB para 253 KB, `/contas-receber` de cerca de 6,9 MB para 232 KB e `/sales` de cerca de 1 MB para 255 KB.
- Foi criada a rota `/sienge` como um dashboard de cobertura operacional do Sienge.
- O Mapa Sienge mostra quais módulos operacionais já são usados pelo sistema, quais têm dados salvos localmente, quais estão parciais e quais ainda não são usados.
- A tela apresenta módulos como contas a pagar, contas a receber, caixa/bancos, vendas, contratos, compras, estoque, cadastros e operações de escrita.
- Cada módulo mostra endpoints/fontes, registros locais, última integração, telas que usam os dados, pontos fortes, lacunas e próximo passo recomendado.
- O Mapa Sienge foi incluído no menu de Análise e na tela inicial.
- Foi criada a tela `/dre-gerencial` para mostrar uma DRE POC estimada baseada nos dados já salvos localmente.
- A DRE POC separa resultado por avanço da obra de caixa realizado, para indicar lucro/prejuízo operacional sem confundir com entrada e saída de dinheiro.
- A tela mostra vendas contratadas, receita POC, cancelamentos POC, custos/despesas, resultado POC, POC médio, recebido, pago, caixa realizado e saldos acumulados a receber/a pagar por exercício anual.
- O seletor anual da DRE POC passou a usar somente anos com vendas ou contratos salvos, evitando resultado artificial com receita POC zerada e custos de anos sem base comercial.
- Foram adicionados gráficos de receita x custos, recebido x pago, evolução mensal do resultado, rankings por fornecedor e por empreendimento, além de tabela mensal.
- A DRE POC estimada foi incluída no menu de Análise, na tela inicial e na Central de relatórios.
- Contas a pagar passou a exibir valor corrigido e multa/juros pagos a mais nas visões de agenda, busca avançada e consulta de parcelas por título.
- Foi criado um botão de análise de cobrança que abre um modal para detectar possíveis cobranças acima do critério de 2% no ato mais 1% ao mês.
- A análise de cobrança usa os dados salvos no banco local e serve como triagem operacional para revisão.
- A busca avançada de contas a pagar ganhou filtro para exibir somente possíveis cobranças abusivas, usando a mesma regra do modal.
- Foi adicionado um dashboard em modal para cobranças abusivas, agrupado por credor, com ranking dos 10 maiores por percentual/valor e lista completa paginada ordenada pela soma do possível excesso.
- A atualização dos dados do Sienge em `/configuracoes` deixou de bloquear a tela até o fim da carga.
- Foi criada uma rota local de jobs para iniciar a atualização em segundo plano e consultar o andamento.
- A tela de Configurações agora mostra a atualização ativa por etapas, com status pendente, em andamento, concluído ou erro.
- Apenas uma atualização roda por vez para evitar disputa no SQLite e excesso de chamadas simultâneas ao Sienge.
- A rota `/relatorios` também pode iniciar a atualização dos dados usados nos relatórios em segundo plano, sem travar a tela.
- A rota `/relatorios` foi transformada em uma central de relatórios geráveis, separando seu propósito do Dashboard.
- A Central de relatórios agora apresenta cartões para financeiro por período, contas a pagar, contas a receber, compras, vendas, contratos e estoque.
- Cada relatório mostra escopo, métricas rápidas, botão para abrir a tela detalhada e indicação de exportação PDF/Excel como próxima etapa.
- A tela continua lendo somente dados salvos e não consulta o Sienge na abertura.
- Foi feita uma revisão dos textos visíveis fora da tela de Configurações.
- Textos sem acento, mensagens com encoding quebrado e rótulos técnicos em telas de usuário foram padronizados.
- Mensagens de erro, carregamento e detalhes passaram a usar linguagem mais clara para o usuário, deixando termos como banco local, SQLite, endpoint e bulk fora da leitura principal.
- A tela de Configurações também foi revisada, com acentos corrigidos e textos ajustados para falar em dados salvos, integração e arquivos de dados em vez de termos técnicos demais.
- Foi criado um componente padrão de listagem com paginação para dados salvos, abrindo com 100 registros por página e opção de trocar a quantidade exibida.
- O padrão de paginação foi aplicado em compras, conciliação, estoque, vendas, busca avançada de contas a pagar, contas a receber e tabela financeira genérica.
- A rota `/financeiro` deixou de ser uma tela antiga de listagem financeira e passou a ser uma Central financeira leve, com atalhos para Dashboard, Contas a pagar, Contas a receber, Conciliação, Lançamento, Baixa e Configurações.
- O componente financeiro legado que alimentava essa tela antiga foi removido para evitar duplicidade de propósito.
- A rota `/contratos` foi atualizada para o novo padrão, lendo contratos de fornecimento dos dados salvos, com cards, ranking por situação, paginação e atualização pela tela de Configurações.
- A rota `/relatorios` funciona como central de relatórios geráveis, lendo somente dados salvos e apontando para os portais detalhados.

- A revisão tela a tela corrigiu Vendas e Estoque para abrirem lendo somente o SQLite local; a API do Sienge fica restrita às atualizações iniciadas em Configurações.
- Os detalhes de erro visíveis foram suavizados para falar em origem da informação, mantendo os dados de suporte sem expor a tela como uma falha técnica crua.

## Estado geral

- O projeto principal esta em `frontend`, usando Next.js 14, React 18 e TypeScript.
- As credenciais do Sienge ficam em `.env` para uso local. Esse arquivo nao entra no Git.
- Os dados consultados no Sienge agora sao gravados em SQLite local como um espelho da API.
- Bancos locais, `.env`, `node_modules`, builds e arquivos temporarios estao ignorados no Git.
- O histórico de etapas concluídas fica registrado em commits pequenos e descritivos no Git.

## Padrao atual do projeto

- Telas comuns nao devem consultar o Sienge ao abrir.
- Toda tela operacional deve ler os dados salvos no SQLite local.
- A consulta ao Sienge deve ficar concentrada em `/configuracoes`, nos botoes de atualizacao.
- Quando uma tela nao encontrar dado local, deve orientar o usuario a atualizar a area em Configuracoes.
- Atualizacao normal deve preservar dados pagos, baixados, recebidos, cancelados ou finalizados quando forem identificados.
- Atualizacao com forca pode substituir tambem dados finalizados.
- Toda lista exibida ao usuario deve mostrar a data de integracao com o Sienge quando o registro tiver essa informacao.
- Listas grandes devem usar o componente padrao de listagem local com paginacao inicial de 100 registros e opcao de troca.
- Textos visiveis fora de Configuracoes devem ser comerciais e claros, evitando termos tecnicos como endpoint, bulk, SQLite e detalhes internos.
- Configuracoes pode concentrar linguagem mais administrativa, historico de integracao, periodo de atualizacao, tamanho dos bancos e acoes de carga.
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
- Cada banco de responsabilidade possui tabela de espelho da API e historico de integracao.
- As respostas da API sao armazenadas em tabelas mantendo o padrao dos dados retornados, com chave de registro para evitar repeticao sempre que possivel.
- As consultas bulk devem usar o maior periodo util possivel e gravar o resultado localmente, para manter um banco paralelo consultavel.
- Ao atualizar dados comuns, registros que parecem pagos, baixados, recebidos, cancelados ou finalizados sao preservados.
- A opcao "atualizar com forca" em Configuracoes permite substituir tambem dados finalizados.

## Dashboard inicial

- A rota `/` nao abre mais o dashboard automaticamente.
- A rota `/` agora e uma tela de boas-vindas leve, sem consulta ao Sienge e sem carregamento pesado de dados.
- O menu tem um item `Inicio` para voltar rapidamente para essa tela de abertura.
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
- Na visao futura, os blocos de previsao de recebimento e previsao de pagamento ocupam a largura total em duas colunas.
- Na visao futura, foram adicionadas listas lado a lado de recebiveis por cliente, pagamentos por fornecedor e pagamentos por obra/empresa.
- Na visao futura, o fluxo futuro ocupa a largura total, recebiveis por cliente e pagamentos por fornecedor ficam lado a lado, e pagamentos por obra/empresa fecha em largura total.
- Na visao passada, entradas x saidas e vendas por mes ocupam a largura total, enquanto compras e pedidos de compra ficam lado a lado.
- O seletor de visao do dashboard foi compactado para mostrar apenas modo, periodo e datas, com botoes de periodo em uma barra horizontal.
- O card de contas a pagar em aberto passou a excluir parcelas que ja possuem baixa registrada no SQLite.
- O dashboard agora monta seus indicadores por consultas resumidas diretas no SQLite local, sem carregar os portais completos de contas, vendas, estoque e compras por tras da tela.
- A configuracao antiga de dashboard em meses foi neutralizada para nao abrir 90 dias por engano quando ainda nao existir a nova configuracao em dias.
- O grafico de entradas x saidas foi ajustado para casar entradas e saidas no mesmo calendario de 7 dias, em vez de listar primeiro todas as entradas e depois todas as saidas.
- O grafico de entradas x saidas usa agrupamento diario ate 30 dias, semanal em 60 e 90 dias, e mensal em periodos acima disso.
- O grafico de pedidos de compra do dashboard usa o mesmo agrupamento: diario em periodos curtos, semanal em 60/90 dias e mensal em periodos maiores.
- O grafico de vendas por mes passou a usar o agrupamento do periodo selecionado e exibir tambem a quantidade de vendas em cada coluna.
- O bloco de unidades por situacao no dashboard passou a ser um grafico de pizza com percentual e quantidade por situacao comercial.
- A pizza de unidades por situacao foi compactada com legenda em duas colunas abaixo do grafico, e os rotulos mensais de pedidos de compra passaram a quebrar mes e ano em linhas separadas.
- O resumo de compras por periodo no dashboard foi padronizado para mostrar Total comprado, Pendentes, Concluidos e Atrasados, sempre com valor e contagens coerentes do proprio recorte.
- A revisao card a card do dashboard padronizou os rankings para mostrar unidades corretas, como parcelas em contas e contratos em vendas.
- Na visao passada, o grafico de entradas x saidas passou a usar recebimentos e pagamentos realizados por data de baixa/pagamento; na visao futura, continua usando previsao por vencimento.
- A tela de Configuracoes continua guardando preferencias gerais, mas a troca rapida do periodo do dashboard fica disponivel no proprio dashboard.
- O dashboard agora tem uma tela de carregamento propria, mostrando que a visao geral esta sendo atualizada a partir do banco local.
- Foram adicionados cards de resumo para:
  - contas a receber
  - contas a receber em atraso
  - contas a pagar
  - contas a pagar em atraso
  - saldo previsto do periodo
  - saldo realizado do periodo
  - vendas
  - compras pendentes
- Foram adicionados graficos de:
  - entradas x saidas
  - compras feitas x pendentes
  - vendas por mes
  - pedidos de compra por mes
  - unidades por situacao comercial
  - recebiveis por cliente
  - compras por periodo
  - vendas por empreendimento
- Se alguma area falhar, o dashboard exibe visao parcial e continua mostrando os modulos que carregaram.

## Contas a pagar

- Foi criado portal de contas a pagar com visao do que esta programado para:
  - hoje
  - semana
  - mes atual
  - proximos meses configurados
- A tela de contas a pagar foi revisada para abrir lendo apenas o SQLite local; consulta ao Sienge fica restrita a atualizacao em Configuracoes.
- A agenda de contas a pagar passou a ler a tabela local `bulk_outcome_installments`, respeitando saldo em aberto, vencimento e metadados de integracao.
- A listagem da agenda foi padronizada para mostrar fornecedor, empresa, documento, titulo/parcela, autorizacao e data de integracao sem campos `undefined`.
- A busca avancada de contas a pagar consulta tambem parcelas nao baixadas, nao apenas baixas.
- A busca avancada de contas a pagar passou a consultar diretamente as tabelas estruturadas do SQLite, com filtros por data, empresa, obra e baixa aplicados no banco local.
- Foram adicionados indices locais para acelerar consultas por vencimento, emissao, competencia, pagamento, empresa e obra.
- A consulta de parcelas de um titulo na tela de baixa tambem passou a ler o SQLite local, sem depender dos endpoints REST de detalhe do titulo.
- A tela mostra mais informacoes da parcela, como vencimento, forma, envio ao banco e situacao.
- A tela mostra valor original, valor corrigido, acréscimo corrigido e multa/juros pagos a mais quando esses dados existem no espelho local.
- Foi adicionado um modal de análise de cobrança para comparar acréscimos contra o critério de 2% no ato mais 1% ao mês.
- O numero do titulo foi aumentado visualmente no resultado.
- Foi incluido botao para copiar o numero do titulo.
- O CNPJ aparece no resultado quando disponivel.
- A busca por CNPJ e feita somente sobre o resultado ja carregado, para evitar varias chamadas extras ao Sienge.
- A tela informa melhor erros de autorizacao, permissao e limite de consultas.
- Quando ocorre limite de consultas, a mensagem diferencia limite em consulta REST ou bulk quando essa informacao esta disponivel.

## Lancamento e baixa

- Foi criada tela de lancamento de titulo.
- Foi criada tela de baixa/consulta de baixa.
- A baixa efetiva pela API publica permanece bloqueada quando nao existe endpoint publico seguro para registrar a operacao.
- A tela evita prometer uma operacao que nao seria realmente gravada no Sienge.
- A consulta de informacoes de pagamento continua sendo usada quando a API permite leitura.
- Foi criada uma tela separada de baixa a receber, em `/lancamentos/baixa-receber`.
- A tela de baixa a receber consulta parcelas e recebimentos já registrados no banco local, mas mantém a efetivação da baixa bloqueada porque a especificação pública disponível não expõe endpoint de gravação para essa operação.

## Contas a receber

- A previsao de recebimentos foi ajustada para nao depender de selecionar um cliente manualmente.
- A previsao usa dados bulk de recebiveis quando disponiveis.
- A tela tem foco em responder o que deve entrar de dinheiro, em vez de exigir cadastro de cliente antes de abrir.
- A tela de contas a receber foi revisada para abrir lendo apenas o SQLite local; consulta ao Sienge fica restrita a atualizacao em Configuracoes.
- A previsao passou a ler a tabela local `bulk_income_installments`, considerando saldo corrigido, saldo em aberto ou valor original quando necessario.
- Os rankings e graficos foram padronizados para usar "parcela" como unidade, e a listagem mostra titulo, cliente, vencimento, projeto/unidade, valor em aberto, recebido, situacao e data de integracao.

## Portal comercial / vendas

- Foi criado o portal `/sales`.
- O portal le contratos de vendas do Sienge.
- A listagem foi ajustada para exibir por ordem de venda.
- Foi criado grafico de vendas por mes.
- Os contratos carregados entram no banco local para evitar consultas repetidas.
- A abertura do portal passou a ler os contratos de venda salvos em `commercial-sales.sqlite`, sem consultar o Sienge automaticamente.

## Contratos de fornecimento

- A tela `/contratos` deixou de ser placeholder e passou a exibir contratos de fornecimento.
- A abertura da tela lê os dados salvos de `/v1/supply-contracts`.
- A atualização dos contratos foi incluída em Configurações, junto das demais áreas.
- A tela mostra valor contratado, saldo estimado, contratos ativos, fornecedores, ranking por situação e listagem paginada.

## Relatórios

- A tela `/relatorios` deixou de concorrer visualmente com o Dashboard.
- A abertura da tela lê somente os dados salvos no banco local, sem consultar o Sienge.
- A central permite escolher o período padrão e a visão de passado/futuro para orientar os relatórios.
- A tela funciona como catálogo de relatórios gerenciais: financeiro por período, contas a pagar, contas a receber, compras, vendas, contratos e estoque.
- Cada relatório mostra escopo, métricas rápidas e botão para abrir o portal detalhado correspondente.
- A exportação PDF/Excel ficou sinalizada como próxima etapa, sem prometer geração antes de implementar a rotina.
- A Central de relatórios possui um painel para atualizar em segundo plano os dados que alimentam os relatórios.
- A atualização "Todos os relatórios" carrega financeiro, contas a receber, vendas, contratos, estoque e compras sem puxar conciliação junto.
- A Central de relatórios passou a incluir o relatório de DRE POC estimada, com atalho para análise de lucro/prejuízo e caixa realizado.
- A Central de relatórios não monta mais a DRE completa nem a listagem completa de contratos ao abrir; ela usa resumos locais leves e delega o relatório completo para cada tela.

## DRE POC estimada

- Foi criada a rota `/dre-gerencial`.
- A tela lê somente os dados salvos nos bancos locais e não consulta o Sienge na abertura.
- A tela foi renomeada visualmente para DRE POC estimada, deixando claro que ainda não substitui a apuração contábil por unidade vendida.
- A visão separa resultado por POC e caixa realizado:
  - POC: vendas contratadas multiplicadas pelo avanço da obra, cancelamentos, custos e despesas lançados
  - caixa: recebimentos efetivos menos pagamentos efetivos
- O avanço da obra é estimado pelos contratos de fornecimento salvos, usando valor medido sobre valor contratado quando esses campos existem.
- A tela mostra se o resultado POC estimado foi lucro ou prejuízo no ano escolhido.
- A DRE POC agora avisa quando não há contratos de fornecimento medidos suficientes para reconhecer receita por avanço de obra.
- Vendas sem vínculo com obra/contrato ficam fora da Receita POC e aparecem como item a revisar, evitando transformar venda contratada em receita indevida.
- A tela passou a mostrar a base usada no POC: valor contratado, valor medido, contratos com medição e ranking de avanço por obra.
- A tela possui seletor anual, usando somente anos com vendas ou contratos salvos localmente.
- Quando um link antigo aponta para um ano sem base comercial/contratual, a tela ajusta para o exercício válido mais recente e informa isso ao usuário.
- A tela apresenta cards executivos, gráficos mensais, ranking de custos por fornecedor, ranking de vendas por empreendimento e tabela mês a mês.
- A tela exibe resumo de integração por área usada na DRE, indicando registros salvos e data de integração quando disponível.
- A metodologia informa que, sem histórico mensal de medições e sem apropriação por unidade vendida, a receita POC é uma estimativa anual baseada na última medição salva.
- A DRE deixou de carregar compras na abertura, porque compras não entram diretamente no cálculo exibido; custos e despesas continuam vindo de contas a pagar.
- Os saldos a receber e a pagar foram renomeados para deixar claro que são acumulados até o fim do exercício selecionado, não apenas movimentos do ano.
- A tela passou a exibir margem POC estimada como indicador próprio.

## Estoque, patrimonio e unidades imobiliarias

- Foi criado portal de estoque.
- O portal combina:
  - unidades imobiliarias
  - bens moveis
  - bens imoveis
- As fontes usadas sao:
  - `/v1/units`
  - `/v1/patrimony/movable`
  - `/v1/patrimony/fixed`
  - `/v1/price-tables`
  - `/v1/real-estate-map`
  - `/v1/stock-reservations`
  - `/v1/stock-inventories/{costCenterId}/items`
- A tela considera datas de entrada, valores e origem quando a API retorna esses campos.
- A consulta deve trazer todos os registros possiveis usando o banco local.
- A abertura do portal passou a ler unidades imobiliárias, bens móveis e bens imóveis salvos em `inventory-assets.sqlite`, sem consultar o Sienge automaticamente.
- A tela passou a priorizar uma visão estratégica antes da lista: estoque precificado, unidades disponíveis, reservas/propostas, itens sem valor, propriedade, mapa imobiliário e insumos.
- Valores zerados agora são tratados como ausência de valor informado quando não existe incorporação, valor contábil, avaliação, tabela especial, fração de VGV ou terreno.
- A classificação próprio/terceiro usa proprietário anterior, origem contábil, indicador de uso e estoque comercial quando esses campos vêm do Sienge.
- Mapa imobiliário e insumos por centro de custo dependem do campo `Centros de custo para estoque avançado` em Configurações.

## Conciliacao

- Foi criado portal de conciliacao.
- A tela usa movimentos bancarios e extratos/contas quando disponiveis na API.
- A tela de conciliacao foi revisada para abrir lendo apenas o SQLite local; consulta ao Sienge fica restrita a atualizacao em Configuracoes.
- Os movimentos bancarios sao lidos do banco `finance-reconciliation.sqlite`, usando os registros espelhados de `/bulk-data/v1/bank-movement`.
- O carregamento visual foi melhorado para mostrar etapas reais em vez de apenas porcentagem.
- As etapas exibidas mostram o que esta pendente, em andamento ou concluido.
- A proposta do portal e acompanhar o que ja esta conciliado, o que esta em aberto e o que precisa de revisao.
- A listagem foi padronizada para mostrar movimento, data, valor, conta, status, vinculo, historico e data de integracao.
- O portal de conciliacao agora tem uma visao mensal funcional: abre no mes mais recente, mostra conciliados, a conciliar, vinculados e avulsos do periodo, e filtra a lista pelo mes selecionado.
- Foi adicionada uma barra mensal clicavel para comparar rapidamente percentual conciliado, volume conciliado e volume pendente por mes.
- Em Configuracoes, agora e possivel escolher uma ou varias contas bancarias para o portal de conciliacao, usando um modal com checkboxes; a visao mensal, os cards e a lista respeitam as contas selecionadas.

## Compras

- Foi criado portal de compras.
- A tela de compras foi revisada para abrir lendo apenas o SQLite local; consulta ao Sienge fica restrita a atualizacao em Configuracoes.
- O portal passou a ler o banco `purchases.sqlite`, usando os registros espelhados de pedidos, notas, solicitacoes e cotacoes.
- A atualizacao forçada em Configuracoes continua consultando o Sienge e gravando o espelho local, sem ser acionada na abertura da tela.
- A tela mostra uma visao comercial, sem detalhes tecnicos na area principal.
- A listagem de registros mostra a data de integracao de cada item.
- A visao principal mostra:
  - pendencias
  - o que foi comprado
  - solicitacoes
  - pedidos
  - valores por periodo
  - andamento por etapa
- Foram incluidos recortes de:
  - ultimos 12 meses
  - ultimos 6 meses
  - mes anterior
  - futuro
- Os registros detalhados ficam em uma aba separada para nao misturar com a visao comercial.
- Fontes usadas:
  - pedidos de compra
  - notas/faturas de compra
  - itens de solicitacoes
  - cotacoes de compra

## Componentes e estrutura

- A estrutura do frontend foi organizada em:
  - `app`
  - `components`
  - `features`
  - `lib`
- Foram criados componentes reutilizaveis para:
  - cards de indicadores
  - cabecalho de pagina
  - aviso de erro de API
  - graficos de pizza, linha, barras/ranking e fluxo
  - tabelas e exploradores de registros
- A camada `lib/api` centraliza chamadas ao Sienge, espelho local e persistencia.
- As listas principais exibem `Integrado em ...` por registro, incluindo financeiro, recebiveis, vendas, estoque, compras, conciliacao, agenda de contas a pagar e consulta de parcelas/baixa.
- A exibicao da integracao foi padronizada no componente `IntegrationStamp`.
- A formatacao de datas opcionais foi centralizada em `formatOptionalDate`.
- Separadores especiais foram trocados por hifen simples para evitar caracteres quebrados em Windows/terminal.

## Mapa Sienge

- Foi criada a rota `/sienge`.
- A tela funciona como auditoria de cobertura operacional do Sienge dentro do sistema.
- A abertura lê somente os bancos locais e não consulta o Sienge.
- A visão mostra:
  - módulos em uso, parciais, preparados e não usados
  - fontes/endpoints mapeados
  - registros locais por fonte
  - última integração detectada
  - telas onde cada módulo é usado
  - melhor uso operacional do Sienge para cada área
  - lacunas e próximos passos
- A tela ajuda a decidir quais integrações precisam ser completadas para aproveitar melhor o Sienge.

## Validacoes recentes

- TypeScript passou com `tsc --noEmit`.
- Build do Next passou com `next build`.
- O aviso de SQLite experimental do Node pode aparecer, mas nao impediu a build.
- O erro antigo do Next `Cannot find module './948.js'` esta relacionado a cache/build local quebrado da pasta `.next`; essa pasta esta ignorada no Git.

## Pontos de atencao

- A API do Sienge ainda pode bloquear chamadas por limite de uso, principalmente em consultas bulk.
- Atualizacoes amplas devem ser feitas com cuidado em Configuracoes, porque consultam o Sienge e podem atingir limites da API.
- Algumas telas dependem dos campos que o Sienge realmente retorna para a empresa; quando o campo nao vem na resposta, a tela mostra vazio ou "nao informado".
- O dashboard inicial geral esta implementado localmente, mas ainda nao foi incluido em commit depois do commit principal.

## Configuracoes

- Foi criada a tela `/configuracoes` em um menu separado.
- A tela foi refatorada para funcionar como central de dados do sistema.
- A area principal mostra o estado do espelho local, ultima integracao e botoes de atualizacao por area.
- Cada area tem acao de atualizar normal e atualizar com forca.
- A atualizacao normal preserva dados pagos, baixados ou finalizados quando identificados.
- A atualizacao com forca pode substituir tambem registros finalizados.
- A tela permite parametrizar:
  - nome, funcao e iniciais exibidos no topo do sistema
  - quantidade de meses exibidos nos graficos do dashboard
  - data inicial e data final usadas nas atualizacoes do Sienge
  - quantidade de meses futuros na agenda de contas a pagar
  - exibicao de avisos de atualizacao
- As configuracoes ficam salvas em SQLite local, no arquivo `app-settings.sqlite`.
- A tela de Configuracoes possui botoes para atualizar dados do Sienge por area ou todas as areas.
- Os botoes de atualizacao iniciam um job em segundo plano, liberando a tela imediatamente.
- O andamento da carga fica visivel na propria tela, separado por area atualizada.
- O sistema permite apenas uma carga do Sienge por vez para reduzir risco de limite de API e travas no banco local.
- As atualizacoes de contas a pagar, contas a receber, conciliacao e cotacoes de compras usam o periodo de integracao escolhido quando o endpoint aceita data.
- Cada chamada real ao Sienge passa a gravar um historico resumido em SQLite com endpoint, area responsavel, dia, status e horario.
- A tela de Configuracoes mostra a ultima atualizacao por portal e tambem o tamanho dos bancos SQLite locais.
