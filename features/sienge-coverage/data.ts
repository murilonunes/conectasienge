import "server-only";
import { existsSync, statSync } from "fs";
import { DatabaseSync } from "node:sqlite";
import path from "path";

type Row = Record<string, unknown>;

export type SiengeCoverageStatus = "active" | "partial" | "ready" | "unused";

export type SiengeCoverageEndpoint = {
  label: string;
  endpoint: string;
  database: string;
  table?: string;
  implemented: boolean;
  records: number;
  lastUpdatedAt?: string;
  lastDay?: string;
  role: string;
};

export type SiengeCoverageModule = {
  id: string;
  area: string;
  title: string;
  description: string;
  status: SiengeCoverageStatus;
  coverage: number;
  totalRecords: number;
  lastUpdatedAt?: string;
  route?: string;
  bestUse: string;
  systemUse: string;
  nextStep: string;
  strengths: string[];
  gaps: string[];
  endpoints: SiengeCoverageEndpoint[];
};

const dataDir = path.join(process.cwd(), ".sienge-data");

const dbFiles = {
  payables: "finance-payables.sqlite",
  receivables: "finance-receivables.sqlite",
  reconciliation: "finance-reconciliation.sqlite",
  sales: "commercial-sales.sqlite",
  contracts: "contracts-supply.sqlite",
  inventory: "inventory-assets.sqlite",
  purchases: "purchases.sqlite",
  settings: "app-settings.sqlite"
} as const;

type EndpointDefinition = {
  label: string;
  endpoint: string;
  database: keyof typeof dbFiles;
  table?: string;
  implemented: boolean;
  role: string;
};

type ModuleDefinition = Omit<SiengeCoverageModule, "status" | "coverage" | "totalRecords" | "lastUpdatedAt" | "endpoints"> & {
  endpoints: EndpointDefinition[];
};

