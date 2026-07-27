import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

const roots = ["app", "components", "features"];
const uiAttributes = new Set([
  "action",
  "aria-label",
  "description",
  "eyebrow",
  "helper",
  "label",
  "note",
  "placeholder",
  "subtitle",
  "text",
  "title"
]);
const uiPropertyNames = new Set([
  "action",
  "description",
  "eyebrow",
  "label",
  "note",
  "primaryLabel",
  "scope",
  "secondaryLabel",
  "subtitle",
  "text",
  "title"
]);
const portugueseWords = new Set([
  "aba", "abaixo", "aberta", "abertas", "aberto", "abertos", "abertura", "acima", "acompanhar",
  "aguarde", "ainda", "ajuste", "algum", "alguma", "algumas", "alguns", "antes", "apenas", "aparece",
  "aparecem", "aplicado", "apropriação", "apropriações", "aqui", "área", "áreas", "assim", "atualização",
  "atualizações", "atualizar", "atualize", "avaliação", "aviso", "avisos", "banco", "base", "baixa", "baixas",
  "busca", "cadastrado", "cadastrada", "cadastrados", "cadastro", "cálculo", "carteira", "cenário",
  "cliente", "clientes",
  "cobrança", "cobranças", "código", "competência", "completar", "conciliação", "conferência", "configuração",
  "configurações", "consulta", "consultas", "consultar", "contábil", "contratado", "contratada", "correção",
  "credor", "critério", "dados", "depois", "despesa", "despesas", "detalhada", "diretamente", "disponível",
  "disponíveis", "documento", "emissão", "encerrado", "encerrados", "enquanto", "entrou", "erro", "escolha",
  "esperando", "estoque", "excesso", "exercício", "exibição", "falta", "fechados", "fechar", "fica", "ficam",
  "finalizados", "financeira", "financeiras", "fonte", "fontes", "fornecedor", "fornecedores", "futuro",
  "futuros", "futura", "futuras", "gerado", "gerada",
  "gráfico", "gráficos", "gravado", "gravada", "histórico", "imobiliário", "indicado", "informada", "informado",
  "insumo", "insumos", "integração", "integrações", "lançado", "lançados", "leitura", "líquido", "líquida",
  "medição", "medições", "melhor", "mensal", "mestre", "módulo", "módulos", "movimento", "movimentos",
  "nenhum", "nenhuma", "novo", "nova", "obra", "obras", "oportunidade", "pagamento", "pagamentos", "parcela",
  "parcelas", "parcial", "passado", "passados", "passada", "passadas", "pendente", "pendências", "período",
  "planejamento",
  "possível", "possíveis", "prazo", "preço", "previsão", "previsões",
  "preços", "preenchimento", "primeiro", "própria", "próprio", "próximo", "próximos", "próxima",
  "próximas", "recebimento", "recebimentos", "recebíveis", "receita", "recomendação", "reconhecido",
  "reconhecida", "registro", "registros", "relatório", "relatórios",
  "resposta", "respostas", "resultado", "revisão", "salva", "salvas", "salvo", "salvos", "saldo", "senha",
  "situação", "solicitação", "solicitações", "somente", "suprimentos", "tela", "telas", "título", "títulos",
  "todas", "última",
  "último", "unidade", "unidades", "usuário", "usuários", "validar", "valor", "valores", "vencimento",
  "pagar", "restante",
  "vencida", "vencidas", "vencido", "vencidos", "venda", "vendas", "visão", "vínculo", "vínculos"
]);

