#!/usr/bin/env node
/**
 * Gate: every GraphQL field that names an organization runs the organization-membership rule.
 *
 * REST refuses an `organizationId` the caller does not belong to through `@IsOrganizationBelongsToUser()` on its DTOs
 * (GHSA-44pv-34gx-q9p4). GraphQL runs no class-validator on resolver arguments, so the rule was absent from all ~450
 * root fields that take an `organizationId` (R7-03, security review of #10254) until
 * `GraphqlOrganizationMembershipInterceptor` applied it to every GraphQL operation, globally. A rule applied globally
 * fails in two quiet ways, and this gate watches both:
 *
 *   1. **the interceptor stops being global** — it must stay an `APP_INTERCEPTOR` of `AppModule`, registered before
 *      the idempotency interceptor, and keep making the REST validator's own lookup (`checkOrganizationExistence`);
 *   2. **a field escapes it** — the interceptor does not check `@Public()` fields (their REST twins never run the
 *      validator, which fails closed without a user). So every public root field whose arguments reach an
 *      `organizationId` must be listed in `PUBLIC_EXEMPT` below with the reason it is safe; a new one fails until
 *      someone has looked at it, and a listed field that no longer takes an organization (or is no longer public)
 *      fails as stale.
 *
 * It reads the committed composed schema (`schema.graphql`) for the arguments and the resolver sources for
 * `@Public()`, with `node:fs` only, like the other platform gates.
 *
 * Run from the repository root: `node tools/scripts/graphql-organization-membership-check.mjs`
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const SCHEMA = join(ROOT, 'packages', 'core', 'src', 'lib', 'graphql', 'schema', 'schema.graphql');
const APP_MODULE = join(ROOT, 'packages', 'core', 'src', 'lib', 'app', 'app.module.ts');
const INTERCEPTOR = join(ROOT, 'packages', 'core', 'src', 'lib', 'graphql', 'graphql-organization-membership.interceptor.ts');
const RESOLVER_ROOTS = [join(ROOT, 'packages', 'core', 'src'), join(ROOT, 'packages', 'plugins')];

/**
 * Public root fields that take an organization, with the reason they are safe without the membership rule. Keyed
 * `<Operation>.<field>`.
 */
const PUBLIC_EXEMPT = {
};

let failures = [];

/* -------- 1. the interceptor is global, early, and makes the REST validator's lookup -------- */

