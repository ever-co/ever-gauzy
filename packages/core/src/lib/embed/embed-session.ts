import { decode } from 'jsonwebtoken';

/**
 * The access-token claims that mark a token minted by the embed exchange: the credential behind it and the one member
 * it acts for. Such a token reaches only the routes of {@link EMBED_ROUTES}; `EmbedSessionGuard` enforces it.
 */
export const EMBED_CREDENTIAL_CLAIM = 'embedCredentialId';
export const EMBED_EMPLOYEE_CLAIM = 'embedEmployeeId';

export interface IEmbedClaims {
	credentialId: string;
	employeeId: string;
	organizationId: string | null;
	tenantId: string | null;
}

/**
 * The routes a timer widget needs, and nothing else: the signed-in user and their permissions and teams (to draw the
 * widget), the timer's status, start and stop. Time-log reads, statistics, time slots and every write besides start and
 * stop stay closed, so a leaked embed token can neither read the workspace nor backdate time.
 */
export const EMBED_ROUTES: ReadonlyArray<{ method: string; path: RegExp }> = [
	{ method: 'GET', path: /^\/api\/user\/me\/?$/ },
	{ method: 'GET', path: /^\/api\/role-permissions\/me\/?$/ },
	{ method: 'GET', path: /^\/api\/organization-team\/me\/?$/ },
	{ method: 'GET', path: /^\/api\/timesheet\/timer\/status\/?$/ },
	{ method: 'POST', path: /^\/api\/timesheet\/timer\/(start|stop)\/?$/ }
];

/** The body fields of a start or a stop that an embed may not set: they would let it backdate time. */
export const EMBED_FORBIDDEN_TIMER_FIELDS = ['startedAt', 'stoppedAt', 'manualTimeSlot'] as const;

/**
 * Reads the embed claims of a bearer token, without checking its signature: on an authenticated route the JWT guard
 * does that, and a forged claim can only restrict what its sender could do without it.
 *
 * @param authorization The request's `Authorization` header.
 * @returns The claims, or null for a token without them.
 */
export function readEmbedClaims(authorization: string | undefined): IEmbedClaims | null {
	const match = /^Bearer\s+(.+)$/i.exec(authorization ?? '');
	if (!match) {
		return null;
	}
	const payload = decode(match[1]);
	if (!payload || typeof payload !== 'object') {
		return null;
	}
	const record = payload as Record<string, unknown>;
	const credentialId = record[EMBED_CREDENTIAL_CLAIM];
	if (typeof credentialId !== 'string' || !credentialId) {
		return null;
	}
	return {
		credentialId,
		employeeId: String(record[EMBED_EMPLOYEE_CLAIM] ?? ''),
		organizationId: typeof record['organizationId'] === 'string' ? record['organizationId'] : null,
		tenantId: typeof record['tenantId'] === 'string' ? record['tenantId'] : null
	};
}

/** Whether an embed token may reach this route. The path is without its query string. */
export function isEmbedRoute(method: string, path: string): boolean {
	const upper = method.toUpperCase();
	return EMBED_ROUTES.some((route) => route.method === upper && route.path.test(path));
}
