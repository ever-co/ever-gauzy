#!/usr/bin/env node
/**
 * Gate: the self-hosting templates ask the operator for every secret the API needs and ship none of them, and they
 * route every path the API serves to the API.
 *
 * Secrets. In production (`NODE_ENV=production`, `DEMO` not `true`) the API refuses to start while a JWT or session
 * secret is unset or a published default (`CHECKED_SECRETS`), and refuses to seed while a `DEMO_*_PASSWORD` is
 * (`KNOWN_DEFAULT_SEED_CREDENTIALS`), both in `packages/core/src/lib/bootstrap/validate-secrets.ts`. A one-click
 * template that leaves one of them out deploys an API that never starts; one that fills one in publishes that
 * credential to everyone who deploys it. The lists are read from that file, so a secret it starts to require is
 * required here too.
 *
 *   - `.do/deploy.template.yaml` (Deploy to DigitalOcean): each is an `envs` entry with `type: SECRET` and no value,
 *     at app level or on the `api` component, which App Platform asks for when the app is created. No SECRET carries
 *     a value.
 *   - `docker-compose.caddy.yml`: each, and `DB_PASS`, is interpolated as `${KEY:?message}` only, so compose refuses
 *     to start without it, and never given a literal value.
 *   - `.env.caddy.sample`: each, and `DB_PASS`, is listed with an empty value.
 *
 * Routes. Both templates serve the web app and the API from one origin, so a path the API serves but the proxy sends
 * to the web app is a feature that silently does not work (GraphQL did, at first). The API's paths are read from
 * where it declares them: the REST global prefix (`packages/core/src/lib/bootstrap/index.ts`), the uploaded files'
 * `serveRoot` (`packages/core/src/lib/helper.ts`), the GraphQL path (`packages/constants/src/lib/api.ts`) and the
 * Swagger UI path with its OpenAPI documents (`packages/core/src/lib/bootstrap/swagger.ts`). Each must reach the API,
 * App Platform's with its path kept (`preserve_path_prefix: true`), and the web app's own paths must not. (The Scalar
 * reference that `swagger.ts` also mounts is left out on purpose: see the comment in the Caddyfile.)
 *
 * Read by hand rather than with a YAML parser: this job installs nothing (see static-checks.yml), and the shapes
 * below are the ones these templates use. A list or path the reader cannot find is reported rather than skipped.
 *
 * Run from the repository root: `node tools/scripts/self-hosting-templates-check.mjs`
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');

const SECRETS_SOURCE = 'packages/core/src/lib/bootstrap/validate-secrets.ts';
const REST_PREFIX_SOURCE = 'packages/core/src/lib/bootstrap/index.ts';
const FILES_ROOT_SOURCE = 'packages/core/src/lib/helper.ts';
const GRAPHQL_PATH_SOURCE = 'packages/constants/src/lib/api.ts';
const SWAGGER_PATH_SOURCE = 'packages/core/src/lib/bootstrap/swagger.ts';

const APP_PLATFORM_TEMPLATE = '.do/deploy.template.yaml';
const CADDYFILE = '.deploy/caddy/Caddyfile';
const COMPOSE_FILE = 'docker-compose.caddy.yml';
const COMPOSE_ENV_SAMPLE = '.env.caddy.sample';

/** The App Platform component, and the Caddy upstream host, that run the API. */
const API_COMPONENT = 'api';

/** Secrets only the compose file needs: the password of the Postgres it runs itself. */
const COMPOSE_ONLY_SECRETS = ['DB_PASS'];

/** Paths of the web app, which must not be sent to the API. */
const WEB_APP_PATHS = ['/', '/auth/login'];

/** What each kind of API path serves; `apiPaths` returns at least one path of each kind it finds. */
export const API_PATH_KINDS = {
	rest: 'REST',
	graphql: 'GraphQL, including the subscription socket',
	files: 'uploaded files',
	swagger: 'Swagger UI',
	openApi: 'the OpenAPI document'
};

