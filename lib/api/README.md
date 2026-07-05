# Integração Sienge

O cliente `siengeRequest` deve ser usado somente em componentes de servidor ou rotas de API.
As credenciais ficam nas variáveis descritas em `.env.example` e nunca são enviadas ao navegador.

A especificação OpenAPI fornecida é a versão `1.11.0`. Antes de conectar cada tela, confirme o
endpoint e o formato de resposta correspondente na especificação.

Os serviços iniciais estão em `financeiro.ts`:

- contas a pagar: `/v1/bills`
- contas a receber: `/v1/accounts-receivable/receivable-bills`
- inadimplência: `/v1/overdue-receivable-bill`
- contratos: `/v1/supply-contracts/all` e `/v1/sales-contracts`
- cotações de compra: `/v1/purchase-quotations`
- fornecedores/credores para cotações: `/v1/creditors`

## Cotações de compra

O fluxo de cotações usa o espelho local de compras na abertura das telas. As escritas no Sienge ficam concentradas em `/api/sienge/purchase-quotations` e seguem o padrão de `dryRun` antes de confirmar:

- criar cotação no Sienge;
- vincular item de solicitação à cotação;
- criar item direto na cotação;
- incluir fornecedor por item da cotação;
- preparar ou confirmar negociação a partir das respostas recebidas pelo portal do fornecedor.

O portal público do fornecedor não chama o Sienge diretamente. Ele grava convites, respostas, aprovações, revisões de cadastro e eventos no banco local `supplier-quotations.sqlite`; a integração posterior com o Sienge acontece pelas abas internas da cotação.

Toda escrita confirmada no Sienge grava um evento local com `integrationKey`. Antes de repetir uma gravação confirmada, a rota consulta esse histórico e retorna `409` quando encontra a mesma operação já integrada. O usuário pode forçar a repetição conscientemente pela tela, mas o envio automático duplicado fica bloqueado.

### O que cada tela faz de fato

- `/cotacoes` abre lendo o espelho local de compras (`loadPurchases`) e monta filtros, status, exportação e cards sem consultar o Sienge.
- Quando `/cotacoes` recebe uma solicitação de compra como origem, os botões de criação chamam `/api/sienge/purchase-quotations`: primeiro em `dryRun`, depois com `confirm: true`.
- `/cotacoes/[id]` também abre pelo espelho local e pelas tabelas locais do portal do fornecedor; as ações que gravam no Sienge ficam nas abas Sienge, Respostas, Aprovar e Cadastros.
- A aba Sienge prepara ou confirma criação da cotação, vínculo de itens de solicitação, inclusão de fornecedor por item e criação de insumo direto.
- A aba Respostas envia uma proposta recebida pelo portal como negociação do fornecedor no Sienge e permite excluir uma resposta local, removendo aprovações vinculadas.
- A aba Aprovar salva a decisão localmente e, quando confirmado, envia a decisão como negociação autorizada.
- A aba Cadastros cria fornecedor/credor no Sienge por `/api/sienge/suppliers`, que usa `/v1/creditors`.
- A aba Mapa calcula análises localmente e pode buscar o PDF do mapa comparativo do Sienge.
- O portal público do fornecedor salva propostas apenas no banco local. Depois do envio, a proposta fica somente para consulta; revisão de proposta usa novo link gerado por `/api/supplier-portal/link-requests`.

### Endpoints usados em cotações

- `POST /v1/purchase-quotations`: cria cotação.
- `POST /v1/purchase-quotations/{id}/items/from-purchase-request`: vincula item de solicitação à cotação.
- `POST /v1/purchase-quotations/{id}/items/{item}/suppliers`: inclui fornecedor em item.
- `POST /v1/purchase-quotations/{id}/items`: cria insumo direto na cotação.
- `GET /v1/purchase-quotations/all/negotiations?quotationNumber={id}`: consulta negociações e ajuda a identificar a última negociação criada.
- `POST /v1/purchase-quotations/{id}/suppliers/{supplierId}/negotiations`: cria negociação.
- `PUT /v1/purchase-quotations/{id}/suppliers/{supplierId}/negotiations/{negotiationNumber}`: atualiza condições comerciais da negociação.
- `PUT /v1/purchase-quotations/{id}/suppliers/{supplierId}/negotiations/{negotiationNumber}/items/{item}`: atualiza preço, quantidade e seleção por item.
- `PATCH /v1/purchase-quotations/{id}/suppliers/{supplierId}/negotiations/latest/authorize`: autoriza a última negociação.
- `GET /v1/purchase-quotations/comparison-map/pdf?purchaseQuotationId={id}`: busca URL do PDF do mapa comparativo.
- `POST /v1/creditors`: cria fornecedor/credor a partir de cadastro pendente.

