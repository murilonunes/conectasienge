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
