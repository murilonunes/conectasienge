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

### Pontos de atenção atuais

- O caminho de `add-item`/Insumo direto está implementado no app, mas deve ser validado campo a campo contra o contrato oficial do Sienge antes de ser tratado como pronto em produção. Em revisões anteriores, o campo de apropriação por obra (`buildingsApropriations`) apareceu como risco para `PurchaseQuotationItemInsert`.

### Rotas locais do portal do fornecedor

- `POST /api/supplier-portal/responses`: recebe a proposta pública, valida token ativo, bloqueia reenvio pelo mesmo token, valida e-mail, telefone, frete, prazo geral, forma de pagamento, parcelas e quantidades.
- `DELETE /api/supplier-portal/responses/{responseId}?quotationId={id}`: rota protegida por sessão; exclui uma resposta recebida, remove aprovações vinculadas e registra evento local.
- `POST /api/supplier-portal/link-requests`: rota pública com limite por IP e global; gera novo link para revisão quando o fornecedor possui o token de uma proposta já enviada e o token não está revogado.
- `POST /api/supplier-portal/invitations`: rota protegida por sessão; gera links a partir da tela interna de cotações.
- `DELETE /api/supplier-portal/invitations`: rota protegida por sessão; revoga links.
