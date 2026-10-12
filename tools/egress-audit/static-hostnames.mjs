#!/usr/bin/env node
// cspell:words gzip
/**
 * The static half of the egress audit: no code outside the Ever Platform modules names an Ever host
 * or an Ever Platform base URL variable it did not name before the modules, in the sources and in
 * the built web app.
 *
 * Ever hosts are the `ever_owned` names of the harness's never-allowed list (`ever-hosts.json` of
 * `@ever-co/connect-tools`, installed here with `npm ci`) and every name under them. Gauzy names
 * many of them on purpose (the product site, legal pages, documentation, demo accounts, download
 * links): those occurrences are recorded in `static-hostnames.baseline.json`, which may only shrink.
 *
 *   node tools/egress-audit/static-hostnames.mjs
 *       the files git tracks, outside the module directories (ALLOWED below), against the `code`
 *       part of the baseline: per file and host, never more occurrences than recorded
 *   node tools/egress-audit/static-hostnames.mjs --bundle <dir>
 *       every text file of a built web app (the `/srv/gauzy` of the web app image), against the
 *       `bundle` part: never a host that is not recorded (file names and counts change with every
 *       build; a new host does not)
 *   node tools/egress-audit/static-hostnames.mjs --check-shrink <file>
 *       the baseline only lost entries (or occurrences) since the base of the change, <file>
 *       being the baseline at the base (git show <base>:tools/egress-audit/static-hostnames.baseline.json)
 *   node tools/egress-audit/static-hostnames.mjs --write [--bundle <dir>] [--first-version]
 *       rewrites the baseline from the tree (or the bundle); refuses to grow it unless
 *       --first-version (the change that adds the baseline)
 *   node tools/egress-audit/static-hostnames.mjs --fixture <dir>
 *       scans <dir> as a tree of its own with an empty baseline (the known-bad fixture)
 *
 * Exit 0 when clean, 1 naming every new occurrence, 2 on a usage error.
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hostsInText, isEverOwned, loadEverHosts, normaliseHost } from '@ever-co/connect-tools/egress-audit/hosts';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(HERE, '..', '..');
export const BASELINE_FILE = join(HERE, 'static-hostnames.baseline.json');

/**
 * Where an Ever host may be named: the modules themselves, their docs, the audit and its checks,
 * prose (Markdown) and tests. Everything else is core code.
 */
export const ALLOWED = [
	'packages/plugins/ever-connect/',
	'packages/plugins/ever-connect-ui/',
	'packages/plugins/ever-stats/',
	'packages/plugins/ever-stats-ui/',
	'packages/plugins/ever-instance/',
	'docs/ever-platform/',
	'tools/egress-audit/',
	'tools/ever-platform/',
	'**/*.md',
	'**/*.spec.ts',
	'**/*.e2e-spec.ts',
	'**/*.test.*',
	'apps/gauzy-e2e/'
];

/** The Ever Platform base URL variables: only the modules read them. */
export const VARIABLES = ['EVER_PLATFORM_API_URL', 'EVER_STATS_API_URL'];

/** Files that hold code or configuration a build or a container reads. */
const TEXT =
	/\.(m?[jt]sx?|cjs|cts|mts|json|ya?ml|html?|s?css|less|hbs|mjml|ejs|env|sample|example|conf|toml|xml|sh|webmanifest)$|(^|\/)(Dockerfile[^/]*|\.env[^/]*)$/;

/** Lock files name package registries, never a host the product calls. */
const SKIP = /(^|\/)(yarn\.lock|package-lock\.json|pnpm-lock\.yaml)$/;

