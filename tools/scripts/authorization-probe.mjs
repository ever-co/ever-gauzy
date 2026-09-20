#!/usr/bin/env node
/*
 * Authorization, exercised end to end against a running installation.
 *
 * The static gate (`mutating-route-permission-check.mjs`) reads declarations and the platform suites
 * read metadata; neither can show that a real caller with a real credential is actually refused. This
 * probe does: it provisions a principal that holds the *read* grant for a resource and nothing else,
 * then asks both protocols to destroy a row as that principal and as the super administrator.
 *
 * The property it pins is the one the inherited-route defect broke. `CrudController` declares
 * `DELETE :id`, `DELETE :id/soft` and `PUT :id/recover` with no permission metadata, `PermissionGuard`
 * answers `true` to empty metadata, and Nest falls back to the controller's class-level grant — which
 * is the view grant. A read-only principal could therefore delete. After the fix, each of those routes
 * states the destructive grant the resource's own GraphQL mutation states, so the same principal is
 * refused while a caller that holds the grant is served.
 *
 * The probe writes only to a throwaway role and a throwaway account, and removes both. It never
 * touches a seeded role: narrowing ADMIN would prove the guard works but would also leave a real
 * installation with a weakened role if the run were interrupted.
 *
 * Usage:
 *   node tools/scripts/authorization-probe.mjs
 *
 * Environment:
 *   BASE_URL        default http://127.0.0.1:3000
 *   ADMIN_EMAIL     default admin@ever.co
 *   ADMIN_PASSWORD  default admin
 *   PROBE_RESOURCE  default /api/carts, the capability whose routes the probe exercises
 *
 * Exits 0 when every check passed, 1 otherwise, and prints one line per check either way.
 */
'use strict';

const BASE = (process.env.BASE_URL || 'http://127.0.0.1:3000').replace(/\/+$/, '');
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@ever.co';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
const RESOURCE = process.env.PROBE_RESOURCE || '/api/carts';
const TIMEOUT_MS = Number(process.env.PROBE_TIMEOUT_MS || 30_000);

const PROBE_EMAIL = 'authorization-probe@ever.co';
const PROBE_PASSWORD = 'AuthorizationProbe123!';
const PROBE_ROLE = 'Authorization probe (read only)';
const PROBE_READ_PERMISSION = process.env.PROBE_READ_PERMISSION || 'CARTS_VIEW';
const PROBE_GRAPHQL_MUTATION = process.env.PROBE_GRAPHQL_MUTATION || 'deleteCart';

const results = [];

/**
 * Records one check.
 *
 * @param {string} name What was checked, phrased as the property being asserted.
 * @param {boolean} ok Whether it held.
 * @param {string} [detail] What was seen.
 */
function record(name, ok, detail) {
	results.push({ name, ok });
	console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}

/**
 * Calls the installation.
 *
 * `Tenant-Id` is sent on every authenticated call: the REST guard compares the tenant the caller
 * states with the tenant its credential carries, and a token alone authenticates but does not scope.
 *
 * @param {string} method The HTTP method.
 * @param {string} url The path, beginning with a slash.
 * @param {{token?: string, tenantId?: string, body?: unknown}} [options] Credential, tenant and body.
 * @returns {Promise<{status: number, json: any, text: string}>} The response.
 */