function loadTranslator() {
  const completeSource = fs.readFileSync(path.join("lib", "i18n", "messages-en-complete.ts"), "utf8");
  const completeCompiled = ts.transpileModule(completeSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText;
  const completeModule = { exports: {} };
  vm.runInNewContext(
    `(function(exports,module){${completeCompiled}})(module.exports,module)`,
    { module: completeModule }
  );

  const source = fs.readFileSync(path.join("lib", "i18n", "messages.ts"), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(
    `(function(exports,module,require){${compiled}})(module.exports,module,require)`,
    {
      module,
      require: (specifier) => (
        specifier === "@/lib/i18n/messages-en-complete"
          ? completeModule.exports
          : {}
      )
    }
  );
  return module.exports.translateUiText;
}

function walk(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!absolute.includes(path.join("components", "i18n"))) files.push(...walk(absolute));
    } else if (
      entry.isFile()
      && (entry.name.endsWith(".tsx") || (entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")))
    ) {
      files.push(absolute);
    }
  }
  return files;
}

function staticValue(attribute) {
  if (!attribute.initializer) return undefined;
  if (ts.isStringLiteral(attribute.initializer)) return attribute.initializer.text;
  if (
    ts.isJsxExpression(attribute.initializer)
    && attribute.initializer.expression
  ) {
    if (
      ts.isStringLiteral(attribute.initializer.expression)
      || ts.isNoSubstitutionTemplateLiteral(attribute.initializer.expression)
    ) {
      return attribute.initializer.expression.text;
    }
    if (ts.isTemplateExpression(attribute.initializer.expression)) {
      return attribute.initializer.expression.head.text
        + attribute.initializer.expression.templateSpans
          .map((span) => `0${span.literal.text}`)
          .join("");
    }
  }
  return undefined;
}

function collectMessages() {
  const messages = new Set();
  const unmarkedMessages = new Set();
  const messageSetter = /^set(?:Message|Error|StatusMessage|CacheStatus|LinkMessage|ApprovalMessage|FormError|SubmitError)$/;

  function collectStaticStrings(node) {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (node.text.trim()) messages.add(node.text.trim().replace(/\s+/g, " "));
      return;
    }
    if (ts.isTemplateExpression(node)) {
      const template = node.head.text + node.templateSpans.map((span) => `0${span.literal.text}`).join("");
      if (template.trim()) messages.add(template.trim().replace(/\s+/g, " "));
      return;
    }
    ts.forEachChild(node, collectStaticStrings);
  }

  for (const file of roots.flatMap(walk)) {
    const source = fs.readFileSync(file, "utf8");
    const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

    function visit(node) {
      if (ts.isJsxText(node)) {
        const value = node.text.trim().replace(/\s+/g, " ");
        if (value && remainingPortuguese(value).length) unmarkedMessages.add(`${file}: ${value}`);
      }
      if (
        ts.isJsxExpression(node)
        && !ts.isJsxAttribute(node.parent)
        && node.expression
        && (ts.isStringLiteral(node.expression) || ts.isNoSubstitutionTemplateLiteral(node.expression))
      ) {
        const value = node.expression.text.trim().replace(/\s+/g, " ");
        if (value && remainingPortuguese(value).length) unmarkedMessages.add(`${file}: ${value}`);
      }
      if (ts.isJsxAttribute(node)) {
        const name = node.name.text;
        if (name.startsWith("data-i18n-") || uiAttributes.has(name)) {
          const value = staticValue(node);
          if (value?.trim()) messages.add(value.trim().replace(/\s+/g, " "));
        }
      }
      if (
        ts.isCallExpression(node)
        && ts.isIdentifier(node.expression)
        && messageSetter.test(node.expression.text)
        && node.arguments[0]
      ) {
        collectStaticStrings(node.arguments[0]);
      }
      if (ts.isPropertyAssignment(node)) {
        const name = ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)
          ? node.name.text
          : undefined;
        if (name && uiPropertyNames.has(name)) collectStaticStrings(node.initializer);
      }
      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
  }
  return {
    messages: [...messages],
    unmarkedMessages: [...unmarkedMessages]
  };
}

function remainingPortuguese(value) {
  const words = value.toLocaleLowerCase("pt-BR").match(/[a-zà-öø-ÿ]+/g) || [];
  return words.filter((word) => portugueseWords.has(word));
}

const translateUiText = loadTranslator();
const audit = collectMessages();
const expectedTranslations = new Map([
  ["Previsão financeira", "Financial forecast"],
  ["Próximos 30 dias", "Next 30 days"],
  ["304 parcelas vencidas", "304 overdue installments"],
  ["1 parcela", "1 installment"],
  ["4 parcelas", "4 installments"],
  ["7 dias futuros", "Next 7 days"],
  ["R$ 593,5 mil", "R$593.5K"],
  ["passado", "past"],
  ["Recebíveis por cliente", "Receivables by customer"],
  ["Atualizar dados", "Update data"],
  ["Suprimentos", "Procurement"],
  ["Solicitação", "Request"],
  ["Planejamento", "Planning"],
  ["A pagar restante", "Remaining payables"],
  ["Todas as áreas", "All areas"]
]);
const expectationFailures = [...expectedTranslations]
  .map(([source, expected]) => ({
    source,
    expected,
    translated: translateUiText(source, "en-US")
  }))
  .filter((entry) => entry.translated !== entry.expected);
const failures = audit.messages
  .map((source) => ({ source, translated: translateUiText(source, "en-US") }))
  .map((entry) => ({ ...entry, residual: remainingPortuguese(entry.translated) }))
  .filter((entry) => entry.residual.length > 0)
  .sort((left, right) => left.source.localeCompare(right.source, "pt-BR"));

if (failures.length || audit.unmarkedMessages.length || expectationFailures.length) {
  if (expectationFailures.length) {
    console.error(`${expectationFailures.length} representative translations do not match:`);
    for (const failure of expectationFailures) {
      console.error(`- ${failure.source}\n  expected: ${failure.expected}\n  received: ${failure.translated}`);
    }
  }
  if (audit.unmarkedMessages.length) {
    console.error(`${audit.unmarkedMessages.length} direct JSX messages bypass i18n:`);
    for (const message of audit.unmarkedMessages) console.error(`- ${message}`);
  }
  console.error(`${failures.length} UI messages still contain Portuguese terms:`);
  for (const failure of failures) {
    console.error(`- ${failure.source}\n  -> ${failure.translated}\n  residual: ${[...new Set(failure.residual)].join(", ")}`);
  }
  process.exitCode = 1;
} else {
  console.log("All marked UI messages pass the English residual audit.");
}
