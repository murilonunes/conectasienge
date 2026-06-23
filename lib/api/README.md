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
