import { decode, verify } from 'jsonwebtoken';
import { ExtractJwt } from 'passport-jwt';
import { PermissionsEnum } from '@gauzy/contracts';
import { JWT_ALGORITHMS } from '../auth/purpose-token';

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

/** A route an embed token may reach, and what it may ask of it. */
export interface IEmbedRoute {
	readonly method: string;
	readonly path: RegExp;
	/**
	 * The query parameters an embed may send to the route; any other is refused. `relations`, `select`, `join` and
	 * the like are never among them: the token keeps its member's role, and they would load records far past the
	 * timer (`/user/me?relations=organizations.organization.employees.timeLogs`).
	 */
	readonly query: ReadonlyArray<string>;
	/**
	 * The keys of a `where` the route takes. A route that takes one must name the token's organization and member in it
	 * (`where[organizationId]`, `where[members][employeeId]`): for a member who may act for every employee, "my teams"
	 * are every team of the tenant.
	 */
	readonly where?: ReadonlyArray<string>;
}

/**
 * The routes a timer widget needs, and nothing else: the signed-in user and their permissions and teams (to draw the
 * widget), the timer's status, start and stop. Time-log reads, statistics, time slots and every write besides start and
 * stop stay closed, so a leaked embed token can neither read the workspace nor backdate time.
 */
export const EMBED_ROUTES: ReadonlyArray<IEmbedRoute> = [
	{ method: 'GET', path: /^\/api\/user\/me\/?$/, query: ['includeEmployee', 'includeOrganization'] },
	{ method: 'GET', path: /^\/api\/role-permissions\/me\/?$/, query: [] },
	{
		method: 'GET',
		path: /^\/api\/organization-team\/me\/?$/,
		query: ['where'],
		where: ['organizationId', 'tenantId', 'members']
	},
	{
		method: 'GET',
		path: /^\/api\/timesheet\/timer\/status\/?$/,
		query: ['organizationId', 'tenantId', 'employeeId', 'source', 'todayStart', 'todayEnd']
	},
	{ method: 'POST', path: /^\/api\/timesheet\/timer\/(start|stop)\/?$/, query: [] }
];

/** The body fields of a start or a stop that an embed may not set: they would let it backdate time. */
export const EMBED_FORBIDDEN_TIMER_FIELDS = ['startedAt', 'stoppedAt', 'manualTimeSlot'] as const;

/**
 * The permissions an embed token acts with, whatever its member's role holds: `TIME_TRACKER` for the timer's start,
 * stop and status, `ORG_TEAM_VIEW` for the member's teams; the user and their role's permissions need none. The token
 * gets its role's permissions intersected with these at every check (`JwtStrategy`, `PermissionGuard`,
 * `TenantPermissionGuard`): an administrator's token is answered as a member's, without `ALL_ORG_VIEW` or
 * `CHANGE_SELECTED_EMPLOYEE`, and a role without one of these never gains it.
 */
export const EMBED_TOKEN_PERMISSIONS: ReadonlyArray<PermissionsEnum> = [
	PermissionsEnum.TIME_TRACKER,
	PermissionsEnum.ORG_TEAM_VIEW
];

/** Narrows permissions (a role's, or the ones a route declares) to {@link EMBED_TOKEN_PERMISSIONS}. */
export function narrowPermissionsToEmbedToken(permissions: readonly PermissionsEnum[]): PermissionsEnum[] {
	return (permissions ?? []).filter((permission) => EMBED_TOKEN_PERMISSIONS.includes(permission));
}

/**
 * The permissions among `permissions` a request user may be granted: every one of them, but only those of
 * {@link EMBED_TOKEN_PERMISSIONS} for a user `JwtStrategy` authenticated with an embed token.
 *
 * @param user The request user.
 * @param permissions The permissions a route declares.
 */
export function reachableByEmbedToken(
	user: { embedCredentialId?: string | null } | null | undefined,
	permissions: PermissionsEnum[]
): PermissionsEnum[] {
	if (!user?.embedCredentialId) {
		return permissions;
	}
	return narrowPermissionsToEmbedToken(permissions);
}

/**
 * Reads the token exactly where `JwtStrategy` reads it. Passport takes the second word of the header when the first
 * is `Bearer`, so `Bearer <token> extra` authenticates: a pattern of our own that took the rest of the line found no
 * token in it, and the request went on with every right of its member (same lesson as `subscription-session.ts`).
 */
const extractBearerToken = ExtractJwt.fromAuthHeaderAsBearerToken();

/** The bearer token of an `Authorization` header, read where `JwtStrategy` reads it; null without one. */
export function bearerTokenOf(authorization: unknown): string | null {
	if (typeof authorization !== 'string' || !authorization) {
		return null;
	}
	return extractBearerToken({ headers: { authorization } } as any) || null;
}

/**
 * The credential a token payload was minted for by the embed exchange.
 *
 * @param payload A token's payload.
 * @returns The credential's id, or null for a token without the embed claims.
 */
