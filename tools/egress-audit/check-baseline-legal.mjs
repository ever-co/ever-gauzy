#!/usr/bin/env node
/**
 * The standing exception to "ui-baseline.json may only shrink": the links a legal document vendored
 * from the `@ever-co/legal` corpus writes, on the legal page that renders that document.
 *
 * Those documents (packages/plugins/legal-ui/src/lib/content/<document>.en.generated.ts) are written
 * by packages/plugins/legal-ui/scripts/sync-legal-content.mjs, never by hand: the publisher's prose,
 * with its own addresses and links in it, rendered without a request. A re-sync of the corpus can add
 * a link (the DPIA Support Pack of @ever-co/legal 0.5.0 links the Data Processing Addendum, the
 * Privacy Policy, the sub-processor list and the Security page on gauzy.co), and the static scan
 * exempts the same files for the same reason (`ALLOWED` in static-hostnames.mjs). The workflow runs
 * this only when the harness's check-baseline-shrink reports growth (exit 1):
 *
 *   node tools/egress-audit/check-baseline-legal.mjs --base <git ref> [--config <egress-audit.config.json>]
 *
 * It runs the harness's own check again and passes only when growth is the one problem it reports: a
 * moved or new baseline, a changed or foreign base_commit and a schema violation stay failures. Then
 * every entry added since the base (the harness's `addedEntries`) must be an `href` on a legal page of
 * the route list (/legal/<page> or /pages/legal/<page>, and /legal and /pages/legal, which redirect to
 * the Terms) whose URL that page's vendored document writes as the `href` of an `<a>` (read strictly,
 * see `hrefs`), compared as the browser leg records it (character references decoded, then the
 * harness's `redactUrl`: query values and the fragment dropped). A link the document does not write,
 * the same link on any other route and any other attribute still fail, and an entry still excuses
 * only that link on that route, never a lookup or a request. Exit 0, 1 naming what it does not cover,
 * 2 on a usage error.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { addedEntries, check as harnessCheck } from '@ever-co/connect-tools/egress-audit/check-baseline-shrink';
import { redactUrl } from '@ever-co/connect-tools/egress-audit/har';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(HERE, '..', '..');
const DEFAULT_CONFIG = join(HERE, 'egress-audit.config.json');

/** Where the vendored documents are, relative to the repository root. */
export const CONTENT_DIR = 'packages/plugins/legal-ui/src/lib/content';

/**
 * The legal pages (packages/plugins/legal-ui/src/lib/legal.routes.ts and page-legal.routes.ts) and the
 * corpus document each renders: the Terms page renders `tos`, the others the document of their
 * `data.documents`, and the bare /legal redirects to the Terms.
 */
export const PAGES = Object.freeze({ '': 'tos', terms: 'tos', privacy: 'privacy', cookies: 'cookies', dpia: 'dpia' });

const LEGAL_ROUTE = /^\/(?:pages\/)?legal(?:\/([a-z-]+))?$/;

const show = (e) => `${e.route} ${e.attribute} ${e.url}`;

/**
 * An attribute value as the browser reads it, for the one character reference the corpus writes in
 * a URL (`&amp;`); null for any other `&`, whose reading depends on HTML's reference tables (the
 * strict reader then reads no link from the document).
 */
export function decodeAttribute(value) {
	const decoded = value.split('&amp;');
	return decoded.some((part) => part.includes('&')) ? null : decoded.join('&');
}

/** HTML's whitespace between a tag's name and its attributes (ASCII only, unlike `\s`). */
const WS = '[\\t\\n\\f\\r ]';

/**
 * A URL as the browser leg records it: resolved (`https://gauzy.co` -> `https://gauzy.co/`), then the
 * harness's `redactUrl` (query values, the fragment and user info dropped); null when it is not an
 * absolute http(s) URL.
 */
export function recorded(url) {
	try {
		const u = new URL(url);
		return /^https?:$/.test(u.protocol) ? redactUrl(u.href) : null;
	} catch {
		return null;
	}
}

/** The corpus document a route renders, or null when the route is not a legal page. */
export function documentOf(route) {
	const m = LEGAL_ROUTE.exec(route);
	if (!m) return null;
	const page = m[1] ?? '';
	return Object.hasOwn(PAGES, page) ? PAGES[page] : null;
}

/**
 * The elements the corpus's Markdown renders to (the vendored documents use a subset of them, with
 * `id`, `tabindex` and `href` as their only attributes). A document with any other markup is read
 * as having no link at all.
 */
const MARKDOWN_ELEMENTS = new Set(
	'a b blockquote br code dd del div dl dt em h1 h2 h3 h4 h5 h6 hr i li ol p pre s span strong sub sup table tbody td tfoot th thead tr ul'.split(
		' '
	)
);

/**
 * One tag of that markup, read from a `<`: its whole lower-case name and double-quoted attributes
 * whose values hold no `<`, `>` or `"`.
 */
const TAG = new RegExp(`<(/?)([a-z][a-z0-9]*)((?:${WS}+[a-z][a-z0-9-]*="[^"<>]*")*)${WS}*/?>`, 'y');
const ATTRIBUTE = new RegExp(`${WS}+([a-z][a-z0-9-]*)="([^"<>]*)"`, 'g');

/**
 * The absolute `href` values the `<a>` links of a vendored document write, as the browser leg records
 * them; null when the document is not the plain markup the corpus renders to.
 *
 * The reader is strict on purpose, instead of being a partial HTML parser: every `<` must open a tag
 * of MARKDOWN_ELEMENTS with double-quoted attributes that hold no `<` or `>`. So nothing link-shaped
 * can hide where the browser makes no link (a comment, another attribute's value, a `<template>`,
 * the text of a `<textarea>` or `<script>`, a custom element): any such markup makes the whole
 * document unreadable, and then it excuses nothing (the exception fails closed).
 */
