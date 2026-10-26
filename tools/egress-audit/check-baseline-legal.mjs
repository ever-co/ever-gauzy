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
 * Passes when the baseline existed at the base under the same path, base_commit is unchanged, every
 * entry has the shape of the harness's schema, and every entry added since the base is an `href` on a
 * legal page of the route list (/legal/<page> or /pages/legal/<page>, and /legal and /pages/legal,
 * which redirect to the Terms) whose URL that page's vendored document writes as an `href`. A link the
 * document does not write, the same link on any other route and any other attribute still fail, and
 * an entry still excuses only that link on that route, never a lookup or a request. Exit 0, 1 naming
 * each entry it does not cover, 2 on a usage error.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

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
const ENTRY_KEYS = ['route', 'attribute', 'url', 'reason'];

const key = (e) => `${e.route}|${e.attribute}|${e.url}`;
const show = (e) => `${e.route} ${e.attribute} ${e.url}`;

/** A URL as the browser writes it (`https://gauzy.co` -> `https://gauzy.co/`); null when it is none. */
function normal(url) {
	try {
		return new URL(url).href;
	} catch {
		return null;
	}
}

/** The corpus document a route renders, or null when the route is not a legal page. */
export function documentOf(route) {
	const m = LEGAL_ROUTE.exec(route);
	if (!m) return null;
	return Object.hasOwn(PAGES, m[1] ?? '') ? PAGES[m[1] ?? ''] : null;
}

/** The absolute `href` values a vendored document writes, as the browser writes them. */
export function hrefs(text) {
	const out = new Set();
	for (const m of text.matchAll(/\bhref="([^"]+)"/g)) {
		const url = normal(m[1]);
		if (url && /^https?:/.test(url)) out.add(url);
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
	const url = normal(entry.url);
	if (!document || !url) return false;
	return hrefsOf(document)?.has(url) ?? false;
}

/** The schema problems this check repeats from the harness, so a fallback to it cannot hide them. */
export function shapeProblems(doc) {
	const problems = [];
	if (typeof doc?.base_commit !== 'string' || !/^[0-9a-f]{7,40}$/.test(doc.base_commit))
		problems.push('base_commit is not a commit SHA');
	if (!Array.isArray(doc?.entries)) return [...problems, 'entries is not an array'];
	doc.entries.forEach((e, i) => {
		const keys = e && typeof e === 'object' ? Object.keys(e) : [];
		if (keys.length !== ENTRY_KEYS.length || !ENTRY_KEYS.every((k) => typeof e[k] === 'string' && e[k].length > 0))
			problems.push(`entries/${i} is not {route, attribute, url, reason} with non-empty strings`);
	});
	return problems;
}

/**
 * The verdict on a baseline (`current`) against the one at the base (`base`, null when the base has
 * none). `path` and `pathAtBase` are the baseline paths the config names now and at the base;
 * `hrefsOf(document)` answers the links a vendored document writes.
 */
export function check({ current, base, path, pathAtBase, hrefsOf }) {
	if (pathAtBase !== null && pathAtBase !== path)
		return { exit: 1, problems: [`the baseline moved since the base (${pathAtBase} -> ${path})`] };
	if (!base) return { exit: 1, problems: [`${path} is new since the base: this exception covers growth only`] };
	const problems = shapeProblems(current).map((p) => `${path} ${p}`);
	if (problems.length) return { exit: 1, problems };
	if (current.base_commit !== base.base_commit)
		return { exit: 1, problems: ['base_commit changed; it is fixed once the baseline exists'] };
	const before = new Set((base.entries ?? []).map(key));
	const added = current.entries.filter((e) => !before.has(key(e)));
	const unknown = added.filter((e) => !covered(e, hrefsOf));
	if (unknown.length)
		return {
			exit: 1,
			problems: [
				'entries that are not a link the vendored legal document of their legal page writes (only those may be added):\n  ' +
					unknown.map(show).join('\n  ')
			]
		};
	return { exit: 0, problems: [], added: added.length };
}

function git(args) {
	return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

/** A repository path at a ref, or null when it does not exist there. */
function showAt(ref, path) {
	try {
		git(['cat-file', '-e', `${ref}:${path}`]);
	} catch {
		return null;
	}
	return git(['show', `${ref}:${path}`]);
}

const repoPath = (abs) => relative(REPO_ROOT, abs).split(sep).join('/');
const baselinePathOf = (config, configFile) => resolve(dirname(configFile), config?.ui_baseline ?? 'ui-baseline.json');

export function main(
	argv,
	io = { log: (s) => process.stdout.write(`${s}\n`), err: (s) => process.stderr.write(`${s}\n`) }
) {
	const arg = (name) => {
		const i = argv.indexOf(`--${name}`);
		return i >= 0 ? argv[i + 1] : undefined;
	};
	const ref = arg('base');
	const configFile = resolve(arg('config') ?? DEFAULT_CONFIG);
	if (!ref) {
		io.err('check-baseline-legal: --base <git ref> is required');
		return 2;
	}
	let verdict;
	try {
		git(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);
		const config = JSON.parse(readFileSync(configFile, 'utf8'));
		const path = repoPath(baselinePathOf(config, configFile));
		const configAtBase = showAt(ref, repoPath(configFile));
		const pathAtBase =
			configAtBase === null ? null : repoPath(baselinePathOf(JSON.parse(configAtBase), configFile));
		const baseText = showAt(ref, path);
		const documents = new Map();
		verdict = check({
			current: JSON.parse(readFileSync(join(REPO_ROOT, path), 'utf8')),
			base: baseText === null ? null : JSON.parse(baseText),
			path,
			pathAtBase,
			hrefsOf: (d) => {
				if (!documents.has(d)) documents.set(d, readDocument(d));
				return documents.get(d);
			}
		});
	} catch (error) {
		io.err(`check-baseline-legal: ${String(error.stderr ?? '').trim() || error.message}`);
		return 2;
	}
	for (const p of verdict.problems) io.err(`check-baseline-legal: ${p}`);
	if (verdict.exit === 0)
		io.log(
			`check-baseline-legal: ok (${verdict.added} entries added, each a link the vendored legal document of its legal page writes)`
		);
	return verdict.exit;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
	process.exit(main(process.argv.slice(2)));
