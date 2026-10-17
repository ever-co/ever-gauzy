/**
 * The shared harness of the commerce wiring end-to-end runs (Q7: `commerce-*-e2e.mjs`).
 *
 * Each wave of the commerce wiring ships one run that drives the wired path over REST and reads the
 * result back over GraphQL (or the other way round), against a booted API, exactly like
 * `return-receipt-e2e.mjs`. What every run needs — a credential, a scoped caller, the capability
 * switches, a find-or-create for fixtures, a GraphQL caller and a verdict — lives here once, so a run
 * file states only its own chain and its own assertions.
 *
 * Environment: `BASE_URL` (default `http://127.0.0.1:3000`), `E2E_EMAIL`, `E2E_PASSWORD`, `E2E_TIMEOUT_MS`.
 */

export const BASE = (process.env.BASE_URL || 'http://127.0.0.1:3000').replace(/\/+$/, '');
const EMAIL = process.env.E2E_EMAIL || 'admin@ever.co';
const PASSWORD = process.env.E2E_PASSWORD || 'admin';
const TIMEOUT_MS = Number(process.env.E2E_TIMEOUT_MS || 30_000);

const results = [];

/**
 * Records one check.
 *
 * @param {string} name What was checked, phrased as the property being asserted.
 * @param {boolean} ok Whether it held.
 * @param {string} [detail] What was seen.
 */
export function record(name, ok, detail) {
	results.push({ name, ok, detail });
	console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}

/**
 * Calls the installation.
 *
 * @param {string} method The HTTP method.
 * @param {string} url The path, beginning with a slash.
 * @param {{token?: string, tenantId?: string, body?: unknown, headers?: Record<string, string>}} [options]
 * @returns {Promise<{status: number, json: any, text: string, headers: Headers}>}
 */
export async function call(method, url, options = {}) {
	const { token, tenantId, body, headers } = options;
	const response = await fetch(`${BASE}${url}`, {
		method,
		signal: AbortSignal.timeout(TIMEOUT_MS),
		headers: {
			'Content-Type': 'application/json',
			...(token ? { Authorization: `Bearer ${token}` } : {}),
			...(tenantId ? { 'Tenant-Id': tenantId } : {}),
			...(headers ?? {})
		},
		body: body === undefined ? undefined : JSON.stringify(body)
	});

	const text = await response.text();

	let json;
	try {
		json = JSON.parse(text);
	} catch {
		json = undefined;
	}

	return { status: response.status, json, text, headers: response.headers };
}

/** @param {{json: any, text: string}} result A response. @returns {string} A short description. */
export function brief(result) {
	return (result.json ? JSON.stringify(result.json) : result.text).slice(0, 240);
}

/** @param {{status: number}} result A response. @returns {boolean} Whether it was a success. */
export function ok(result) {
	return result.status >= 200 && result.status < 300;
}

/**
 * Signs in and returns the scoped callers every run uses.
 *
 * @param {string} runName A stable name for the run, used in idempotency keys.
 * @returns {Promise<undefined | {
 *   api: (method: string, path: string, body?: unknown, headers?: Record<string, string>) => Promise<any>,
 *   gql: (query: string, variables?: Record<string, unknown>, headers?: Record<string, string>) => Promise<any>,
 *   owned: (body: Record<string, unknown>) => Record<string, unknown>,
 *   key: (scope: string) => string,
 *   organizationId: string,
 *   tenantId: string
 * }>}
 */
export async function signIn(runName) {
	const login = await call('POST', '/api/auth/login', { body: { email: EMAIL, password: PASSWORD } });
	const token = login.json?.token;
	const tenantId = login.json?.user?.tenantId;
	const organizationId = login.json?.user?.employee?.organizationId;

	record(
		'a real credential signs in over REST',
		login.status === 200 && Boolean(token),
		`HTTP ${login.status}${token ? '' : ` ${brief(login)}`}`
	);

	if (!token) return undefined;

	if (!organizationId) {
		record('the credential names the organization it acts in', false, brief(login));

		return undefined;
	}

	const api = (method, path, body, headers) => call(method, path, { token, tenantId, body, headers });
	const gql = (query, variables = {}, headers) =>
		call('POST', '/graphql', { token, tenantId, body: { query, variables }, headers });
	const owned = (body) => ({ ...body, organizationId });
	const stamp = Date.now();
	const key = (scope) => `e2e-${runName}-${scope}-${stamp}`;

	return { api, gql, owned, key, organizationId, tenantId };
}

/**
 * Switches on every capability a run's routes sit behind.
 *
 * `FeatureFlagGuard` answers `404` for a route whose feature is switched off, so a run states the decision
 * it is testing under rather than reporting a default-off package as missing.
 *
 * @param {(method: string, path: string, body?: unknown) => Promise<any>} api The scoped caller.
 * @param {string} organizationId The organization the toggles are stated for.
 * @param {string[]} codes The feature codes.
 */
