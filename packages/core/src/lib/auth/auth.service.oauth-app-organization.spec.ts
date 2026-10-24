import '../core/entities/internal';

import { createHmac, randomBytes } from 'node:crypto';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { RequestContext } from '../core/context';
import { AuthService } from './auth.service';

/**
 * An OAuth app (Zapier, Activepieces...) gets an access token scoped to the organization the user approved it in.
 *
 * `exchangeOAuthAppAuthorizationCode` used to call `getJwtAccessToken({ id, tenantId })` with no organization, so
 * the token named whichever active employee record of the user the database returned first. Since the organization
 * boundary (ever-co/ever-gauzy#11316) confines a non-admin to the organization of their token, a member of two
 * organizations got an app pinned to an arbitrary one of them, and Zapier resolved its integration
 * (`findIntegrationByTenantId(tenantId, organizationId)`) in that organization too. The authorization code now
 * records the organization of the approving session, checked against the user's memberships, and the exchange mints
 * the token for it.
 */

const TENANT = '7a000000-0000-4000-8000-000000000001';
const ORG_A = '7a000000-0000-4000-8000-0000000000a1';
const ORG_B = '7a000000-0000-4000-8000-0000000000b1';
const ORG_FOREIGN = '7a000000-0000-4000-8000-0000000000f1';

const CLIENT_ID = 'zapier-app';
const CODE_SECRET = 'code-signing-secret';
const CLIENT_SECRET = 'zapier-secret';
const REDIRECT_URI = 'https://zapier.com/dashboard/auth/oauth/return/App123/';

/** An employee of both organizations: the record of ORG_A is the one a lookup without organization finds first. */
const MEMBER = {
	id: '7a000000-0000-4000-8000-00000000c001',
	tenantId: TENANT,
	lastOrganizationId: ORG_B,
	isActive: true,
	isArchived: false,
	role: { name: 'EMPLOYEE', rolePermissions: [] }
};

const employee = (id: string, organizationId: string) => ({
	id,
	userId: MEMBER.id,
	tenantId: TENANT,
	organizationId,
	isActive: true,
	isArchived: false
});

const EMPLOYEES = [employee('employee-in-a', ORG_A), employee('employee-in-b', ORG_B)];

/** The user's active memberships. */
let memberships: Array<{ userId: string; organizationId: string; tenantId: string }>;

/** Equality on every key of a TypeORM-style `where`. */
const matches = (row: Record<string, unknown>, where: Record<string, unknown>) =>
	Object.entries(where).every(([key, value]) => row[key] === value);

/**
 * An AuthService with the REAL authorization-code issue and exchange and the REAL `getJwtAccessToken`, over an
 * in-memory cache, user table, employee table and membership check. `generate` records every token payload.
 */
function buildAuthService() {
	const service: AuthService = Object.create(AuthService.prototype);
	const cache = new Map<string, unknown>();
	const generate = jest.fn(async (_userId: string, payload: Record<string, unknown>) => ({ payload }));
	const cacheManager = {
		set: jest.fn(async (key: string, value: unknown) => void cache.set(key, value)),
		get: jest.fn(async (key: string) => cache.get(key) ?? null),
		del: jest.fn(async (key: string) => void cache.delete(key))
	};
	const hasActiveOrganizationMembership = jest.fn(async (userId: string, organizationId: string, tenantId: string) =>
		memberships.some((row) => matches(row, { userId, organizationId, tenantId }))
	);

	Object.assign(service, {
		ormType: 'typeorm',
		logger: { error: jest.fn(), warn: jest.fn(), log: jest.fn(), debug: jest.fn() },
		consumedOAuthCodes: new Set<string>(),
		redisClient: null,
		cacheManager,
		resolveOAuthClient: jest.fn(async () => ({
			clientId: CLIENT_ID,
			clientSecretHash: 'stored-hash',
			redirectUris: [REDIRECT_URI],
			codeSecret: CODE_SECRET,
			name: 'Zapier',
			allowedScopes: [],
			allowedGrantTypes: ['authorization_code'],
			pkceRequired: false,
			accessTokenTtl: 3600,
			tenantId: null
		})),
		oauthClientService: { validateClientSecret: jest.fn(async () => true) },
		hasActiveOrganizationMembership,
		typeOrmUserRepository: {
			findOne: jest.fn(async ({ where }) => ([MEMBER] as any[]).find((row) => matches(row, where)) ?? null)
		},
		typeOrmEmployeeRepository: {
			findOne: jest.fn(async ({ where }) => EMPLOYEES.find((row) => matches(row, where)) ?? null),
			find: jest.fn(async ({ where }) => EMPLOYEES.filter((row) => matches(row, where)))
		},
		accessTokenService: { generate }
	});

	return { service, generate, hasActiveOrganizationMembership, cache };
}

/**
 * A code as `createOAuthAppAuthorizationCode` issued it before the organization was recorded: the same signed
 * `v1.<payload>.<signature>` shape, with no `organizationId` member, and live in the cache.
 */