/**
 * The secrets the API requires, as read from `validate-secrets.ts`.
 *
 * @param {string} source The text of `validate-secrets.ts`.
 * @returns {{ checked: string[], seed: string[] }} The JWT/session secrets and the seed passwords; empty when the
 *   list is not found.
 */
export function requiredSecrets(source) {
	const list = (name) => new RegExp(`const ${name}\\b[^=]*=\\s*\\[([\\s\\S]*?)\\];`).exec(source)?.[1] ?? '';
	return {
		checked: [...list('CHECKED_SECRETS').matchAll(/'([A-Z0-9_]+)'/g)].map((match) => match[1]),
		seed: [...list('KNOWN_DEFAULT_SEED_CREDENTIALS').matchAll(/\bkey:\s*'([A-Z0-9_]+)'/g)].map((match) => match[1])
	};
}

/**
 * The paths the API serves outside the web app, as read from where the API declares them.
 *
 * @param {{ restPrefix: string, filesRoot: string, graphqlPath: string, swaggerPath: string }} sources The texts of
 *   the four files.
 * @returns {Array<{ path: string, what: string }>} Request paths that must reach the API; none for a declaration
 *   that is not found.
 */
export function apiPaths({ restPrefix, filesRoot, graphqlPath, swaggerPath }) {
	const rest = /const globalPrefix = '([^']+)'/.exec(restPrefix)?.[1];
	const files = /serveRoot: '([^']+)'/.exec(filesRoot)?.[1];
	const graphql = /export const DEFAULT_GRAPHQL_API_PATH = '([^']+)'/.exec(graphqlPath)?.[1];
	// The default of setupSwagger's `swaggerPath` option. Nest serves the UI's page and files under it, and the
	// OpenAPI document next to it, at `<path>-json` and `<path>-yaml`.
	const swagger = /\bswaggerPath = '([^']+)'/.exec(swaggerPath)?.[1];
	const under = (root, name) => `/${root.replace(/^\/+|\/+$/g, '')}${name ? `/${name}` : ''}`;

	return [
		...(rest
			? [
					{ path: under(rest), what: API_PATH_KINDS.rest },
					{ path: under(rest, 'health'), what: API_PATH_KINDS.rest }
				]
			: []),
		...(graphql ? [{ path: under(graphql), what: API_PATH_KINDS.graphql }] : []),
		...(files ? [{ path: under(files, 'avatar.png'), what: API_PATH_KINDS.files }] : []),
		...(swagger
			? [
					{ path: under(swagger), what: API_PATH_KINDS.swagger },
					{ path: under(swagger, 'swagger-ui-init.js'), what: API_PATH_KINDS.swagger },
					{ path: `${under(swagger)}-json`, what: API_PATH_KINDS.openApi },
					{ path: `${under(swagger)}-yaml`, what: API_PATH_KINDS.openApi }
				]
			: [])
	];
}

/**
 * The `envs` entries of an App Platform app spec.
 *
 * @param {string} source The spec's text.
 * @returns {Array<{ component: string|null, key: string, type: string|null, hasValue: boolean }>} One per `- key:`
 *   entry, with the component whose `envs` list holds it (null for the app-level list).
 */
