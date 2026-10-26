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
 * the Terms) whose URL that page's vendored document writes as the `href` of a link (`<a>`, `<area>`;
 * not in a comment), compared as the browser leg records it (character references decoded, then the
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

/** The character references an HTML attribute value may hold, decoded as the browser decodes them. */
const NAMED = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' };
export function decodeAttribute(value) {
	return value.replace(/&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/gi, (all, dec, hex, name) => {
		if (dec !== undefined || hex !== undefined) {
			const code = dec !== undefined ? Number.parseInt(dec, 10) : Number.parseInt(hex, 16);
			return code <= 0x10ffff ? String.fromCodePoint(code) : all;
		}
		return NAMED[name.toLowerCase()] ?? all;
	});
}

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

/** An `<a>` or `<area>` start tag, quote-aware (a `>` inside a quoted value does not end it). */
const LINK_TAG = /<(?:a|area)\b((?:[^>"']|"[^"]*"|'[^']*')*)>/gi;

/**
 * The attributes of a start tag (the text after its name), read one after the other so a quoted
 * value is never searched for another attribute; names lower-cased, the first of a repeated name
 * kept, as the browser keeps it. Reading stops at markup it cannot parse.
 */
export function attributes(source) {
	const out = new Map();
	const attribute = /[\s/]*([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/y;
	while (attribute.lastIndex < source.length) {
		const m = attribute.exec(source);
		if (!m) break;
		const name = m[1].toLowerCase();
		if (!out.has(name)) out.set(name, m[2] ?? m[3] ?? m[4] ?? '');
	}
	return out;
}

/**
 * The absolute `href` values the links of a vendored document write, as the browser leg records
 * them. Comments are dropped first, so a commented-out link counts for nothing.
 */
export function hrefs(text) {
	const out = new Set();
	const markup = text.replace(/<!--[\s\S]*?-->/g, '');
	for (const [, source] of markup.matchAll(LINK_TAG)) {
		const href = attributes(source).get('href');
		const url = href === undefined ? null : recorded(decodeAttribute(href));
		if (url) out.add(url);
	}
	return out;
}

/** The `href` values of a vendored document (`hrefs` of its file), or null when it has no file. */
export function readDocument(document, root = REPO_ROOT) {
	const file = join(root, CONTENT_DIR, `${document}.en.generated.ts`);
	return existsSync(file) ? hrefs(readFileSync(file, 'utf8')) : null;
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