/** A minimal glob: `dir/` prefixes and `**\/*.ext` suffix patterns. */
export function allowed(file, patterns = ALLOWED) {
	return patterns.some((p) => {
		if (p.startsWith('**/')) {
			const quote = (s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
			const tail = p.slice(3).split('*').map(quote).join('[^/]*');
			return new RegExp(`(^|/)${tail}$`).test(file);
		}
		return p.endsWith('/') ? file.startsWith(p) : file === p;
	});
}

/** The Ever hosts and base URL variables a text names, with their counts. */
export function occurrences(text, lists = loadEverHosts()) {
	let counts = {};
	const add = (key) => (counts[key] = (counts[key] ?? 0) + 1);
	for (const host of hostsInText(text)) if (isEverOwned(host, lists)) add(normaliseHost(host));
	for (const variable of VARIABLES)
		for (let n = text.split(new RegExp(String.raw`\b${variable}\b`)).length - 1; n > 0; n--) add(variable);
	return counts;
}

/** Code-unit order (what Array#sort does without a compare function), stated explicitly. */
export function byCodeUnit(a, b) {
	if (a < b) return -1;
	if (a > b) return 1;
	return 0;
}

/** Directories that hold no source of the product: dependencies, build output, caches. */
const SKIP_DIRS = new Set([
	'node_modules',
	'.git',
	'dist',
	'build',
	'out-tsc',
	'coverage',
	'.angular',
	'.nx',
	'.cache',
	'tmp'
]);

/** Every file under `root`, outside SKIP_DIRS (in CI the checkout holds exactly the tracked files). */
function walk(root, skip = SKIP_DIRS) {
	const out = [];
	const visit = (dir) => {
		for (const name of readdirSync(dir)) {
			if (skip.has(name)) continue;
			const p = join(dir, name);
			if (statSync(p).isDirectory()) visit(p);
			else out.push(relative(root, p).split(sep).join('/'));
		}
	};
	visit(root);
	return out.sort(byCodeUnit);
}

/** `{file: {host: count}}` of the core code under `root` (outside ALLOWED). */
export function scanCode(root, { patterns = ALLOWED, files = walk(root) } = {}) {
	const lists = loadEverHosts();
	const found = {};
	for (const file of files) {
		if (!TEXT.test(file) || SKIP.test(file) || allowed(file, patterns)) continue;
		let text;
		try {
			text = readFileSync(join(root, file), 'utf8');
		} catch {
			continue; // a file deleted in the working copy
		}
		const counts = occurrences(text, lists);
		if (Object.keys(counts).length) found[file] = counts;
	}
	return found;
}

/** The sorted Ever hosts and variables named anywhere in a built web app. */
export function scanBundle(dir) {
	const lists = loadEverHosts();
	const hosts = new Set();
	for (const file of walk(dir, new Set())) {
		if (!/\.(m?js|html?|css|json|txt|webmanifest|svg)$/.test(file)) continue;
		for (const key of Object.keys(occurrences(readFileSync(join(dir, file), 'utf8'), lists))) hosts.add(key);
	}
	return [...hosts].sort(byCodeUnit);
}

/** What `found` has beyond `baseline` (both `{file: {host: count}}`): `file host now (recorded n)`. */
export function codeGrowth(found, baseline = {}) {
	const out = [];
	for (const [file, counts] of Object.entries(found))
		for (const [host, count] of Object.entries(counts)) {
			const recorded = baseline[file]?.[host] ?? 0;
			if (count > recorded) out.push(`${file}: ${host} x${count} (recorded: ${recorded})`);
		}
	return out;
}

/** The hosts of `found` that `recorded` does not have. */
export const bundleGrowth = (found, recorded = []) => found.filter((host) => !recorded.includes(host));

export function readBaseline(file = BASELINE_FILE) {
	if (!existsSync(file)) return { code: {}, bundle: { hosts: [] } };
	const data = JSON.parse(readFileSync(file, 'utf8'));
	return { ...data, code: data.code ?? {}, bundle: { hosts: data.bundle?.hosts ?? [], ...data.bundle } };
}

const DESCRIPTION =
	'Ever hosts (and Ever Platform base URL variables) that Gauzy code outside the Ever Platform modules named before the modules: the product site, legal pages, documentation, demo accounts, downloads. Written by `node tools/egress-audit/static-hostnames.mjs --write`; it may only shrink (checked against the base of every pull request). `code`: per tracked file and host, the occurrences; `bundle`: the hosts the built web app names.';

function writeBaseline(next, file = BASELINE_FILE) {
	const sorted = Object.fromEntries(
		Object.keys(next.code)
			.sort(byCodeUnit)
			.map((f) => [f, Object.fromEntries(Object.entries(next.code[f]).sort(([a], [b]) => byCodeUnit(a, b)))])
	);
	const body = {
		description: DESCRIPTION,
		code: sorted,
		bundle: {
			...(next.bundle.image ? { image: next.bundle.image } : {}),
			hosts: [...next.bundle.hosts].sort(byCodeUnit)
		}
	};
	writeFileSync(file, `${JSON.stringify(body, null, '\t')}\n`);
}

export function main(
	argv,
	{ log = (s) => process.stdout.write(`${s}\n`), err = (s) => process.stderr.write(`${s}\n`) } = {}
) {
	const arg = (name) => {
		const i = argv.indexOf(`--${name}`);
		return i >= 0 ? argv[i + 1] : undefined;
	};
	const flag = (name) => argv.includes(`--${name}`);
	const root = resolve(arg('root') ?? REPO_ROOT);

	if (flag('fixture')) {
		const dir = resolve(arg('fixture') ?? '');
		const growth = codeGrowth(scanCode(dir, { patterns: [], files: walk(dir) }), {});
		if (growth.length) {
			err(`static-hostnames: Ever hosts outside the Ever Platform modules:\n  ${growth.join('\n  ')}`);
			return 1;
		}
		log('static-hostnames: ok (fixture)');
		return 0;
	}

	const baseline = readBaseline();

	if (flag('check-shrink')) {
		// The baseline as it is at the base of the change (`git show <base>:<path> > file`); a missing
		// or empty file means the baseline is new.
		const baseFile = arg('check-shrink');
		if (!baseFile) {
			err('static-hostnames: --check-shrink <the baseline file at the base>');
			return 2;
		}
		let before = null;
		try {
			const text = existsSync(resolve(baseFile)) ? readFileSync(resolve(baseFile), 'utf8') : '';
			before = text.trim() ? JSON.parse(text) : null;
		} catch (error) {
			err(`static-hostnames: ${baseFile} could not be read: ${error.message}`);
			return 2;
		}
		const ref = 'the base';
		if (!before) {
			log('static-hostnames: the baseline is new (its first version)');
			return 0;
		}
		const grown = [
			...codeGrowth(baseline.code, before.code ?? {}),
			...bundleGrowth(baseline.bundle.hosts, before.bundle?.hosts ?? []).map((h) => `bundle: ${h}`)
		];
		if (grown.length) {
			err(`static-hostnames: the baseline may only shrink; grown since ${ref}:\n  ${grown.join('\n  ')}`);
			return 1;
		}
		log(`static-hostnames: the baseline only shrank since ${ref}`);
		return 0;
	}

	const bundleDir = arg('bundle');
	if (flag('write')) {
		const next = { code: baseline.code, bundle: baseline.bundle };
		let grown;
		if (bundleDir) {
			next.bundle = { hosts: scanBundle(resolve(bundleDir)), ...(arg('image') ? { image: arg('image') } : {}) };
			grown = bundleGrowth(next.bundle.hosts, baseline.bundle.hosts);
		} else {
			next.code = scanCode(root);
			grown = codeGrowth(next.code, baseline.code);
		}
		if (grown.length && !flag('first-version') && existsSync(BASELINE_FILE)) {
			err(`static-hostnames: --write would grow the baseline (it may only shrink):\n  ${grown.join('\n  ')}`);
			return 1;
		}
		writeBaseline(next);
		log(`static-hostnames: wrote ${relative(root, BASELINE_FILE)}`);
		return 0;
	}

	if (bundleDir) {
		const found = scanBundle(resolve(bundleDir));
		const grown = bundleGrowth(found, baseline.bundle.hosts);
		if (grown.length) {
			err(
				`static-hostnames: the built web app names Ever hosts the baseline does not have (core code must not call or link Ever hosts; the modules' own hosts come from the modules):\n  ${grown.join('\n  ')}`
			);
			return 1;
		}
		log(`static-hostnames: ok (bundle: ${found.length} Ever host(s), all recorded)`);
		return 0;
	}

	const found = scanCode(root);
	const grown = codeGrowth(found, baseline.code);
	if (grown.length) {
		err(
			`static-hostnames: Ever hosts (or Ever Platform base URL variables) outside the Ever Platform modules that the baseline does not have. Only the modules (${ALLOWED.slice(0, 5).join(', ')}) may name them; move the call into a module:\n  ${grown.join('\n  ')}`
		);
		return 1;
	}
	const files = Object.keys(found).length;
	log(`static-hostnames: ok (${files} core file(s) name Ever hosts, none beyond the baseline)`);
	return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
	process.exit(main(process.argv.slice(2)));