export function appPlatformEnvs(source) {
	const entries = [];
	// The `- name:` items enclosing the current line, innermost last.
	const named = [];
	let owner = null;
	let entry = null;
	// The indentation of the current entry's `- key:` line: the lines indented further belong to that entry.
	let entryIndent = -1;

	for (const line of source.split(/\r?\n/)) {
		if (/^\s*(#|$)/.test(line)) continue;
		const indent = line.length - line.trimStart().length;

		if (entry && indent > entryIndent) {
			const field = /^\s*(type|value):\s*(.*?)\s*(#.*)?$/.exec(line);
			if (field?.[1] === 'type') entry.type = field[2].replace(/^['"]|['"]$/g, '');
			if (field?.[1] === 'value') entry.hasValue = true;
			continue;
		}
		entry = null;

		while (named.length > 0 && named[named.length - 1].indent >= indent) named.pop();

		const keyed = /^(\s*)- key:\s*['"]?([A-Za-z0-9_]+)['"]?\s*(#.*)?$/.exec(line);
		if (keyed) {
			entry = { component: owner, key: keyed[2], type: null, hasValue: false };
			entryIndent = keyed[1].length;
			entries.push(entry);
			continue;
		}

		const item = /^\s*- name:\s*['"]?([A-Za-z0-9_-]+)/.exec(line);
		if (item) named.push({ indent, name: item[1] });

		if (/^\s*envs:\s*(#.*)?$/.test(line)) owner = named.at(-1)?.name ?? null;
	}

	return entries;
}

/**
 * What an App Platform template gets wrong about the secrets.
 *
 * @param {string} source The spec's text.
 * @param {string[]} secrets The secrets the API needs.
 * @returns {string[]} One message per problem; empty when there is none.
 */
export function appPlatformProblems(source, secrets) {
	const envs = appPlatformEnvs(source);
	const label = (component) => component ?? 'app-level envs';
	const problems = [];

	for (const env of envs) {
		if (env.hasValue && (env.type === 'SECRET' || secrets.includes(env.key))) {
			problems.push(
				`${label(env.component)}: ${env.key} ships a value; declare it as \`type: SECRET\` with no value`
			);
		}
	}

	for (const key of secrets) {
		// The API gets its own variables and the app-level ones.
		const declared = envs.find(
			(env) => (env.component === API_COMPONENT || env.component === null) && env.key === key
		);
		if (!declared) {
			problems.push(
				`${API_COMPONENT}: does not ask for ${key} (an envs entry with \`type: SECRET\` and no value, on the ` +
					`${API_COMPONENT} component or at app level)`
			);
		} else if (declared.type !== 'SECRET') {
			problems.push(`${label(declared.component)}: ${key} is not \`type: SECRET\``);
		}
	}

	return problems;
}

/**
 * The ingress rules of an App Platform app spec.
 *
 * @param {string} source The spec's text.
 * @returns {Array<{ prefix: string|null, component: string|null, preservePathPrefix: boolean }>} One per rule.
 */
export function appPlatformRoutes(source) {
	const rules = [];
	let inIngress = false;
	let inComponent = false;
	let rule = null;

	for (const line of source.split(/\r?\n/)) {
		if (/^\s*(#|$)/.test(line)) continue;
		if (/^\s*ingress:/.test(line)) {
			inIngress = true;
			continue;
		}
		if (!inIngress) continue;
		// A key at the spec's own level ends the ingress block.
		if (/^ {0,2}[a-z_]+:/.test(line)) break;

		if (/^\s*- match:/.test(line)) {
			rule = { prefix: null, component: null, preservePathPrefix: false };
			rules.push(rule);
			inComponent = false;
			continue;
		}
		if (!rule) continue;

		const prefix = /^\s*prefix:\s*['"]?([^'"\s#]+)/.exec(line);
		if (prefix) rule.prefix = prefix[1];
		if (/^\s*component:\s*$/.test(line)) inComponent = true;
		const name = /^\s*name:\s*['"]?([A-Za-z0-9_-]+)/.exec(line);
		if (name && inComponent) rule.component = name[1];
		if (/^\s*preserve_path_prefix:\s*true\b/.test(line)) rule.preservePathPrefix = true;
	}

	return rules;
}

/**
 * What an App Platform template gets wrong about routing: a request path goes to the rule with the longest matching
 * prefix.
 *
 * @param {string} source The spec's text.
 * @param {Array<{ path: string, what: string }>} paths The paths that must reach the API.
 * @returns {string[]} One message per problem; empty when there is none.
 */
export function appPlatformRouteProblems(source, paths) {
	const rules = appPlatformRoutes(source).filter((rule) => rule.prefix !== null);
	const covers = (prefix, path) => path === prefix || path.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`);
	const route = (path) =>
		rules.filter((rule) => covers(rule.prefix, path)).sort((a, b) => b.prefix.length - a.prefix.length)[0];
	const problems = [];

	for (const { path, what } of paths) {
		const rule = route(path);
		if (rule?.component !== API_COMPONENT) {
			problems.push(`${path} (${what}) goes to ${rule?.component ?? 'no component'}, not the ${API_COMPONENT}`);
		} else if (!rule.preservePathPrefix) {
			problems.push(
				`${path} (${what}) reaches the ${API_COMPONENT} without ${rule.prefix}: set preserve_path_prefix`
			);
		}
	}
	for (const path of WEB_APP_PATHS) {
		if (route(path)?.component === API_COMPONENT)
			problems.push(`${path} (the web app) goes to the ${API_COMPONENT}`);
	}

	return problems;
}

/**
 * The path patterns a Caddyfile sends to the API: those of every named matcher whose `handle` block proxies to it,
 * or that a `reverse_proxy @matcher api:...` line names.
 *
 * @param {string} source The Caddyfile's text.
 * @returns {string[]} Caddy path patterns (`/api`, `/api/*`, ...).
 */
export function caddyApiPatterns(source) {
	const matchers = new Map();
	const toApi = new Set();
	let handled = null;

	for (const line of source.split(/\r?\n/)) {
		if (/^\s*(#|$)/.test(line)) continue;
		const matcher = /^\s*@([A-Za-z0-9_-]+)\s+path\s+(.+?)\s*$/.exec(line);
		if (matcher) matchers.set(matcher[1], matcher[2].split(/\s+/));

		const handle = /^\s*handle(?:\s+@([A-Za-z0-9_-]+))?\s*\{/.exec(line);
		if (handle) handled = handle[1] ?? null;
		if (handled && new RegExp(`^\\s*reverse_proxy\\s+${API_COMPONENT}:`).test(line)) toApi.add(handled);
		const inline = new RegExp(`^\\s*reverse_proxy\\s+@([A-Za-z0-9_-]+)\\s+${API_COMPONENT}:`).exec(line);
		if (inline) toApi.add(inline[1]);
	}

	return [...toApi].flatMap((name) => matchers.get(name) ?? []);
}

/**
 * Whether a request path matches a Caddy path pattern (exact, or `*` for any run of characters; case-insensitive).
 *
 * @param {string} pattern A Caddy path pattern.
 * @param {string} path A request path.
 * @returns {boolean} True when the pattern matches the path.
 */
export function caddyPathMatches(pattern, path) {
	const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
	return new RegExp(`^${escaped}$`, 'i').test(path);
}

/**
 * What a Caddyfile gets wrong about routing.
 *
 * @param {string} source The Caddyfile's text.
 * @param {Array<{ path: string, what: string }>} paths The paths that must reach the API.
 * @returns {string[]} One message per problem; empty when there is none.
 */
export function caddyRouteProblems(source, paths) {
	const patterns = caddyApiPatterns(source);
	const toApi = (path) => patterns.some((pattern) => caddyPathMatches(pattern, path));
	const problems = [];

	for (const { path, what } of paths) {
		if (!toApi(path)) problems.push(`${path} (${what}) is not proxied to the ${API_COMPONENT}`);
	}
	for (const path of WEB_APP_PATHS) {
		if (toApi(path)) problems.push(`${path} (the web app) is proxied to the ${API_COMPONENT}`);
	}

	return problems;
}

/**
 * What a compose file gets wrong about the secrets.
 *
 * @param {string} source The compose file's text.
 * @param {string[]} secrets The secrets it must require.
 * @returns {string[]} One message per problem; empty when there is none.
 */
export function composeProblems(source, secrets) {
	const lines = source.split(/\r?\n/).filter((line) => !/^\s*#/.test(line));
	const text = lines.join('\n');
	const problems = [];

	for (const key of secrets) {
		const uses = [...text.matchAll(new RegExp(`\\$\\{${key}(?![A-Za-z0-9_])(:\\?)?`, 'g'))];
		if (uses.length === 0) {
			problems.push(`never asks for ${key} (\`\${${key}:?message}\`)`);
		} else if (uses.some((use) => use[1] === undefined)) {
			problems.push(
				`\${${key}} can be empty or defaulted; use \`\${${key}:?message}\` so compose refuses to start without it`
			);
		}

		const literal = lines.find((line) => {
			const assigned = new RegExp(`^\\s*(?:-\\s*)?${key}\\s*[:=]\\s*(.*)$`).exec(line);
			return assigned && !assigned[1].includes('${');
		});
		if (literal !== undefined) {
			problems.push(`${key} has a literal value: ${literal.trim()}`);
		}
	}

	return problems;
}

/**
 * What an env sample gets wrong about the secrets.
 *
 * @param {string} source The sample's text.
 * @param {string[]} secrets The secrets it must list, empty.
 * @returns {string[]} One message per problem; empty when there is none.
 */
export function envSampleProblems(source, secrets) {
	const lines = source.split(/\r?\n/);
	const problems = [];

	for (const key of secrets) {
		const line = lines.find((candidate) => new RegExp(`^\\s*${key}\\s*=`).test(candidate));
		if (line === undefined) {
			problems.push(`does not list ${key}= for the operator to fill in`);
		} else if (!/=\s*(""|'')?\s*$/.test(line)) {
			problems.push(`${key} has a value; leave it empty for the operator to fill in`);
		}
	}

	return problems;
}

function main() {
	const read = (file) => readFileSync(join(ROOT, file), 'utf8');
	const { checked, seed } = requiredSecrets(read(SECRETS_SOURCE));
	const apiSecrets = [...checked, ...seed];
	const composeSecrets = [...apiSecrets, ...COMPOSE_ONLY_SECRETS];
	const paths = apiPaths({
		restPrefix: read(REST_PREFIX_SOURCE),
		filesRoot: read(FILES_ROOT_SOURCE),
		graphqlPath: read(GRAPHQL_PATH_SOURCE),
		swaggerPath: read(SWAGGER_PATH_SOURCE)
	});

	const problems = [];
	if (checked.length === 0 || seed.length === 0) {
		problems.push(
			`${SECRETS_SOURCE}: CHECKED_SECRETS or KNOWN_DEFAULT_SEED_CREDENTIALS not found; update this gate's reader`
		);
	}
	const found = new Set(paths.map((path) => path.what));
	const missing = Object.values(API_PATH_KINDS).filter((kind) => !found.has(kind));
	if (missing.length > 0) {
		problems.push(
			`the API's paths for ${missing.join(', ')} were not found in ${REST_PREFIX_SOURCE}, ${GRAPHQL_PATH_SOURCE}, ` +
				`${FILES_ROOT_SOURCE} or ${SWAGGER_PATH_SOURCE}; update this gate's reader`
		);
	}
	const report = (file, found) => problems.push(...found.map((problem) => `${file}: ${problem}`));
	const appPlatform = read(APP_PLATFORM_TEMPLATE);
	report(APP_PLATFORM_TEMPLATE, appPlatformProblems(appPlatform, apiSecrets));
	report(APP_PLATFORM_TEMPLATE, appPlatformRouteProblems(appPlatform, paths));
	report(CADDYFILE, caddyRouteProblems(read(CADDYFILE), paths));
	report(COMPOSE_FILE, composeProblems(read(COMPOSE_FILE), composeSecrets));
	report(COMPOSE_ENV_SAMPLE, envSampleProblems(read(COMPOSE_ENV_SAMPLE), composeSecrets));

	if (problems.length > 0) {
		console.error(`FAILED — ${problems.length} problem(s) in the self-hosting templates:`);
		for (const problem of problems) console.error(`  - ${problem}`);
		process.exit(1);
	}

	console.log(
		`PASSED — ${APP_PLATFORM_TEMPLATE}, ${COMPOSE_FILE} and ${COMPOSE_ENV_SAMPLE} ask for every secret the API ` +
			`needs and ship none of them (${composeSecrets.join(', ')}); ${APP_PLATFORM_TEMPLATE} and ${CADDYFILE} ` +
			`route ${paths.map((path) => path.path).join(', ')} to the API and the web app's paths to the web app.`
	);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
