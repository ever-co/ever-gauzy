import { decode } from 'jsonwebtoken';
import { ExtractJwt } from 'passport-jwt';

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
	 * The keys of a `where` the route takes. A route that takes one must name the token's organization in it: a tenant
	 * admin's "my teams" are every team of the tenant.
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
		where: ['organizationId', 'tenantId']
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
 * Reads the token exactly where `JwtStrategy` reads it. Passport takes the second word of the header when the first
 * is `Bearer`, so `Bearer <token> extra` authenticates: a pattern of our own that took the rest of the line found no
 * token in it, and the request went on with every right of its member (same lesson as `subscription-session.ts`).
 */
const extractBearerToken = ExtractJwt.fromAuthHeaderAsBearerToken();

/**
 * Reads the embed claims of a bearer token, without checking its signature: on an authenticated route the JWT guard
 * does that, and a forged claim can only restrict what its sender could do without it.
 *
 * @param authorization The request's `Authorization` header.
 * @returns The claims, or null for a token without them.
 */
export function readEmbedClaims(authorization: string | undefined): IEmbedClaims | null {
	if (typeof authorization !== 'string' || !authorization) {
		return null;
	}
	const token = extractBearerToken({ headers: { authorization } } as any);
	if (!token) {
		return null;
	}
	const payload = decode(token);
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
	if (route.where && where['organizationId'] !== claims.organizationId) {
		return false;
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