function legacyCode(cache: Map<string, unknown>): string {
	const jti = randomBytes(32).toString('base64url');
	const payload = Buffer.from(
		JSON.stringify({
			jti,
			userId: MEMBER.id,
			tenantId: TENANT,
			clientId: CLIENT_ID,
			redirectUri: REDIRECT_URI,
			scope: '',
			exp: Math.floor(Date.now() / 1000) + 600
		})
	).toString('base64url');
	cache.set(`oauth_app_code:${jti}`, 'valid');

	return `v1.${payload}.${createHmac('sha256', CODE_SECRET).update(payload).digest('base64url')}`;
}

/** Approves the app for `organizationId`, as `OAuthAppController.approveAuthorize` does. */
function approve(service: AuthService, organizationId: string | null | undefined) {
	return service.createOAuthAppAuthorizationCode({
		userId: MEMBER.id,
		tenantId: TENANT,
		organizationId,
		clientId: CLIENT_ID,
		redirectUri: REDIRECT_URI
	});
}

/** Exchanges a code at `/token`, as the app does. */
function exchange(service: AuthService, code: string) {
	return service.exchangeOAuthAppAuthorizationCode({
		code,
		clientId: CLIENT_ID,
		clientSecret: CLIENT_SECRET,
		redirectUri: REDIRECT_URI
	});
}

/** The JSON payload of an authorization code, which is signed but not encrypted. */
function codePayload(code: string): Record<string, unknown> {
	return JSON.parse(Buffer.from(code.split('.')[1], 'base64url').toString());
}

/** The payload of the access token the exchange minted. */
function mintedPayload(generate: jest.Mock): Record<string, unknown> {
	return generate.mock.calls[generate.mock.calls.length - 1][1];
}

beforeEach(() => {
	memberships = [
		{ userId: MEMBER.id, organizationId: ORG_A, tenantId: TENANT },
		{ userId: MEMBER.id, organizationId: ORG_B, tenantId: TENANT }
	];
	jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
	jest.spyOn(RequestContext, 'currentIp').mockReturnValue('203.0.113.7');
	jest.spyOn(RequestContext, 'currentUserAgent').mockReturnValue('jest');
});

afterEach(() => {
	jest.restoreAllMocks();
});

describe('AuthService — an OAuth app token names the organization it was approved in', () => {
	it('records the approving session’s organization in the code, after checking the membership', async () => {
		const { service, hasActiveOrganizationMembership } = buildAuthService();

		const code = await approve(service, ORG_B);

		expect(codePayload(code)).toEqual(
			expect.objectContaining({ userId: MEMBER.id, tenantId: TENANT, organizationId: ORG_B })
		);
		expect(hasActiveOrganizationMembership).toHaveBeenCalledWith(MEMBER.id, ORG_B, TENANT);
	});

	it('mints the token for that organization, with the employee record of that organization', async () => {
		const { service, generate } = buildAuthService();

		const code = await approve(service, ORG_B);
		await exchange(service, code);

		// Without the organization, the lookup finds the ORG_A record first and the token would name ORG_A.
		expect(mintedPayload(generate)).toEqual(
			expect.objectContaining({
				id: MEMBER.id,
				tenantId: TENANT,
				organizationId: ORG_B,
				employeeId: 'employee-in-b'
			})
		);
	});

	it('mints the token for the other organization when the app is approved there', async () => {
		const { service, generate } = buildAuthService();

		await exchange(service, await approve(service, ORG_A));

		expect(mintedPayload(generate)).toEqual(
			expect.objectContaining({ organizationId: ORG_A, employeeId: 'employee-in-a' })
		);
	});

	it('refuses to approve for an organization the user is not a member of', async () => {
		const { service } = buildAuthService();

		await expect(approve(service, ORG_FOREIGN)).rejects.toBeInstanceOf(ForbiddenException);
	});

	it('refuses the exchange when the membership was revoked after the approval', async () => {
		const { service, generate } = buildAuthService();
		const code = await approve(service, ORG_B);

		memberships = memberships.filter((row) => row.organizationId !== ORG_B);

		await expect(exchange(service, code)).rejects.toBeInstanceOf(UnauthorizedException);
		expect(generate).not.toHaveBeenCalled();
	});

	it('keeps the previous behaviour for a session with no organization', async () => {
		const { service, generate, hasActiveOrganizationMembership } = buildAuthService();

		const code = await approve(service, null);
		expect(codePayload(code).organizationId).toBeNull();

		await exchange(service, code);

		// The token is minted as before: no organization was asked for, so the first employee record decides.
		expect(hasActiveOrganizationMembership).not.toHaveBeenCalled();
		expect(mintedPayload(generate)).toEqual(expect.objectContaining({ id: MEMBER.id, organizationId: ORG_A }));
	});

	it('still exchanges a code issued before the organization was recorded', async () => {
		const { service, generate, cache, hasActiveOrganizationMembership } = buildAuthService();

		await exchange(service, legacyCode(cache));

		expect(hasActiveOrganizationMembership).not.toHaveBeenCalled();
		expect(mintedPayload(generate)).toEqual(expect.objectContaining({ id: MEMBER.id, organizationId: ORG_A }));
	});

	it('keeps the code single-use', async () => {
		const { service } = buildAuthService();
		const code = await approve(service, ORG_B);

		await exchange(service, code);

		await expect(exchange(service, code)).rejects.toBeInstanceOf(UnauthorizedException);
	});
});
