import { ReactNode, useLayoutEffect, useRef } from 'react';
import { Language, localizeText } from '../i18n';

const attributes = ['placeholder', 'title', 'aria-label'] as const;
const textSources = new WeakMap<Node, string>();
const attributeSources = new WeakMap<Element, Map<string, string>>();

function preserveSpacing(original: string, translated: string): string {
  const leading = original.match(/^\s*/)?.[0] ?? '';
  const trailing = original.match(/\s*$/)?.[0] ?? '';
  return `${leading}${translated}${trailing}`;
}

function translateDynamic(language: Language, value: string): string {
  const filter = value.match(/^(?:Filtrer|Filter)\s+(.+)$/);
  if (filter) return language === 'fr' ? `Filtrer ${filter[1]}` : `Filter ${filter[1]}`;

  const pagination = value.match(/^(\d+)\s+(?:resultat\(s\)|résultat\(s\)|result\(s\))\s+-\s+(?:page)\s+(\d+)\s+\/\s+(\d+)$/i);
  if (pagination) {
    return language === 'fr'
      ? `${pagination[1]} résultat(s) - page ${pagination[2]} / ${pagination[3]}`
      : `${pagination[1]} result(s) - page ${pagination[2]} / ${pagination[3]}`;
  }
  return localizeText(language, value);
}

function translateElement(language: Language, element: Element, refreshSource = false) {
  if (['SCRIPT', 'STYLE', 'CODE', 'PRE'].includes(element.tagName)) return;
  let sources = attributeSources.get(element);
  if (!sources) {
    sources = new Map<string, string>();
    attributeSources.set(element, sources);
  }
  for (const attribute of attributes) {
    const current = element.getAttribute(attribute);
    if (!current) continue;
    if (refreshSource || !sources.has(attribute)) sources.set(attribute, current);
    const source = sources.get(attribute) ?? current;
    const translated = translateDynamic(language, source);
    if (translated !== current) element.setAttribute(attribute, translated);
  }
}

function translateTextNode(language: Language, node: Node, refreshSource = false) {
  const current = node.textContent ?? '';
  if (refreshSource || !textSources.has(node)) textSources.set(node, current);
  const source = textSources.get(node) ?? current;
  const translated = translateDynamic(language, source.trim());
  if (translated !== current.trim()) node.textContent = preserveSpacing(source, translated);
}

function translateTree(language: Language, root: Node, refreshSource = false) {
  if (root.nodeType === Node.TEXT_NODE) {
    translateTextNode(language, root, refreshSource);
    return;
  }

  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;
  if (root.nodeType === Node.ELEMENT_NODE) translateElement(language, root as Element, refreshSource);

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) {
      translateTextNode(language, node, refreshSource);
    } else {
      translateElement(language, node as Element, refreshSource);
    }
    node = walker.nextNode();
  }
}

export function LocalizationBridge({ language, children }: { language: Language; children: ReactNode }) {
  const translating = useRef(false);

  useLayoutEffect(() => {
    translating.current = true;
    translateTree(language, document.body);
    translating.current = false;

    const observer = new MutationObserver((mutations) => {
      if (translating.current) return;
      translating.current = true;
      for (const mutation of mutations) {
        if (mutation.type === 'characterData') translateTree(language, mutation.target, true);
        if (mutation.type === 'attributes') translateElement(language, mutation.target as Element, true);
        mutation.addedNodes.forEach((node) => translateTree(language, node));
      }
      translating.current = false;
    });
    observer.observe(document.body, {
      attributeFilter: [...attributes],
      attributes: true,
      childList: true,
      characterData: true,
      subtree: true,
    });
    return () => observer.disconnect();
  }, [language]);

  return children;
}
