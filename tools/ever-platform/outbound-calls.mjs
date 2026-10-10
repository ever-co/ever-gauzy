#!/usr/bin/env node
/**
 * The public list of every call the optional Ever Platform modules can make
 * (docs/ever-platform/outbound-calls.md), generated from the outbound-call rows of the Ever Platform
 * contract at the exact version Gauzy pins, and the checks that keep everything that repeats it in
 * step:
 *
 *   node tools/ever-platform/outbound-calls.mjs --write   regenerate the tables of the docs page
 *   node tools/ever-platform/outbound-calls.mjs --check   exit 1 on any drift:
 *     - the docs page's generated tables differ from what the pinned rows give;
 *     - the request table of the connection's README names another row, or a request that is not
 *       one of its row's; the statistics README does not name its request;
 *     - the rows the egress audit's `every_trigger` run leaves out are not exactly the Gauzy rows
 *       of the contract this release does not make;
 *     - the audit's harness and the modules pin different versions of the contract.
 *
 * The rows come from `@ever-co/connect-tools` as tools/egress-audit/package-lock.json installs it
 * (`npm ci --prefix tools/egress-audit`); `outbound-calls.config.json` says which rows each
 * module makes in this release.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(HERE, '..', '..');
export const DOCS = join(REPO_ROOT, 'docs/ever-platform/outbound-calls.md');
const TOOLS = join(REPO_ROOT, 'tools/egress-audit/node_modules/@ever-co/connect-tools');
const ROWS_FILE = join(TOOLS, 'dist/mock-platform/contracts/generated/outbound-calls.json');
const CONFIG = JSON.parse(readFileSync(join(HERE, 'outbound-calls.config.json'), 'utf8'));

const BEGIN = (name) =>
	`<!-- generated:${name} (node tools/ever-platform/outbound-calls.mjs --write, from the pinned contract; do not edit by hand) -->`;
const END = (name) => `<!-- /generated:${name} -->`;

export function loadRows() {
	if (!existsSync(ROWS_FILE)) throw new Error(`${ROWS_FILE} is missing: run npm ci --prefix tools/egress-audit`);
	const data = JSON.parse(readFileSync(ROWS_FILE, 'utf8'));
	return { version: data.contracts_version, rows: data.rows };
}

const cell = (text) =>
	String(text ?? '')
		.replace(/\|/g, '\\|')
		.replace(/\s+/g, ' ')
		.trim();

/** The endpoints of a row an installation can call against a contract v1 deployment. */
const servedEndpoints = (row) => row.endpoints.filter((e) => e.status !== 'not_in_v1');

/** The rows each module makes, in row order, with the module name. */
export function usedRows(rows, config = CONFIG) {
	const out = [];
	for (const [module, numbers] of Object.entries(config.modules))
		for (const n of numbers) {
			const row = rows.find((r) => r.row === n);
			if (!row) throw new Error(`row ${n} (${module}) is not in the contract`);
			if (!row.products.includes(config.product)) throw new Error(`row ${n} does not apply to ${config.product}`);
			out.push({ module, row });
		}
	return out.sort((a, b) => a.row.row - b.row.row);
}

/** The rows of the contract for the product (up to its phase) this release does not make, with why. */
export function notMade(rows, config = CONFIG) {
	const used = new Set(Object.values(config.modules).flat());
	return rows
		.filter((r) => r.products.includes(config.product) && r.phase <= config.phase && !used.has(r.row))
		.map((r) => ({
			row: r,
			why:
				r.availability === 'not_in_v1'
					? 'not served by version 1 of the Ever Platform API'
					: 'not built in this release'
		}));
}

export function renderUsed(rows, config = CONFIG) {
	const lines = [
		'| # | Module | Request | When | What it carries | How often | How to stop it |',
		'| --- | --- | --- | --- | --- | --- | --- |'
	];
	for (const { module, row } of usedRows(rows, config)) {
		const requests = servedEndpoints(row)
			.map((e) => `\`${e.method} ${e.path}\``)
			.join(', ');
		// Where Gauzy's schedule differs from the contract's description of the row, Gauzy's wins
		// (outbound-calls.config.json `gauzy_rows`): the page says when this installation calls.
		const own = { ...row, ...(config.gauzy_rows?.[String(row.row)] ?? {}) };
		lines.push(
			`| ${row.row} | ${config.module_names[module]} | ${requests} | ${cell(own.trigger)} | ${cell(own.payload)} | ${cell(own.cadence)} | ${cell(own.disable)} |`
		);
	}
	return lines.join('\n');
}

export function renderNotMade(rows, config = CONFIG) {
	const lines = ['| # | Calls | Why Gauzy does not make them |', '| --- | --- | --- |'];
	for (const { row, why } of notMade(rows, config)) lines.push(`| ${row.row} | ${cell(row.title)} | ${why} |`);
	return lines.join('\n');
}

/** Replaces the generated block `name` of `text`. */
export function replaceBlock(text, name, body) {
	const begin = text.indexOf(BEGIN(name));
	const end = text.indexOf(END(name));
	if (begin < 0 || end < begin) throw new Error(`the docs page has no generated block ${name}`);
	return `${text.slice(0, begin)}${BEGIN(name)}\n\n${body}\n\n${text.slice(end)}`;
}

export function renderDocs(text, { rows, version }, config = CONFIG) {
	let out = replaceBlock(
		text,
		'version',
		`Contract version: \`${version}\` (\`@ever-co/connect-contracts\` and \`@ever-co/connect-tools\` at the same version).`
	);
	out = replaceBlock(out, 'calls', renderUsed(rows, config));
	return replaceBlock(out, 'not-made', renderNotMade(rows, config));
}