export async function enableCapabilities(api, organizationId, codes) {
	const catalogue = await api('GET', '/api/feature/toggle');
	const idByCode = new Map((catalogue.json?.items ?? []).map((feature) => [feature.code, feature.id]));
	const toggles = await api('GET', '/api/feature/toggle/organizations');
	const enabled = new Set(
		(toggles.json?.items ?? []).filter((row) => row.isEnabled === true).map((row) => row.featureId)
	);
	const missing = [];

	for (const code of codes) {
		const featureId = idByCode.get(code);

		if (!featureId) {
			missing.push(`${code} is not in the catalogue`);
			continue;
		}

		if (enabled.has(featureId)) continue;

		const answer = await api('POST', '/api/feature/toggle', { featureId, isEnabled: true, organizationId });

		if (!ok(answer)) {
			missing.push(`${code} (HTTP ${answer.status})`);
		}
	}

	record(
		'every capability this run drives is switched on',
		missing.length === 0,
		missing.length ? `not enabled: ${missing.join(', ')}` : `${codes.length} capabilities on`
	);
}

/**
 * Finds a fixture row by one member, or creates it.
 *
 * @param {(method: string, path: string, body?: unknown) => Promise<any>} api The scoped caller.
 * @param {{path: string, member: string, value: string, body: Record<string, unknown>, label: string, list?: string}} step
 * @returns {Promise<any | undefined>} The stored row.
 */
export async function ensureRow(api, step) {
	const listPath = step.list ?? step.path;
	const items = (await api('GET', listPath)).json?.items ?? [];
	const existing = items.find((row) => row?.[step.member] === step.value);

	if (existing?.id) {
		record(`${step.label} is available`, true, `reused (${step.member}=${step.value})`);

		return existing;
	}

	const created = await api('POST', step.path, step.body);

	if (ok(created) && created.json?.id) {
		record(`${step.label} is available`, true, `HTTP ${created.status} (created)`);

		return created.json;
	}

	const afterRefusal = ((await api('GET', listPath)).json?.items ?? []).find(
		(row) => row?.[step.member] === step.value
	);

	record(
		`${step.label} is available`,
		Boolean(afterRefusal?.id),
		afterRefusal?.id
			? `reused after a refusal (HTTP ${created.status})`
			: `HTTP ${created.status} ${brief(created)}`
	);

	return afterRefusal;
}

/**
 * The sales channel, product and variant every commerce run sells.
 *
 * @param {(method: string, path: string, body?: unknown) => Promise<any>} api The scoped caller.
 * @param {string} organizationId The organization.
 * @param {string} prefix A stable prefix for the fixture codes, so a re-run reuses its rows.
 * @param {{requiresShipping?: boolean}} [options]
 * @returns {Promise<undefined | {channel: any, product: any, variant: any}>}
 */
export async function ensureCatalogue(api, organizationId, prefix, options = {}) {
	const channel = await ensureRow(api, {
		label: 'a sales channel',
		path: '/api/channels',
		member: 'code',
		value: `${prefix}-CHANNEL`,
		body: { name: `${prefix} channel`, code: `${prefix}-CHANNEL`, defaultCurrency: 'USD', organizationId }
	});

	if (!channel?.id) return undefined;

	const product = await ensureRow(api, {
		label: 'a product',
		path: '/api/products',
		member: 'code',
		value: `${prefix}-PRODUCT`,
		body: {
			code: `${prefix}-PRODUCT`,
			name: `${prefix} product`,
			description: 'A product the commerce wiring run sells.',
			enabled: true,
			type: { name: `${prefix} type` },
			category: { name: `${prefix} category` },
			optionGroupCreateInputs: [],
			organizationId
		}
	});

	if (!product?.id) return undefined;

	const variant = await ensureRow(api, {
		label: 'a variant of it',
		path: '/api/product-variants',
		member: 'internalReference',
		value: `${prefix}-VARIANT`,
		body: {
			productId: product.id,
			internalReference: `${prefix}-VARIANT`,
			notes: 'The variant the commerce wiring run sells.',
			enabled: true,
			organizationId,
			...(options.requiresShipping === undefined ? {} : { requiresShipping: options.requiresShipping })
		}
	});

	if (!variant?.id) return undefined;

	return { channel, product, variant };
}

/**
 * The version a versioned write must state, read from a response.
 *
 * @param {{json?: any, headers?: Headers}} result A response.
 * @returns {string | undefined} The `If-Match` value.
 */
export function versionOf(result) {
	const etag = result.headers?.get?.('etag');

	if (etag) return etag.replace(/^W\//, '').replace(/"/g, '');

	return result.json?.version === undefined ? undefined : String(result.json.version);
}

/**
 * Compares two decimal amounts as the API answers them (a string or a number).
 *
 * @param {unknown} left One amount.
 * @param {unknown} right The other.
 * @returns {boolean} Whether they are the same money, to the cent.
 */
export function sameMoney(left, right) {
	return Math.round(Number(left ?? 0) * 100) === Math.round(Number(right ?? 0) * 100);
}

/**
 * Prints the summary and exits with the run's verdict.
 *
 * @param {string} runName The run's name, printed in the verdict line.
 */
export function finish(runName) {
	const failed = results.filter((result) => !result.ok);
	console.log('');
	console.log(`  ${results.length - failed.length} of ${results.length} checks passed`);

	if (failed.length) {
		console.log('');
		for (const result of failed) {
			console.log(`  FAILED: ${result.name}${result.detail ? ` — ${result.detail}` : ''}`);
		}
	}

	console.log(`  ${runName}: ${failed.length ? 'FAILED' : 'PASSED'}`);
	process.exit(failed.length ? 1 : 0);
}