const appModule = readFileSync(APP_MODULE, 'utf8');
const registeredAt = appModule.indexOf('useClass: GraphqlOrganizationMembershipInterceptor');
const idempotencyAt = appModule.indexOf('useClass: IdempotencyInterceptor');
if (registeredAt === -1 || !appModule.slice(appModule.lastIndexOf('provide:', registeredAt), registeredAt).includes('APP_INTERCEPTOR')) {
	failures.push('app.module.ts no longer registers GraphqlOrganizationMembershipInterceptor as an APP_INTERCEPTOR');
} else if (idempotencyAt !== -1 && registeredAt > idempotencyAt) {
	failures.push('app.module.ts registers GraphqlOrganizationMembershipInterceptor after IdempotencyInterceptor');
}
let interceptor = '';
try {
	interceptor = readFileSync(INTERCEPTOR, 'utf8');
} catch {
	failures.push('graphql-organization-membership.interceptor.ts is missing');
}
if (interceptor && !/checkOrganizationExistence\(/.test(interceptor)) {
	failures.push('the interceptor no longer makes the REST validator’s lookup (checkOrganizationExistence)');
}

/* -------- 2. which root fields take an organization -------- */

/**
 * The root fields of an SDL document whose arguments reach an `organizationId`, as `<Operation>.<field>`.
 *
 * Reachability is a fixpoint, not a cached depth-first walk: input types can refer to each other
 * (`A { b: B, organizationId: ID }`, `B { a: A }`), and a walk that caches "does not reach" for a type it only
 * left because of the cycle would answer `false` for `B` forever (Greptile on #10582). Starting from the inputs that
 * declare `organizationId` themselves and adding every input with a field of a reaching type until nothing changes
 * gives the same answer whatever order the fields are read in.
 *
 * @param text - The SDL.
 * @returns The root fields that take an organization.
 */
function fieldsTakingOrganization(text) {
	// Without descriptions, strings, comments and directives, so only structure is left.
	const sdl = text
		.replace(/"""[\s\S]*?"""/g, ' ')
		.replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
		.replace(/#[^\n]*/g, ' ')
		.replace(/@\w+(?:\([^)]*\))?/g, ' ');

	let blocks = new Map(); // `type:Name` / `input:Name` → body
	for (const match of sdl.matchAll(/(?:extend\s+)?(type|input)\s+(\w+)[^{]*\{([^}]*)\}/g)) {
		const key = `${match[1]}:${match[2]}`;
		blocks.set(key, (blocks.get(key) ?? '') + '\n' + match[3]);
	}

	// `name: Type` pairs of each input type, named type only.
	let inputFields = new Map();
	for (const [key, body] of blocks) {
		if (!key.startsWith('input:')) continue;
		let fields = new Map();
		for (const field of body.matchAll(/(\w+)\s*:\s*\[*\s*(\w+)/g)) fields.set(field[1], field[2]);
		inputFields.set(key.slice(6), fields);
	}

	let reaching = new Set([...inputFields].filter(([, fields]) => fields.has('organizationId')).map(([name]) => name));
	for (let changed = true; changed; ) {
		changed = false;
		for (const [name, fields] of inputFields) {
			if (!reaching.has(name) && [...fields.values()].some((type) => reaching.has(type))) {
				reaching.add(name);
				changed = true;
			}
		}
	}

	let found = new Set();
	for (const operation of ['Query', 'Mutation', 'Subscription']) {
		const body = blocks.get(`type:${operation}`) ?? '';
		for (const field of body.matchAll(/(\w+)\s*(?:\(([^)]*)\))?\s*:\s*[\[\]\w!]+/g)) {
			const args = [...(field[2] ?? '').matchAll(/(\w+)\s*:\s*\[*\s*(\w+)/g)];
			if (args.some(([, name, type]) => name === 'organizationId' || reaching.has(type))) {
				found.add(`${operation}.${field[1]}`);
			}
		}
	}
	return found;
}

// The reader checks itself first: two inputs that refer to each other, read with the root fields in both orders.
for (const order of [['viaA', 'viaB'], ['viaB', 'viaA']]) {
	const fixture = `
		input A { b: B, organizationId: ID }
		input B { a: A }
		input C { name: String }
		type Query { ${order.map((field) => `${field}(input: ${field === 'viaA' ? 'A' : 'B'}): Int`).join(' ')} plain(input: C): Int direct(organizationId: ID!): Int }
	`;
	const read = [...fieldsTakingOrganization(fixture)].sort().join(',');
	if (read !== 'Query.direct,Query.viaA,Query.viaB') {
		failures.push(`the schema reader misreads cyclic inputs (root fields ${order.join(', ')}): read ${read || 'nothing'}`);
	}
}

const takesOrganization = fieldsTakingOrganization(readFileSync(SCHEMA, 'utf8'));
if (takesOrganization.size < 100) {
	failures.push(`only ${takesOrganization.size} root field(s) read as taking an organization — the schema reading is broken`);
}

/* -------- 3. which of them are public -------- */

function filesUnder(dir, found = []) {
	for (const entry of readdirSync(dir)) {
		if (entry === 'node_modules' || entry === 'dist') continue;
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) filesUnder(full, found);
		else if (entry.endsWith('.resolver.ts') && !entry.endsWith('.spec.ts')) found.push(full);
	}
	return found;
}

let publicFields = new Map(); // `Operation.field` → file
for (const file of RESOLVER_ROOTS.flatMap((root) => filesUnder(root))) {
	const source = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|\s)\/\/[^\n]*/g, '$1');
	const classAt = source.search(/export class \w+/);
	const classPublic = classAt > -1 && /@Public\(\)/.test(source.slice(Math.max(0, source.lastIndexOf('\n}', classAt)), classAt));
	for (const decorator of source.matchAll(/@(Query|Mutation|Subscription)\(/g)) {
		const at = decorator.index;
		// The member this decorator belongs to: the next method declaration after it.
		const rest = source.slice(at);
		const method = /\n\s*(?:public |protected |private )?(?:async\s+)?(\w+)\s*\(/.exec(rest.slice(1));
		const declaration = rest.slice(0, method ? method.index + 1 : 0);
		const named = /^@\w+\(\s*'(\w+)'/.exec(declaration) ?? /name:\s*'(\w+)'/.exec(declaration);
		const field = named ? named[1] : method?.[1];
		if (!field) continue;
		// The decorator block: from the end of the previous member to this member's name.
		let blockStart = source.lastIndexOf('\n\t}', at);
		while (blockStart > -1 && !/^\n\t\}[ \t]*\r?\n/.test(source.slice(blockStart, blockStart + 8))) {
			blockStart = blockStart === 0 ? -1 : source.lastIndexOf('\n\t}', blockStart - 1);
		}
		const block = source.slice(blockStart === -1 ? classAt : blockStart, at + (method ? method.index + 1 : 0));
		if (classPublic || /@Public\(\)/.test(block)) {
			publicFields.set(`${decorator[1]}.${field}`, relative(ROOT, file).split(sep).join('/'));
		}
	}
}

// The control: the tree has public fields (sign-in, invites, shared links…). Reading none means the reader is blind,
// and a blind reader would pass every new public field that takes an organization.
if (publicFields.size < 10) {
	failures.push(`only ${publicFields.size} public GraphQL field(s) were found — the resolver reading is broken`);
}

const exposed = [...takesOrganization].filter((key) => publicFields.has(key)).sort();
for (const key of exposed) {
	if (!PUBLIC_EXEMPT[key]) {
		failures.push(
			`${key} (${publicFields.get(key)}) is @Public() and takes an organizationId, so the membership interceptor does not check it — review it and list it in PUBLIC_EXEMPT with the reason it is safe`
		);
	}
}
for (const key of Object.keys(PUBLIC_EXEMPT)) {
	if (!exposed.includes(key)) failures.push(`PUBLIC_EXEMPT lists ${key}, which is no longer a public field that takes an organization — delete the row`);
}

if (process.argv.includes('--list')) {
	console.log(exposed.map((key) => `${key}\t${publicFields.get(key)}`).join('\n'));
}

if (failures.length > 0) {
	console.error('FAILED — the GraphQL organization-membership rule:');
	for (const failure of failures) console.error(`  ${failure}`);
	process.exit(1);
}

console.log(
	`PASSED — ${takesOrganization.size} GraphQL root field(s) take an organization; GraphqlOrganizationMembershipInterceptor is global ` +
		`and checks all of them except ${exposed.length} public field(s), each listed with its reason.`
);
