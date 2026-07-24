import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const roots = ["app", "components"];
const excludedSegments = [
  `${path.sep}components${path.sep}i18n${path.sep}`,
  `${path.sep}node_modules${path.sep}`,
  `${path.sep}.next${path.sep}`
];
const translatedAttributes = new Set(["placeholder", "title", "aria-label", "alt"]);
const skippedParents = new Set(["script", "style", "code"]);

function walk(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(absolute));
    else if (entry.isFile() && entry.name.endsWith(".tsx")) files.push(absolute);
  }
  return files;
}

function tagName(parent) {
  if (!ts.isJsxElement(parent)) return "";
  const name = parent.openingElement.tagName;
  return ts.isIdentifier(name) ? name.text.toLowerCase() : "";
}

function markerName(attribute) {
  return `data-i18n-${attribute}`;
}

function transformFile(file) {
  const normalized = path.resolve(file);
  if (excludedSegments.some((segment) => normalized.includes(segment))) return false;

  const source = fs.readFileSync(file, "utf8");
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const replacements = [];
  let needsTextImport = false;

  function markOutputStrings(expression) {
    if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
      const expressionSource = source.slice(expression.getStart(sourceFile), expression.end);
      replacements.push({
        start: expression.getStart(sourceFile),
        end: expression.end,
        text: `<I18nText text={${expressionSource}} />`
      });
      needsTextImport = true;
      return;
    }

    if (ts.isConditionalExpression(expression)) {
      markOutputStrings(expression.whenTrue);
      markOutputStrings(expression.whenFalse);
      return;
    }

    if (
      ts.isBinaryExpression(expression)
      && (
        expression.operatorToken.kind === ts.SyntaxKind.BarBarToken
        || expression.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
      )
    ) {
      markOutputStrings(expression.right);
      return;
    }

    if (ts.isParenthesizedExpression(expression)) {
      markOutputStrings(expression.expression);
    }
  }

  function visit(node) {
    if (ts.isJsxText(node) && node.text.trim() && !skippedParents.has(tagName(node.parent))) {
      const raw = source.slice(node.getStart(sourceFile), node.end);
      const leading = raw.match(/^\s*/)?.[0] || "";
      const trailing = raw.match(/\s*$/)?.[0] || "";
      const text = raw.trim().replace(/\s+/g, " ");
      if (text && !text.includes("&")) {
        replacements.push({
          start: node.getStart(sourceFile),
          end: node.end,
          text: `${leading}<I18nText text={${JSON.stringify(text)}} />${trailing}`
        });
        needsTextImport = true;
      }
    }

    if (
      ts.isJsxExpression(node)
      && node.expression
      && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))
    ) {
      const expression = node.expression;
      const isLiteral = ts.isStringLiteral(expression);
      const isStringConditional = ts.isConditionalExpression(expression)
        && ts.isStringLiteral(expression.whenTrue)
        && ts.isStringLiteral(expression.whenFalse);
      if (isLiteral || isStringConditional) {
        const expressionSource = source.slice(expression.getStart(sourceFile), expression.end);
        replacements.push({
          start: node.getStart(sourceFile),
          end: node.end,
          text: `<I18nText text={${expressionSource}} />`
        });
        needsTextImport = true;
      }
    }

    if (
      ts.isJsxExpression(node)
      && node.expression
      && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))
      && !ts.isStringLiteral(node.expression)
      && !(
        ts.isConditionalExpression(node.expression)
        && ts.isStringLiteral(node.expression.whenTrue)
        && ts.isStringLiteral(node.expression.whenFalse)
      )
    ) {
      markOutputStrings(node.expression);
    }

    if (ts.isJsxOpeningLikeElement(node)) {
      const elementName = node.tagName.getText(sourceFile);
      const intrinsicElement = /^[a-z]/.test(elementName);
      const existingNames = new Set(
        node.attributes.properties
          .filter(ts.isJsxAttribute)
          .map((attribute) => attribute.name.text)
      );
      for (const property of node.attributes.properties) {
        if (
          !intrinsicElement
          && ts.isJsxAttribute(property)
          && property.name.text.startsWith("data-i18n-")
        ) {
          let start = property.getStart(sourceFile);
          while (start > 0 && source[start - 1] === " ") start -= 1;
          replacements.push({ start, end: property.end, text: "" });
          continue;
        }
        if (!intrinsicElement) continue;
        if (!ts.isJsxAttribute(property) || !translatedAttributes.has(property.name.text)) continue;
        if (!property.initializer || !ts.isStringLiteral(property.initializer)) continue;
        const marker = markerName(property.name.text);
        if (existingNames.has(marker)) continue;
        const value = property.initializer.text;
        replacements.push({
          start: property.end,
          end: property.end,
          text: ` ${marker}={${JSON.stringify(value)}}`
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  if (!replacements.length) return false;

  if (needsTextImport && !source.includes('from "@/components/i18n/i18n-text"')) {
    const firstImport = source.search(/^import\s/m);
    const insertionPoint = firstImport >= 0 ? firstImport : source.startsWith('"use client";') ? source.indexOf("\n") + 1 : 0;
    replacements.push({
      start: insertionPoint,
      end: insertionPoint,
      text: 'import { I18nText } from "@/components/i18n/i18n-text";\n'
    });
  }

  replacements.sort((left, right) => right.start - left.start || right.end - left.end);
  let output = source;
  for (const replacement of replacements) {
    output = output.slice(0, replacement.start) + replacement.text + output.slice(replacement.end);
  }
  fs.writeFileSync(file, output, "utf8");
  return true;
}

const files = roots.flatMap((root) => walk(root));
const changed = files.filter(transformFile);
console.log(`Marked UI text in ${changed.length} files.`);