const modules: ModuleDefinition[] = [
  {
    id: "payables",
    area: "Financeiro",
    title: "Contas a pagar",
    description: "Títulos, parcelas, vencimentos, pagamentos, autorizações e cobranças.",
    route: "/contas-pagar",
    bestUse: "Controlar vencimentos, baixas, valores corrigidos, juros/multa e risco de cobrança abusiva.",
    systemUse: "Portal de contas a pagar, agenda, busca avançada, baixa/consulta de título e dashboard.",
    nextStep: "Separar categorias financeiras e centros de custo para análise gerencial mais forte.",
    strengths: ["Busca local rápida", "Parcelas abertas e pagas", "Análise de cobrança abusiva", "Base para DRE/custos"],
    gaps: ["Baixa efetiva continua dependente de endpoint público disponível", "Classificação gerencial ainda pode evoluir"],
    endpoints: [
      { label: "Títulos a pagar", endpoint: "/v1/bills", database: "payables", implemented: true, role: "Títulos e identificação documental" },
      { label: "Parcelas e baixas", endpoint: "/bulk-data/v1/outcome", database: "payables", table: "bulk_outcome_installments", implemented: true, role: "Agenda, pagamentos, juros, multa e DRE" },
      { label: "Pagamentos", endpoint: "/bulk-data/v1/outcome/payments", database: "payables", table: "bulk_outcome_payments", implemented: true, role: "Caixa realizado e histórico de baixa" }
    ]
  },
  {
    id: "receivables",
    area: "Financeiro",
    title: "Contas a receber",
    description: "Recebíveis, parcelas, saldos em aberto e recebimentos.",
    route: "/contas-receber",
    bestUse: "Projetar recebimento, inadimplência, caixa futuro e realizado.",
    systemUse: "Portal de contas a receber, dashboard, relatórios e DRE caixa.",
    nextStep: "Amarrar clientes, contratos e unidades com IDs para reduzir dependência de nomes.",
    strengths: ["Previsão sem escolher cliente manualmente", "Recebimentos reais", "Saldos em aberto"],
    gaps: ["Cadastro detalhado de clientes ainda não é uma tela própria", "Régua de cobrança ainda não existe"],
    endpoints: [
      { label: "Recebíveis", endpoint: "/bulk-data/v1/income", database: "receivables", table: "bulk_income_installments", implemented: true, role: "Previsão, aberto e vencido" },
      { label: "Recebimentos", endpoint: "/bulk-data/v1/income/receipts", database: "receivables", table: "bulk_income_receipts", implemented: true, role: "Caixa realizado" },
      { label: "Títulos por cliente", endpoint: "/v1/accounts-receivable/receivable-bills", database: "receivables", implemented: false, role: "Detalhamento cadastral por cliente" }
    ]
  },
  {
    id: "cash-banks",
    area: "Financeiro",
    title: "Caixa, bancos e conciliação",
    description: "Movimentos bancários, conciliação, contas e itens avulsos.",
    route: "/conciliacao",
    bestUse: "Saber o que foi conciliado, pendente, avulso e vinculado por mês e conta bancária.",
    systemUse: "Portal de conciliação com visão mensal, filtros por conta e lista operacional.",
    nextStep: "Criar regras de conciliação e relatório de divergências.",
    strengths: ["Visão mensal", "Seleção de contas", "Movimentos conciliados e pendentes"],
    gaps: ["Ainda não há automação de regras de conciliação", "Status do job de atualização não é persistido"],
    endpoints: [
      { label: "Movimentos bancários", endpoint: "/bulk-data/v1/bank-movement", database: "reconciliation", implemented: true, role: "Base da conciliação" },
      { label: "Extratos de contas", endpoint: "/v1/accounts-statements", database: "reconciliation", implemented: true, role: "Complemento de caixa e contas" }
    ]
  },
  {
    id: "sales",
    area: "Comercial",
    title: "Vendas e contratos de venda",
    description: "Contratos comerciais, valor vendido, situação, cliente, empreendimento e unidade.",
    route: "/sales",
    bestUse: "Acompanhar carteira vendida, evolução comercial e base da Receita POC.",
    systemUse: "Portal de vendas, dashboard, relatórios e DRE POC.",
    nextStep: "Usar vínculo por ID entre venda, empreendimento, unidade e obra para POC mais confiável.",
    strengths: ["Contratos de vendas", "Ranking e gráfico mensal", "Base de vendas contratadas"],
    gaps: ["Vínculo com contratos de fornecimento ainda depende de nomes quando IDs não aparecem"],
    endpoints: [
      { label: "Contratos de venda", endpoint: "/v1/sales-contracts", database: "sales", implemented: true, role: "Carteira comercial e DRE POC" }
    ]
  },
  {
    id: "supply-contracts",
    area: "Contratos",
    title: "Contratos de fornecimento e medições",
    description: "Contratos, fornecedores, valores contratados, saldos e valores medidos.",
    route: "/contratos",
    bestUse: "Acompanhar execução contratual e alimentar o percentual de avanço da DRE POC.",
    systemUse: "Portal de contratos e base de medição para DRE POC.",
    nextStep: "Atualizar contratos e validar se o Sienge retorna valor medido por obra.",
    strengths: ["Valor contratado", "Valor medido quando disponível", "Fornecedores e situação contratual"],
    gaps: ["Sem base local, a DRE POC fica sem avanço de obra", "Medição mensal histórica ainda não está separada"],
    endpoints: [
      { label: "Contratos de fornecimento", endpoint: "/v1/supply-contracts/all", database: "contracts", implemented: true, role: "Contratos, saldos e POC" }
    ]
  },
  {
    id: "purchases",
    area: "Suprimentos",
    title: "Compras",
    description: "Solicitações, cotações, pedidos, notas fiscais e pendências.",
    route: "/compras",
    bestUse: "Entender pipeline de compra: solicitado, cotado, pedido, entregue/faturado e pendente.",
    systemUse: "Portal de compras com visão comercial e registros em aba separada.",
    nextStep: "Amarrar compra a obra, fornecedor e orçamento para custo previsto x realizado.",
    strengths: ["Pedidos", "Solicitações", "Cotações", "Notas fiscais"],
    gaps: ["Ainda falta relatório completo de ciclo de compra e SLA", "Nem todos os vínculos de obra/fornecedor são explorados"],
    endpoints: [
      { label: "Pedidos de compra", endpoint: "/v1/purchase-orders", database: "purchases", implemented: true, role: "Pedidos e pendências" },
      { label: "Notas fiscais", endpoint: "/v1/purchase-invoices", database: "purchases", implemented: true, role: "Faturamento de compras" },
      { label: "Solicitações", endpoint: "/v1/purchase-requests/all/items", database: "purchases", implemented: true, role: "Início do processo" },
      { label: "Cotações", endpoint: "/bulk-data/v1/purchase-quotations", database: "purchases", implemented: true, role: "Negociação e fornecedores" }
    ]
  },
  {
    id: "inventory",
    area: "Patrimônio e estoque",
    title: "Estoque, unidades e patrimônio",
    description: "Unidades imobiliárias, bens móveis, bens imóveis, situação e valores.",
    route: "/estoque",
    bestUse: "Saber o que está em estoque, disponível, próprio/de terceiros e com valor informado.",
    systemUse: "Portal de estoque, dashboard e relatórios.",
    nextStep: "Configurar centros de custo para enriquecer mapa imobiliário e insumos em estoque.",
    strengths: ["Unidades imobiliárias", "Bens móveis", "Bens imóveis", "Situação comercial", "Mapa imobiliário", "Insumos e reservas"],
    gaps: ["Valores retornados pela API podem vir zerados", "Mapa e insumos dependem de centro de custo configurado"],
    endpoints: [
      { label: "Unidades imobiliárias", endpoint: "/v1/units", database: "inventory", implemented: true, role: "Estoque comercial" },
      { label: "Bens móveis", endpoint: "/v1/patrimony/movable", database: "inventory", implemented: true, role: "Patrimônio móvel" },
      { label: "Bens imóveis", endpoint: "/v1/patrimony/fixed", database: "inventory", implemented: true, role: "Patrimônio fixo" },
      { label: "Tabelas de preço", endpoint: "/v1/price-tables", database: "inventory", implemented: true, role: "Base de preço comercial" },
      { label: "Mapa imobiliário", endpoint: "/v1/real-estate-map", database: "inventory", implemented: true, role: "VGV, estoque e margem por empreendimento" },
      { label: "Reservas de insumos", endpoint: "/v1/stock-reservations", database: "inventory", implemented: true, role: "Compromissos operacionais de estoque" },
      { label: "Insumos em estoque", endpoint: "/v1/stock-inventories", database: "inventory", implemented: true, role: "Quantidade e valor médio por insumo" }
    ]
  },
  {
    id: "registrations",
    area: "Cadastros",
    title: "Clientes, credores e cadastros auxiliares",
    description: "Dados mestres para enriquecer relatórios, documentos, CNPJ/CPF e vínculos.",
    bestUse: "Completar nomes, documentos, CNPJ/CPF, contatos e regras de cobrança/pagamento.",
    systemUse: "Uso indireto quando o próprio endpoint operacional já retorna nome ou documento.",
    nextStep: "Criar espelho local de credores/clientes para enriquecer listas sem novas consultas.",
    strengths: ["Pode melhorar pesquisa por CNPJ", "Pode padronizar fornecedores e clientes"],
    gaps: ["Ainda não existe portal próprio de cadastros", "Consultas de CNPJ são evitadas para não estourar limite"],
    endpoints: [
      { label: "Credores", endpoint: "/v1/creditors", database: "settings", implemented: false, role: "Cadastro de fornecedores/credores" },
      { label: "Clientes", endpoint: "/v1/customers", database: "settings", implemented: false, role: "Cadastro de clientes" }
    ]
  },
  {
    id: "writeback",
    area: "Operações",
    title: "Lançamentos e baixas no Sienge",
    description: "Criação/alteração de títulos e efetivação de baixa.",
    route: "/financeiro",
    bestUse: "Executar operações de escrita com rastreabilidade e confirmação da API.",
    systemUse: "Hoje o sistema consulta dados e evita prometer baixa quando a API pública não garante gravação.",
    nextStep: "Só liberar escrita quando houver endpoint público documentado, permissão e retorno confirmando gravação.",
    strengths: ["Consulta de título/parcela", "Tela de lançamento preparada", "Bloqueio seguro de baixa sem endpoint"],
    gaps: ["Baixa efetiva indisponível na especificação pública usada", "Lançamento ainda precisa validação operacional completa"],
    endpoints: [
      { label: "Criar título", endpoint: "/v1/bills", database: "settings", implemented: false, role: "Escrita operacional" },
      { label: "Informação de pagamento", endpoint: "/v1/bills/:id/installments/:id/payment-information", database: "settings", implemented: false, role: "Escrita operacional bloqueada no fluxo atual" }
    ]
  }
];

