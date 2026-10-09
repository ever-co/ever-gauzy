/**
 * DOM bootstrap for the legacy rich-text corpus audit (06-ckeditor-removal.md §4.4).
 *
 * `@tiptap/html`'s `generateJSON`/`generateHTML` and the shared `normalizeLegacyHtml()`
 * pre-parse fixups both run against a real DOM: they throw (or silently no-op) when
 * `window` / `DOMParser` are missing. Node has neither, so the audit installs a jsdom
 * window on `globalThis` **before** anything from `@tiptap/*` or the editor presets is
 * imported — hence the separate module: CommonJS emits `require()` calls in source order,
 * so a side-effect import of this file at the top of the entry point is the only way to
 * guarantee the globals exist by the time the extension modules initialize.
 *
 * `@tiptap/html/server` (the officially supported Node path) is deliberately not used:
 * it needs the `happy-dom` peer dependency, which this workspace does not carry, and it
 * would audit a *different* DOM implementation than the browser the editor actually runs
 * in. jsdom is already present in the workspace as the Jest environment, which is the same
 * DOM the shipped `legacy-html-corpus.spec.ts` round-trips against.
 */
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
const globals = globalThis as Record<string, unknown>;

/**
 * Only assigned when absent, so a caller that already provides a DOM (a future Jest
 * harness around this module, for instance) keeps its own implementation.
 */
const define = (name: string, value: unknown): void => {
	if (typeof globals[name] === 'undefined') {
		globals[name] = value;
	}
};

define('window', dom.window);
define('document', dom.window.document);
define('navigator', dom.window.navigator);
define('DOMParser', dom.window.DOMParser);
define('XMLSerializer', dom.window.XMLSerializer);
define('Node', dom.window.Node);
define('NodeFilter', dom.window.NodeFilter);
define('Element', dom.window.Element);
define('HTMLElement', dom.window.HTMLElement);
define('Comment', dom.window.Comment);
define('Text', dom.window.Text);
define('DocumentFragment', dom.window.DocumentFragment);
define('getComputedStyle', dom.window.getComputedStyle.bind(dom.window));

/** The bootstrapped window, exported so callers can create throwaway documents. */
export const auditWindow = dom.window;