async function call(method, url, options = {}) {
	const { token, tenantId, body } = options;
	const response = await fetch(`${BASE}${url}`, {
		method,
		signal: AbortSignal.timeout(TIMEOUT_MS),
		headers: {
			'Content-Type': 'application/json',
			...(token ? { Authorization: `Bearer ${token}` } : {}),
			...(tenantId ? { 'Tenant-Id': tenantId } : {})
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
	return { status: response.status, json, text };
}

/**
 * Runs one GraphQL operation.
 *
 * @param {string} query The document.
 * @param {{token: string, tenantId: string, variables?: Record<string, unknown>}} options Credential.
 * @returns {Promise<{status: number, json: any}>} The response.
 */
async function graphql(query, { token, tenantId, variables }) {
	const response = await fetch(`${BASE}/graphql`, {
		method: 'POST',
		signal: AbortSignal.timeout(TIMEOUT_MS),
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`,
			'Tenant-Id': tenantId
		},
		body: JSON.stringify({ query, variables })
	});
	const text = await response.text();
	let json;
	try {
		json = JSON.parse(text);
	} catch {
		json = undefined;
	}
	return { status: response.status, json };
}

/** A short description of a response. */
function brief(result) {
	return (result.json ? JSON.stringify(result.json) : result.text).slice(0, 200);
}

/**
 * Everything a refusal says about itself: the error code the platform's contract sets, the HTTP-shaped
 * status when it carries one, and the message. A guard refusal arrives as `FORBIDDEN`; some resolver
 * paths surface it as an internal-error code with the refusal in the message, so both are read.
 */
function errorCode(result) {
	const error = result.json?.errors?.[0];
	return [error?.extensions?.code, error?.extensions?.status, error?.message].filter(Boolean).join(' / ').slice(0, 200);
}

/** The id of the principal created by this run, removed at the end. */
let probeUserId;
let probeRoleId;
let probeRolePermissionId;

/** Removes every row this probe created, in dependency order. */
async function cleanUp(token, tenantId) {
	if (probeUserId) {
		const removed = await call('DELETE', `/api/user/${probeUserId}`, { token, tenantId });
		console.log(`  cleanup: probe account deleted (HTTP ${removed.status})`);
	}
	if (probeRolePermissionId) {
		const removed = await call('DELETE', `/api/role-permissions/${probeRolePermissionId}`, { token, tenantId });
		console.log(`  cleanup: probe role permission deleted (HTTP ${removed.status})`);
	}
	if (probeRoleId) {
		const removed = await call('DELETE', `/api/roles/${probeRoleId}`, { token, tenantId });
		console.log(`  cleanup: probe role deleted (HTTP ${removed.status})`);
	}
}

async function main() {
	console.log('');
	console.log('authorization probe');
	console.log('===================');
	console.log(`  ${BASE}  ${RESOURCE}`);

	const login = await call('POST', '/api/auth/login', { body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } });
	const token = login.json?.token;
	const tenantId = login.json?.user?.tenantId;

	record('the super administrator signs in', login.status === 200 && Boolean(token), `HTTP ${login.status}`);
	if (!token) return finish();

	// --- a principal that may read and nothing else ---------------------------------------------
	const role = await call('POST', '/api/roles', {
		token,
		tenantId,
		body: { name: PROBE_ROLE, tenantId }
	});
	probeRoleId = role.json?.id;
	record('a throwaway role is created for the probe', Boolean(probeRoleId), `HTTP ${role.status} ${brief(role)}`);
	if (!probeRoleId) return finish();

	const grant = await call('POST', '/api/role-permissions', {
		token,
		tenantId,
		body: { permission: PROBE_READ_PERMISSION, enabled: true, roleId: probeRoleId, tenantId }
	});
	probeRolePermissionId = grant.json?.id;
	record(
		`the probe role is granted ${PROBE_READ_PERMISSION} and nothing else`,
		grant.status < 400,
		`HTTP ${grant.status} ${brief(grant)}`
	);

	const account = await call('POST', '/api/user', {
		token,
		tenantId,
		body: {
			email: PROBE_EMAIL,
			firstName: 'Authorization',
			lastName: 'Probe',
			roleId: probeRoleId,
			tenantId
		}
	});
	probeUserId = account.json?.id ?? account.json?.user?.id;
	record('a throwaway account is created with that role', Boolean(probeUserId), `HTTP ${account.status} ${brief(account)}`);
	if (!probeUserId) return finish();

	// The account is created without a credential — `CreateUserDTO` declares no password field — so the
	// password is set the way the platform sets one: `hash` carries it in clear text and the service
	// hashes it (`update-user.dto.ts`, `UserService.updateProfile`).
	const password = await call('PUT', `/api/user/${probeUserId}`, {
		token,
		tenantId,
		body: { hash: PROBE_PASSWORD }
	});
	record('the probe account is given a password', password.status < 400, `HTTP ${password.status} ${brief(password)}`);

	const probeLogin = await call('POST', '/api/auth/login', {
		body: { email: PROBE_EMAIL, password: PROBE_PASSWORD }
	});
	const probeToken = probeLogin.json?.token;
	const probeTenantId = probeLogin.json?.user?.tenantId ?? tenantId;
	record('the probe account signs in', probeLogin.status === 200 && Boolean(probeToken), `HTTP ${probeLogin.status} ${brief(probeLogin)}`);
	if (!probeToken) return finish();

	// --- the read grant is live, so the refusals below mean something ---------------------------
	const read = await call('GET', RESOURCE, { token: probeToken, tenantId: probeTenantId });
	record(
		`the probe account may read ${RESOURCE} with ${PROBE_READ_PERMISSION}`,
		read.status === 200,
		`HTTP ${read.status} ${read.status === 200 ? '' : brief(read)}`
	);

	// --- the destructive routes refuse a read-only principal ------------------------------------
	// A random identifier: the guard runs before the handler, so a refusal is what a refusal looks
	// like, and the row a real caller would name is never touched.
	const missingId = '00000000-0000-4000-8000-000000000000';

	const hard = await call('DELETE', `${RESOURCE}/${missingId}`, { token: probeToken, tenantId: probeTenantId });
	record(
		'DELETE refuses a caller that holds only the read grant',
		hard.status === 403,
		`HTTP ${hard.status} ${hard.status === 403 ? '' : brief(hard)}`
	);

	const soft = await call('DELETE', `${RESOURCE}/${missingId}/soft`, { token: probeToken, tenantId: probeTenantId });
	record(
		'DELETE :id/soft refuses a caller that holds only the read grant',
		soft.status === 403,
		`HTTP ${soft.status} ${soft.status === 403 ? '' : brief(soft)}`
	);

	const recover = await call('PUT', `${RESOURCE}/${missingId}/recover`, { token: probeToken, tenantId: probeTenantId });
	record(
		'PUT :id/recover refuses a caller that holds only the read grant',
		recover.status === 403,
		`HTTP ${recover.status} ${recover.status === 403 ? '' : brief(recover)}`
	);

	// --- the same operations over GraphQL, for the same principal -------------------------------
	const mutation = await graphql(`mutation ProbeDelete($id: ID!) { ${PROBE_GRAPHQL_MUTATION}(id: $id) }`, {
		token: probeToken,
		tenantId: probeTenantId,
		variables: { id: missingId }
	});
	record(
		`the ${PROBE_GRAPHQL_MUTATION} mutation refuses the same principal`,
		/FORBIDDEN|PERMISSION_DENIED|UNAUTHORIZED/i.test(String(errorCode(mutation))),
		`HTTP ${mutation.status} ${errorCode(mutation)}`
	);

	// A second GraphQL operation the principal may not run, against a different resolver. Two
	// independent refusals are what separate "the resolver's guards run over GraphQL and refuse this
	// caller" from "this one field failed for its own reason" — one field can fail on the row it
	// names, two cannot both do so by accident.
	const query = await graphql('query ProbeRead { orders { total } }', {
		token: probeToken,
		tenantId: probeTenantId
	});
	record(
		'a second GraphQL operation the principal may not run is refused too',
		/FORBIDDEN|PERMISSION_DENIED|UNAUTHORIZED/i.test(String(errorCode(query))),
		`HTTP ${query.status} ${errorCode(query)}`
	);

	// --- and the super administrator is still served --------------------------------------------
	const adminHard = await call('DELETE', `${RESOURCE}/${missingId}`, { token, tenantId });
	record(
		'the same DELETE reaches the handler for the super administrator',
		adminHard.status !== 403 && adminHard.status !== 401,
		`HTTP ${adminHard.status} ${brief(adminHard)}`
	);

	const adminSoft = await call('DELETE', `${RESOURCE}/${missingId}/soft`, { token, tenantId });
	record(
		'the same DELETE :id/soft reaches the handler for the super administrator',
		adminSoft.status !== 403 && adminSoft.status !== 401,
		`HTTP ${adminSoft.status} ${brief(adminSoft)}`
	);

	return finish();
}

function finish() {
	const failed = results.filter((result) => !result.ok).length;
	console.log('');
	console.log(`${results.length - failed}/${results.length} check(s) passed`);
	return failed === 0 ? 0 : 1;
}

let exitCode = 1;
try {
	exitCode = await main();
} catch (error) {
	console.error(`  FAIL  the probe threw: ${error?.message ?? error}`);
	exitCode = 1;
} finally {
	// The probe's own rows are removed even when a check failed, so a re-run starts clean.
	if (probeUserId || probeRolePermissionId || probeRoleId) {
		try {
			const login = await call('POST', '/api/auth/login', {
				body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
			});
			if (login.json?.token) await cleanUp(login.json.token, login.json.user?.tenantId);
		} catch (error) {
			console.error(`  cleanup failed: ${error?.message ?? error}`);
		}
	}
	console.log('');
	process.exit(exitCode);
}