/** `{row, requests[]}` of the first Markdown table in `text` whose first column is a row number. */
export function readmeTable(text) {
	const out = [];
	for (const line of text.split('\n')) {
		const match = /^\|\s*(\d+)\s*\|([^|]+)\|/.exec(line);
		if (!match) continue;
		out.push({ row: Number(match[1]), requests: [...match[2].matchAll(/`([A-Z]+ [^`]+)`/g)].map((m) => m[1]) });
	}
	return out;
}

/**
 * A Markdown text with its table cells trimmed and its alignment rows reduced to `---`, so a
 * formatter that pads the tables (Prettier) changes nothing the check compares.
 */
export function normalised(text) {
	return text
		.split('\n')
		.map((line) =>
			line.startsWith('|')
				? line
						.split(/(?<!\\)\|/)
						.map((part) => part.trim().replace(/^:?-{3,}:?$/, '---'))
						.join('|')
				: line
		)
		.join('\n');
}

const readJson = (file) => JSON.parse(readFileSync(join(REPO_ROOT, file), 'utf8'));

export function check({ rows, version }, config = CONFIG) {
	const problems = [];
	const docs = readFileSync(DOCS, 'utf8');
	if (normalised(renderDocs(docs, { rows, version }, config)) !== normalised(docs))
		problems.push(
			'docs/ever-platform/outbound-calls.md: the generated tables differ from the pinned contract (run --write)'
		);

	for (const [module, readme] of Object.entries(config.readmes)) {
		const expected = config.modules[module];
		const table = readmeTable(readFileSync(join(REPO_ROOT, readme), 'utf8'));
		const got = table.map((t) => t.row);
		if (JSON.stringify(got) !== JSON.stringify(expected))
			problems.push(
				`${readme}: its request table lists rows ${got.join(', ') || 'none'}, the module makes ${expected.join(', ')}`
			);
		for (const { row, requests } of table) {
			const endpoints = servedEndpoints(rows.find((r) => r.row === row) ?? { endpoints: [] }).map(
				(e) => `${e.method} ${e.path}`
			);
			for (const request of requests)
				if (!endpoints.includes(request))
					problems.push(`${readme}: row ${row} names ${request}, which is not one of its row's`);
			for (const endpoint of endpoints)
				if (!requests.includes(endpoint))
					problems.push(`${readme}: row ${row} does not name ${endpoint}, which the module calls`);
		}
	}

	for (const [module, readme] of Object.entries(config.readme_mentions ?? {})) {
		const text = readFileSync(join(REPO_ROOT, readme), 'utf8');
		for (const n of config.modules[module])
			for (const e of servedEndpoints(rows.find((r) => r.row === n)))
				if (!text.includes(e.path)) problems.push(`${readme}: does not name ${e.method} ${e.path} (row ${n})`);
	}

	const audit = readJson('tools/egress-audit/egress-audit.config.json');
	const excluded = [...(audit.every_trigger_exclude_rows ?? [])].sort((a, b) => a - b);
	const expectedExcluded = notMade(rows, config).map((n) => n.row.row);
	if (JSON.stringify(excluded) !== JSON.stringify(expectedExcluded))
		problems.push(
			`tools/egress-audit/egress-audit.config.json: every_trigger_exclude_rows is [${excluded}], the rows Gauzy does not make are [${expectedExcluded}]`
		);
	if ((audit.phase ?? 2) !== config.phase)
		problems.push(
			`tools/egress-audit/egress-audit.config.json: phase ${audit.phase}, outbound-calls.config.json: ${config.phase}`
		);

	const harness = readJson('tools/egress-audit/package.json').devDependencies['@ever-co/connect-tools'];
	const installed = JSON.parse(readFileSync(join(TOOLS, 'package.json'), 'utf8')).version;
	if (installed !== harness)
		problems.push(
			`tools/egress-audit: @ever-co/connect-tools ${installed} is installed, package.json pins ${harness} (npm ci)`
		);
	for (const plugin of config.plugin_packages) {
		const deps = { ...readJson(plugin).dependencies, ...readJson(plugin).devDependencies };
		for (const name of ['@ever-co/connect-contracts', '@ever-co/connect-sdk', '@ever-co/connect-tools'])
			if (deps[name] && deps[name] !== harness)
				problems.push(`${plugin}: ${name} ${deps[name]}, the egress audit pins ${harness}`);
	}
	return problems;
}

export function main(argv) {
	let contract;
	try {
		contract = loadRows();
	} catch (error) {
		process.stderr.write(`outbound-calls: ${error.message}\n`);
		return 2;
	}
	if (argv.includes('--write')) {
		writeFileSync(DOCS, renderDocs(readFileSync(DOCS, 'utf8'), contract));
		process.stdout.write('outbound-calls: wrote docs/ever-platform/outbound-calls.md\n');
		return 0;
	}
	const problems = check(contract);
	if (problems.length) {
		process.stderr.write(
			`outbound-calls: drift from the pinned contract (${contract.version}):\n  ${problems.join('\n  ')}\n`
		);
		return 1;
	}
	process.stdout.write(
		`outbound-calls: ok (contract ${contract.version}; ${usedRows(contract.rows).length} rows made, ${notMade(contract.rows).length} not made)\n`
	);
	return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
	process.exit(main(process.argv.slice(2)));