function databasePath(key: keyof typeof dbFiles) {
  return path.join(dataDir, dbFiles[key]);
}

function openDatabase(file: keyof typeof dbFiles) {
  const dbPath = databasePath(file);
  if (!existsSync(dbPath)) return undefined;
  const database = new DatabaseSync(dbPath);
  database.exec("PRAGMA busy_timeout = 4000;");
  return database;
}

function tableExists(database: DatabaseSync, table: string) {
  return Boolean(database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table));
}

function tableCount(database: DatabaseSync, table: string) {
  if (!tableExists(database, table)) return 0;
  const row = database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as Row;
  return Number(row.count || 0);
}

function endpointCount(database: DatabaseSync, endpoint: string) {
  if (!tableExists(database, "sienge_records")) return { count: 0, lastUpdatedAt: undefined as string | undefined, lastDay: undefined as string | undefined };
  const operator = endpoint === "/v1/stock-inventories" ? "LIKE" : "=";
  const value = endpoint === "/v1/stock-inventories" ? `${endpoint}/%` : endpoint;
  const row = database.prepare(`
    SELECT COUNT(*) AS count, MAX(saved_at) AS lastUpdatedAt, MAX(source_day) AS lastDay
    FROM sienge_records
    WHERE endpoint ${operator} ?
  `).get(value) as Row;
  return {
    count: Number(row.count || 0),
    lastUpdatedAt: row.lastUpdatedAt ? String(row.lastUpdatedAt) : undefined,
    lastDay: row.lastDay ? String(row.lastDay) : undefined
  };
}