### Dados enviados por operação Sienge

- Criar cotação (`POST /v1/purchase-quotations`): usa comprador e data informados na tela. Quando vem de uma solicitação, usa também `purchaseRequestId`, itens e entregas para vincular os itens retornados pelo Sienge. No detalhe de uma cotação já existente, a criação é bloqueada por padrão para evitar duplicar a cotação.
- Vincular item de solicitação (`POST /items/from-purchase-request`): usa ID da cotação, ID da solicitação, número do item e entrega. A chave de deduplicação considera todos esses campos.
- Incluir fornecedor no item (`POST /items/{item}/suppliers`): usa ID da cotação, número do item da cotação e ID do credor/fornecedor Sienge. A chave de deduplicação considera cotação, item e fornecedor.
- Criar insumo direto (`POST /items`): usa obra, insumo, quantidade, unidade, entrega e apropriação de obra (`buildingUnitId`, `costEstimationItemReference`, `percentage`). A tela exige apropriação total de 100% antes de confirmar, porque esse caminho não reaproveita a apropriação de uma solicitação de compra.
- Gravar negociação (`POST/PUT /negotiations` e `PUT /items/{item}`): usa fornecedor Sienge e a resposta recebida pelo portal do fornecedor, incluindo pagamento, frete, observações, preço, quantidade e itens selecionados. A chave de deduplicação considera cotação, fornecedor, resposta do portal e modo de envio.
- Autorizar negociação (`PATCH /negotiations/latest/authorize`): usa a mesma resposta aprovada localmente e marca a última negociação do fornecedor como autorizada. A autorização tem chave separada da gravação simples.
- Criar fornecedor (`POST /v1/creditors`): usa nome, CPF/CNPJ, e-mail e telefone da resposta do fornecedor. A chave de deduplicação é global por documento, para evitar criar o mesmo credor por outra cotação.

### Histórico e deduplicação

- Eventos de sucesso ficam em `supplier_quote_events` com tipo `sienge_created`.
- Eventos de erro ficam em `supplier_quote_events` com tipo `integration_error`.
- A aba Sienge mostra as 10 integrações mais recentes da cotação e marca cada tema como `Integrado`, `Existente`, `Pronto` ou pendente conforme o histórico e os campos preenchidos.
- O backend nunca bloqueia `dryRun`; bloqueia apenas gravação confirmada que repete a mesma `integrationKey`.
- Integrações antigas que não tinham `integrationKey` continuam aparecendo no histórico, mas não conseguem bloquear duplicidade retroativamente.

### Pontos de atenção atuais

- O caminho de `add-item`/Insumo direto agora exige apropriação de obra antes de confirmar. A documentação oficial de apoio do Sienge informa que apropriações de item de solicitação retornam unidade construtiva, referência do orçamento e percentual; se o contrato oficial do endpoint de cotações mudar, esses campos devem ser conferidos novamente antes de usar em produção.

### Rotas locais do portal do fornecedor

- `POST /api/supplier-portal/responses`: recebe a proposta pública, valida token ativo, bloqueia reenvio pelo mesmo token, valida e-mail, telefone, frete, prazo geral, forma de pagamento, parcelas e quantidades.
- `DELETE /api/supplier-portal/responses/{responseId}?quotationId={id}`: rota protegida por sessão; exclui uma resposta recebida, remove aprovações vinculadas e registra evento local.
- `POST /api/supplier-portal/link-requests`: rota pública com limite por IP e global; gera novo link para revisão quando o fornecedor possui o token de uma proposta já enviada e o token não está revogado.
- `POST /api/supplier-portal/invitations`: rota protegida por sessão; gera links a partir da tela interna de cotações.
- `DELETE /api/supplier-portal/invitations`: rota protegida por sessão; revoga links.
