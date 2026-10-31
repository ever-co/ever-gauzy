#!/usr/bin/env node
/**
 * Gate: the self-hosting templates ask the operator for every secret the API needs, and ship none of them.
 *
 * In production (`NODE_ENV=production`, `DEMO` not `true`) the API refuses to start while a JWT or session secret is
 * unset or a published default (`CHECKED_SECRETS`), and refuses to seed while a `DEMO_*_PASSWORD` is
 * (`KNOWN_DEFAULT_SEED_CREDENTIALS`), both in `packages/core/src/lib/bootstrap/validate-secrets.ts`. A one-click
 * template that leaves one of them out deploys an API that never starts; one that fills one in publishes that
 * credential to everyone who deploys it. The lists are read from that file, so a secret it starts to require is
 * required here too.
 *
 *   - `.do/deploy.template.yaml` (Deploy to DigitalOcean): each is an `envs` entry of the `api` component with
 *     `type: SECRET` and no value, which App Platform asks for when the app is created. No SECRET carries a value.
 *   - `docker-compose.caddy.yml`: each, and `DB_PASS`, is interpolated as `${KEY:?message}` only, so compose refuses
 *     to start without it, and never given a literal value.
 *   - `.env.caddy.sample`: each, and `DB_PASS`, is listed with an empty value.
 *
 * Read by hand rather than with a YAML parser: this job installs nothing (see static-checks.yml), and the shapes
 * below are the ones these templates use. A list the reader cannot find is reported rather than skipped.
 *
 * Run from the repository root: `node tools/scripts/self-hosting-secrets-check.mjs`
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');

const SECRETS_SOURCE = 'packages/core/src/lib/bootstrap/validate-secrets.ts';
const APP_PLATFORM_TEMPLATE = '.do/deploy.template.yaml';
const COMPOSE_FILE = 'docker-compose.caddy.yml';
const COMPOSE_ENV_SAMPLE = '.env.caddy.sample';

/** The App Platform component that runs the API. */
const API_COMPONENT = 'api';

/** Secrets only the compose file needs: the password of the Postgres it runs itself. */
const COMPOSE_ONLY_SECRETS = ['DB_PASS'];

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
 * The `envs` entries of an App Platform app spec.
 *
 * @param {string} source The spec's text.
 * @returns {Array<{ component: string|null, key: string, type: string|null, hasValue: boolean }>} One per `- key:`
 *   entry, with the component (the closest `- name:` above it) it belongs to.
 */
export function appPlatformEnvs(source) {
	const entries = [];
	let component = null;
	let entry = null;
	// The indentation of the current entry's `- key:` line: the lines indented further belong to that entry.
	let entryIndent = -1;

	for (const line of source.split(/\r?\n/)) {
		if (/^\s*(#|$)/.test(line)) continue;
		const indent = line.length - line.trimStart().length;

		const keyed = /^(\s*)- key:\s*['"]?([A-Za-z0-9_]+)['"]?\s*(#.*)?$/.exec(line);
		if (keyed) {
			entry = { component, key: keyed[2], type: null, hasValue: false };
			entryIndent = keyed[1].length;
			entries.push(entry);
			continue;
		}

		if (entry && indent > entryIndent) {
			const field = /^\s*(type|value):\s*(.*?)\s*(#.*)?$/.exec(line);
			if (field?.[1] === 'type') entry.type = field[2].replace(/^['"]|['"]$/g, '');
			if (field?.[1] === 'value') entry.hasValue = true;
			continue;
		}

		entry = null;
		const named = /^\s*- name:\s*['"]?([A-Za-z0-9_-]+)/.exec(line);
		if (named) component = named[1];
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
	const problems = [];

	for (const env of envs) {
		if (env.hasValue && (env.type === 'SECRET' || secrets.includes(env.key))) {
			problems.push(`${env.component}: ${env.key} ships a value; declare it as \`type: SECRET\` with no value`);
		}
	}

	for (const key of secrets) {
		const declared = envs.find((env) => env.component === API_COMPONENT && env.key === key);
		if (!declared) {
			problems.push(`${API_COMPONENT}: does not ask for ${key} (an envs entry with \`type: SECRET\`, no value)`);
		} else if (declared.type !== 'SECRET') {
			problems.push(`${API_COMPONENT}: ${key} is not \`type: SECRET\``);
		}
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

	const problems = [];
	if (checked.length === 0 || seed.length === 0) {
		problems.push(
			`${SECRETS_SOURCE}: CHECKED_SECRETS or KNOWN_DEFAULT_SEED_CREDENTIALS not found; update this gate's reader`
		);
	}
	const report = (file, found) => problems.push(...found.map((problem) => `${file}: ${problem}`));
	report(APP_PLATFORM_TEMPLATE, appPlatformProblems(read(APP_PLATFORM_TEMPLATE), apiSecrets));
	report(COMPOSE_FILE, composeProblems(read(COMPOSE_FILE), composeSecrets));
	report(COMPOSE_ENV_SAMPLE, envSampleProblems(read(COMPOSE_ENV_SAMPLE), composeSecrets));

	if (problems.length > 0) {
		console.error(`FAILED — ${problems.length} problem(s) in the self-hosting templates:`);
		for (const problem of problems) console.error(`  - ${problem}`);
		process.exit(1);
	}

	console.log(
		`PASSED — ${APP_PLATFORM_TEMPLATE}, ${COMPOSE_FILE} and ${COMPOSE_ENV_SAMPLE} ask for every secret the API ` +
			`needs and ship none of them: ${composeSecrets.join(', ')}.`
	);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
