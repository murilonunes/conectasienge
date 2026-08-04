export const screenPermissionDefinitions = [
  { permission: "screen.dashboard", label: "Dashboard", description: "Indicadores e tela inicial", paths: ["/", "/dashboard"] },
  { permission: "screen.financeiro", label: "Central financeira", description: "Resumo operacional financeiro", paths: ["/financeiro"] },
  { permission: "screen.compras", label: "Portal de compras", description: "Pedidos e visão geral de compras", paths: ["/compras"] },
  { permission: "screen.rastreabilidade-insumos", label: "Rastreabilidade de insumos", description: "Histórico de solicitações, pedidos e notas por insumo", paths: ["/rastreabilidade-insumos"] },
  { permission: "screen.solicitacoes", label: "Solicitações", description: "Solicitações de compra", paths: ["/solicitacoes-compra"] },
  { permission: "screen.cotacoes", label: "Cotações", description: "Lista, detalhe e aprovação de cotações", paths: ["/cotacoes"] },
  { permission: "screen.contas-pagar", label: "Contas a pagar", description: "Consulta de títulos a pagar", paths: ["/contas-pagar"] },
  { permission: "screen.contas-receber", label: "Contas a receber", description: "Consulta de títulos a receber", paths: ["/contas-receber"] },
  { permission: "screen.lancamentos-novo", label: "Novo lançamento", description: "Criação manual de lançamentos", paths: ["/lancamentos/novo"] },
  { permission: "screen.baixa-pagar", label: "Baixa a pagar", description: "Baixa e conciliação de pagamentos", paths: ["/lancamentos/baixa"] },
  { permission: "screen.baixa-receber", label: "Baixa a receber", description: "Baixa e conciliação de recebimentos", paths: ["/lancamentos/baixa-receber"] },
  { permission: "screen.conciliacao", label: "Conciliação", description: "Conciliação financeira", paths: ["/conciliacao"] },
  { permission: "screen.vendas", label: "Portal de vendas", description: "Visão comercial e vendas", paths: ["/sales"] },
  { permission: "screen.contratos", label: "Contratos", description: "Contratos comerciais", paths: ["/contratos"] },
  { permission: "screen.estoque", label: "Bens em estoque", description: "Estoque e bens", paths: ["/estoque"] },
  { permission: "screen.relatorios", label: "Relatórios", description: "Relatórios gerenciais", paths: ["/relatorios"] },
  { permission: "screen.dre-financeiro", label: "DRE financeiro", description: "DRE por contas a pagar e receber", paths: ["/dre-financeiro"] },
  { permission: "screen.dre", label: "DRE POC", description: "DRE gerencial", paths: ["/dre-gerencial"] },
  { permission: "screen.sienge", label: "Mapa Sienge", description: "Cobertura e integração Sienge", paths: ["/sienge"] },
  { permission: "screen.configuracoes", label: "Configurações", description: "Parâmetros do sistema", paths: ["/configuracoes"] },
  { permission: "screen.usuarios", label: "Usuários", description: "Usuários, permissões e alçadas", paths: ["/configuracoes/usuarios"] }
] as const;

export const operationalPermissionDefinitions = [
  { permission: "quotations.view", label: "Visualizar cotações", description: "Permissão operacional legada para consultas de cotação" },
  { permission: "quotations.manage", label: "Gerenciar cotações", description: "Gerar links, apagar respostas e operar fornecedores" },
  { permission: "quotations.approve", label: "Aprovar cotações", description: "Registrar decisões e aplicar alçada de aprovação" },
  { permission: "sienge.write", label: "Gravar no Sienge", description: "Enviar criações, vínculos e negociações para o Sienge" },
  { permission: "users.manage", label: "Gerenciar usuários", description: "Criar usuários, editar permissões e ajustar alçadas" }
] as const;

export const appPermissions = [
  ...screenPermissionDefinitions.map((item) => item.permission),
  ...operationalPermissionDefinitions.map((item) => item.permission)
] as const;

const screenDefinitionsBySpecificity = [...screenPermissionDefinitions]
  .sort((left, right) => Math.max(...right.paths.map((path) => path.length)) - Math.max(...left.paths.map((path) => path.length)));

export function screenPermissionForPath(pathname: string) {
  const path = pathname || "/";
  return screenDefinitionsBySpecificity.find((definition) => {
    return definition.paths.some((definitionPath) => {
      if (definitionPath === "/") return path === "/";
      return path === definitionPath || path.startsWith(`${definitionPath}/`);
    });
  })?.permission;
}