export function embedCredentialIdOf(payload: unknown): string | null {
	if (!payload || typeof payload !== 'object') {
		return null;
	}
	const credentialId = (payload as Record<string, unknown>)[EMBED_CREDENTIAL_CLAIM];
	if (typeof credentialId !== 'string' || !credentialId) {
		return null;
	}
	return credentialId;
}

/**
 * Reads the embed claims of a bearer token, without checking its signature: a forged claim can only restrict what its
 * sender could do without it. Nothing is looked up with them before {@link isSignedBearerToken} holds.
 *
 * @param authorization The request's `Authorization` header.
 * @returns The claims, or null for a token without them.
 */
export function readEmbedClaims(authorization: string | undefined): IEmbedClaims | null {
	const token = bearerTokenOf(authorization);
	if (!token) {
		return null;
	}
	let payload: unknown;
	try {
		payload = decode(token);
	} catch {
		// `jws` throws on a header typed JWT over a payload that is not JSON: not an embed token, and not this
		// guard's to refuse (the JWT guard judges the routes that need a token).
		return null;
	}
	const credentialId = embedCredentialIdOf(payload);
	if (!credentialId) {
		return null;
	}
	const record = payload as Record<string, unknown>;
	return {
		credentialId,
		employeeId: String(record[EMBED_EMPLOYEE_CLAIM] ?? ''),
		organizationId: typeof record['organizationId'] === 'string' ? record['organizationId'] : null,
		tenantId: typeof record['tenantId'] === 'string' ? record['tenantId'] : null
	};
}

/**
 * Whether the bearer token carries a valid signature of this server and has not expired. The embed guard is global and
 * runs before the JWT guard, so it checks this before it looks the token's credential up: a forged token must not
 * cost a query or a place in the revocation cache.
 *
 * @param authorization The request's `Authorization` header.
 * @param secret The secret access tokens are signed with.
 */
export function isSignedBearerToken(authorization: unknown, secret: string | undefined): boolean {
	const token = bearerTokenOf(authorization);
	if (!token || !secret) {
		return false;
	}
	try {
		verify(token, secret, { algorithms: JWT_ALGORITHMS });
		return true;
	} catch {
		return false;
	}
}

/** The embed route a request reaches, or null. The path is without its query string. */
export function embedRouteOf(method: string, path: string): IEmbedRoute | null {
	const upper = String(method ?? '').toUpperCase();
	return EMBED_ROUTES.find((route) => route.method === upper && route.path.test(path)) ?? null;
}

/** Whether an embed token may reach this route. The path is without its query string. */
export function isEmbedRoute(method: string, path: string): boolean {
	return !!embedRouteOf(method, path);
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const isNamed = (value: unknown) => value !== undefined && value !== null && value !== '';

/**
 * Whether a request to an embed route stays inside the token's scope: only the query parameters the route takes, and
 * no organization, tenant or member but the token's, wherever the request names one (query, `where`, body, header).
 * Each place is checked on its own: a handler that reads the body must not be let through by a query that agrees.
 *
 * @param route The route the request reaches.
 * @param request Its query, body and headers.
 * @param claims The token's embed claims.
 */
export function isWithinEmbedScope(
	route: IEmbedRoute,
	request: { query?: unknown; body?: unknown; headers?: Record<string, unknown> },
	claims: IEmbedClaims
): boolean {
	const query = isRecord(request.query) ? request.query : {};
	if (isNamed(request.body) && !isRecord(request.body)) {
		return false;
	}
	const body = isRecord(request.body) ? request.body : {};
	const headers = request.headers ?? {};

	if (Object.keys(query).some((key) => !route.query.includes(key))) {
		return false;
	}

	let where: Record<string, unknown> = {};
	if (query['where'] !== undefined) {
		if (!isRecord(query['where'])) {
			return false;
		}
		where = query['where'];
		if (Object.keys(where).some((key) => !(route.where ?? []).includes(key))) {
			return false;
		}
	}
	if (route.where) {
		if (where['organizationId'] !== claims.organizationId) {
			return false;
		}
		const members = where['members'];
		const namesOnlyItsMember =
			isRecord(members) && Object.keys(members).length === 1 && members['employeeId'] === claims.employeeId;
		if (!namesOnlyItsMember) {
			return false;
		}
	}

	const organizations = [query['organizationId'], where['organizationId'], body['organizationId'], headers['organization-id']];
	if (organizations.some((value) => isNamed(value) && value !== claims.organizationId)) {
		return false;
	}
	const tenants = [query['tenantId'], where['tenantId'], body['tenantId'], headers['tenant-id']];
	if (tenants.some((value) => isNamed(value) && value !== claims.tenantId)) {
		return false;
	}
	const employees = [query['employeeId'], body['employeeId']];
	if (employees.some((value) => isNamed(value) && value !== claims.employeeId)) {
		return false;
	}
	return true;
}
