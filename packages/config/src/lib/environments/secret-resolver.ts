import { randomBytes } from 'node:crypto';
import * as chalk from 'chalk';
import { isKnownDefaultSecret } from '@gauzy/contracts';

/**
 * Per-process registry of the secrets this resolver generated, keyed by variable name.
 *
 * Kept on `globalThis` (not in module scope) so that every copy of `@gauzy/config` loaded into the
 * same process — e.g. one bundled into the API and one resolved from node_modules by a plugin —
 * hands out the SAME value for a name. Two different random keys in one process would make tokens
 * signed by one copy fail verification in the other.
 */
const GENERATED_SECRETS = Symbol.for('@gauzy/config:generated-secrets');
const WARNED_SECRETS = Symbol.for('@gauzy/config:warned-secrets');

type SecretRegistryHolder = {
	[GENERATED_SECRETS]?: Map<string, string>;
	[WARNED_SECRETS]?: Set<string>;
};

function registry(): Map<string, string> {
	const holder = globalThis as unknown as SecretRegistryHolder;
	holder[GENERATED_SECRETS] ??= new Map<string, string>();
	return holder[GENERATED_SECRETS];
}

/** Logs `message` once per process for `name`. Never pass the secret value itself. */
function warnOnce(name: string, message: string): void {
	const holder = globalThis as unknown as SecretRegistryHolder;
	holder[WARNED_SECRETS] ??= new Set<string>();
	const warned = holder[WARNED_SECRETS];
	if (warned.has(name)) {
		return;
	}
	warned.add(name);
	// eslint-disable-next-line no-console
	console.warn(`${chalk.bgRed.whiteBright.bold(' INSECURE SECRET ')} ${chalk.red(message)}`);
}

/**
 * Resolves a token-signing / session secret from `process.env[name]` without ever falling back to a
 * value published in this repository (GHSA-39j7-x845-4w3c).
 *
 * - Set (non-blank): returned exactly as provided, so an explicit value behaves as it always did. A
 *   published default (see `KNOWN_DEFAULT_SECRETS`) only logs a warning here: in development it is
 *   an explicit developer choice (`.env.local` ships `secretKey`, and CI/e2e read it through Nx),
 *   and in production `validateApplicationSecrets()` refuses to boot with it.
 * - Unset or blank, `DEMO !== 'true'`: a random 512-bit secret is generated once per process and a
 *   warning names the variable. Tokens and sessions then do NOT survive a restart, and every
 *   separate process that signs or verifies these tokens (API replicas, `yarn seed`) must be given
 *   the same value explicitly. In production `validateApplicationSecrets()` still refuses to boot,
 *   as before, because {@link isGeneratedSecret} marks the value as not configured.
 * - Unset or blank, `DEMO === 'true'`: returns `demoFallback` — the historical published default.
 *
 * @param name - The environment variable holding the secret.
 * @param demoFallback - The value `DEMO=true` deployments have always used when the variable is unset.
 * @returns The secret to use.
 */
export function resolveSecret(name: string, demoFallback: string): string {
	const raw = process.env[name];

	// TODO(GHSA-39j7-x845-4w3c): HELD — the DEMO=true path deliberately keeps the historical
	// behaviour (`process.env[name] || '<published default>'`) until the maintainers decide how the
	// public demo is provisioned. demo.gauzy.co runs DEMO=true with NODE_ENV=development and takes its
	// secrets from a store we cannot inspect from here; switching it to random or refused secrets
	// could log everyone out on every restart or stop it from booting. Anyone who can reach a DEMO
	// instance that relies on this fallback can forge tokens for it.
	if (process.env.DEMO === 'true') {
		return raw || demoFallback;
	}

	if (raw?.trim()) {
		if (isKnownDefaultSecret(raw)) {
			warnOnce(
				name,
				`${name} is set to a value published in the Gauzy repository. Anyone can forge tokens or ` +
					'sessions signed with it. Use it for local development only; set a strong unique value ' +
					'(e.g. `openssl rand -hex 64`) anywhere else.'
			);
		}
		return raw;
	}

	const generated = registry();
	let secret = generated.get(name);
	if (!secret) {
		secret = randomBytes(64).toString('hex');
		generated.set(name, secret);
	}
	warnOnce(
		name,
		`${name} is not set. Using a random secret generated for this process only: tokens and sessions ` +
			'signed with it stop working when the process restarts, and other processes (API replicas, ' +
			'`yarn seed`) cannot verify them. Set a strong unique value (e.g. `openssl rand -hex 64`), ' +
			'shared by every process that must accept the same tokens. Production deployments refuse to ' +
			'start without it.'
	);
	return secret;
}

/**
 * Whether `value` is the secret {@link resolveSecret} generated for `name` because the variable was
 * unset. The startup guard uses it to tell "configured" from "fell back to a per-process random".
 *
 * @param name - The environment variable name.
 * @param value - The value currently in use.
 */
export function isGeneratedSecret(name: string, value: unknown): boolean {
	const generated = registry().get(name);
	return typeof value === 'string' && generated !== undefined && generated === value;
}