function structuredMetadata(database: DatabaseSync, table: string) {
  const count = tableCount(database, table);
  let lastUpdatedAt: string | undefined;
  let lastDay: string | undefined;
  if (count && tableExists(database, table)) {
    const columns = database.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    const hasSavedAt = columns.some((column) => column.name === "saved_at");
    const hasSourceDay = columns.some((column) => column.name === "source_day");
    if (hasSavedAt || hasSourceDay) {
      const row = database.prepare(`
        SELECT ${hasSavedAt ? "MAX(saved_at)" : "NULL"} AS lastUpdatedAt,
               ${hasSourceDay ? "MAX(source_day)" : "NULL"} AS lastDay
        FROM ${table}
      `).get() as Row;
      lastUpdatedAt = row.lastUpdatedAt ? String(row.lastUpdatedAt) : undefined;
      lastDay = row.lastDay ? String(row.lastDay) : undefined;
    }
  }
  return { count, lastUpdatedAt, lastDay };
}

function endpointMetadata(definition: EndpointDefinition): SiengeCoverageEndpoint {
  const database = openDatabase(definition.database);
  if (!database) {
    return {
      ...definition,
      database: dbFiles[definition.database],
      records: 0
    };
  }
  try {
    const metadata = definition.table
      ? structuredMetadata(database, definition.table)
      : endpointCount(database, definition.endpoint);
    return {
      ...definition,
      database: dbFiles[definition.database],
      records: metadata.count,
      lastUpdatedAt: metadata.lastUpdatedAt,
      lastDay: metadata.lastDay
    };
  } finally {
    database.close();
  }
}

function latestDate(values: Array<string | undefined>) {
  return values.filter(Boolean).sort().at(-1);
}

function statusFor(endpoints: SiengeCoverageEndpoint[]): SiengeCoverageStatus {
  const implemented = endpoints.filter((endpoint) => endpoint.implemented);
  if (!implemented.length) return "unused";
  const withData = implemented.filter((endpoint) => endpoint.records > 0);
  if (withData.length === implemented.length) return "active";
  if (withData.length > 0) return "partial";
  return "ready";
}

function coverageFor(endpoints: SiengeCoverageEndpoint[]) {
  const implemented = endpoints.filter((endpoint) => endpoint.implemented);
  if (!implemented.length) return 0;
  return Math.round(implemented.filter((endpoint) => endpoint.records > 0).length / implemented.length * 100);
}

export function loadSiengeCoverageDashboard() {
  const items: SiengeCoverageModule[] = modules.map((module) => {
    const endpoints = module.endpoints.map(endpointMetadata);
    const status = statusFor(endpoints);
    return {
      ...module,
      endpoints,
      status,
      coverage: coverageFor(endpoints),
      totalRecords: endpoints.reduce((sum, endpoint) => sum + endpoint.records, 0),
      lastUpdatedAt: latestDate(endpoints.map((endpoint) => endpoint.lastUpdatedAt))
    };
  });

  const databases = Object.entries(dbFiles).map(([key, file]) => {
    const dbPath = path.join(dataDir, file);
    if (!existsSync(dbPath)) return { key, file, exists: false, sizeBytes: 0, updatedAt: undefined as string | undefined };
    const stats = statSync(dbPath);
    return { key, file, exists: true, sizeBytes: stats.size, updatedAt: stats.mtime.toISOString() };
  });

  const activeModules = items.filter((item) => item.status === "active").length;
  const partialModules = items.filter((item) => item.status === "partial").length;
  const readyModules = items.filter((item) => item.status === "ready").length;
  const unusedModules = items.filter((item) => item.status === "unused").length;
  const totalEndpoints = items.reduce((sum, item) => sum + item.endpoints.length, 0);
  const implementedEndpoints = items.reduce((sum, item) => sum + item.endpoints.filter((endpoint) => endpoint.implemented).length, 0);
  const endpointsWithData = items.reduce((sum, item) => sum + item.endpoints.filter((endpoint) => endpoint.implemented && endpoint.records > 0).length, 0);
  const totalRecords = items.reduce((sum, item) => sum + item.totalRecords, 0);

  return {
    modules: items,
    databases,
    summary: {
      activeModules,
      partialModules,
      readyModules,
      unusedModules,
      totalModules: items.length,
      totalEndpoints,
      implementedEndpoints,
      endpointsWithData,
      totalRecords,
      coverage: implementedEndpoints ? Math.round(endpointsWithData / implementedEndpoints * 100) : 0,
      lastUpdatedAt: latestDate(items.map((item) => item.lastUpdatedAt))
    }
  };
}