export function hrefs(html) {
	const out = new Set();
	const tag = new RegExp(TAG.source, 'y');
	for (let at = html.indexOf('<'); at >= 0; at = html.indexOf('<', tag.lastIndex)) {
		tag.lastIndex = at;
		const m = tag.exec(html);
		if (!m || !MARKDOWN_ELEMENTS.has(m[2])) return null;
		if (m[1] || m[2] !== 'a') continue;
		const href = [...m[3].matchAll(ATTRIBUTE)].find(([, name]) => name === 'href')?.[2];
		const value = href === undefined ? null : decodeAttribute(href);
		// An href this reader cannot decode (a character reference other than &amp;) excuses nothing.
		const url = value === null ? null : recorded(value);
		if (url) out.add(url);
	}
	return out;
}

/**
 * The HTML a generated document renders: its `html` template literal, unescaped as
 * sync-legal-content.mjs escapes it (a backslash, a backtick and `${` get a backslash); null when the
 * source has none. Nothing else of the file (its header comment, its other fields) is rendered.
 */
export function htmlOf(source) {
	const m = /^\s*html:\s*`((?:[^`\\]|\\[\s\S])*)`/m.exec(source);
	return m ? m[1].replace(/\\([\\`$])/g, '$1') : null;
}

/**
 * The `href` values of a vendored document (`hrefs` of its `html`); null when it has no file, no
 * `html`, or markup the strict reader does not read.
 */
export function readDocument(document, root = REPO_ROOT) {
	const file = join(root, CONTENT_DIR, `${document}.en.generated.ts`);
	if (!existsSync(file)) return null;
	const html = htmlOf(readFileSync(file, 'utf8'));
	return html === null ? null : hrefs(html);
}

/** Whether an added entry is a link its legal page's vendored document writes. */
export function covered(entry, hrefsOf) {
	if (entry.attribute !== 'href') return false;
	const document = documentOf(entry.route);
	const url = recorded(entry.url);
	if (!document || !url) return false;
	return hrefsOf(document)?.has(url) ?? false;
}

/**
 * The verdict on a baseline (`current`) against the one at the base (`base`), given the harness's own
 * verdict on it (`harness`, from check-baseline-shrink's `check`) and the baseline's repository path
 * (`path`). `hrefsOf(document)` answers the links a vendored document writes.
 */
export function legalVerdict({ harness, current, base, path, hrefsOf }) {
	if (harness.exit === 0) return { exit: 0, problems: [], added: 0 };
	const growth = `${path} may only shrink; added since `;
	const other = harness.problems.filter((p) => !p.startsWith(growth));
	if (harness.exit !== 1 || other.length > 0 || harness.problems.length === 0 || !base)
		return {
			exit: harness.exit === 2 ? 2 : 1,
			problems: [
				'the harness reports more than growth, which this exception never covers:',
				...(other.length ? other : harness.problems)
			]
		};
	const added = addedEntries(current, base);
	const unknown = added.filter((e) => !covered(e, hrefsOf));
	if (unknown.length || added.length === 0)
		return {
			exit: 1,
			problems: [
				'entries that are not a link the vendored legal document of their legal page writes (only those may be added):\n  ' +
					unknown.map(show).join('\n  ')
			]
		};
	return { exit: 0, problems: [], added: added.length };
}

export function main(
	argv,
	io = { log: (s) => process.stdout.write(`${s}\n`), err: (s) => process.stderr.write(`${s}\n`) }
) {
	const arg = (name) => {
		const i = argv.indexOf(`--${name}`);
		return i >= 0 ? argv[i + 1] : undefined;
	};
	const ref = arg('base');
	const config = arg('config') ?? DEFAULT_CONFIG;
	if (!ref) {
		io.err('check-baseline-legal: --base <git ref> is required');
		return 2;
	}
	let verdict;
	try {
		const harness = harnessCheck({ base: ref, config });
		const settings = JSON.parse(readFileSync(resolve(config), 'utf8'));
		const file = resolve(dirname(resolve(config)), settings.ui_baseline ?? 'ui-baseline.json');
		const path = relative(REPO_ROOT, file).split(sep).join('/');
		const growth = harness.problems.find((p) => p.startsWith(`${path} may only shrink; added since `));
		const documents = new Map();
		verdict = legalVerdict({
			harness,
			current: JSON.parse(readFileSync(file, 'utf8')),
			// The harness read the base and found growth only: the file exists there.
			base: growth ? JSON.parse(gitShow(ref, path)) : null,
			path,
			hrefsOf: (d) => {
				if (!documents.has(d)) documents.set(d, readDocument(d));
				return documents.get(d);
			}
		});
	} catch (error) {
		io.err(`check-baseline-legal: ${error.message}`);
		return 2;
	}
	for (const p of verdict.problems) io.err(`check-baseline-legal: ${p}`);
	if (verdict.exit === 0)
		io.log(
			`check-baseline-legal: ok (${verdict.added} entries added, each a link the vendored legal document of its legal page writes)`
		);
	return verdict.exit;
}

/** A repository file at a ref. */
function gitShow(ref, path) {
	return execFileSync('git', ['show', `${ref}:${path}`], { cwd: REPO_ROOT, encoding: 'utf8' });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
	process.exit(main(process.argv.slice(2)));
