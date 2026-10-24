import '../core/entities/internal';

import { ForbiddenException } from '@nestjs/common';
import { RequestContext } from '../core/context';
import { AuthService } from './auth.service';

/**
 * Owner decision Q12 (2026-10-24): an OAuth app (Zapier, Ever Async...) gets an access token that carries the client
 * and the scopes the user approved, and `JwtStrategy` holds every request it authenticates to them. The token used to
 * be an ordinary one: the user's full role, the approved scope echoed back and never enforced.
 *
 * The actions that belong to the user's own session — approving an app, and the routes that mint first-party tokens
 * (workspace and organization switch, the workspace list's sign-in tokens) — refuse an OAuth-app token outright: a
 * token minted there would carry no scopes, so the app could trade its scoped token for an unrestricted one.
 */

const TENANT = '7b000000-0000-4000-8000-000000000001';
const ORG_A = '7b000000-0000-4000-8000-0000000000a1';

const CLIENT_ID = 'zapier-app';
const CODE_SECRET = 'code-signing-secret';
const CLIENT_SECRET = 'zapier-secret';
const REDIRECT_URI = 'https://zapier.com/dashboard/auth/oauth/return/App123/';
const ZAPIER_SCOPE = 'zap zap:write authentication';

const MEMBER = {
	id: '7b000000-0000-4000-8000-00000000c001',
	tenantId: TENANT,
	lastOrganizationId: ORG_A,
	isActive: true,
	isArchived: false,
	role: { name: 'EMPLOYEE', rolePermissions: [] }
};

const EMPLOYEES = [
	{
		id: 'employee-in-a',
		userId: MEMBER.id,
		tenantId: TENANT,
		organizationId: ORG_A,
		isActive: true,
		isArchived: false
	}
];

/** Equality on every key of a TypeORM-style `where`. */
const matches = (row: Record<string, unknown>, where: Record<string, unknown>) =>
	Object.entries(where).every(([key, value]) => row[key] === value);

/**
 * An AuthService with the REAL authorization-code issue and exchange and the REAL `getJwtAccessToken`, over an
 * in-memory cache, user and employee table. `generate` records every token payload.
 */
function buildAuthService() {
	const service: AuthService = Object.create(AuthService.prototype);
	const cache = new Map<string, unknown>();
	const generate = jest.fn(async (_userId: string, payload: Record<string, unknown>) => ({ payload }));

	Object.assign(service, {
		ormType: 'typeorm',
		logger: { error: jest.fn(), warn: jest.fn(), log: jest.fn(), debug: jest.fn() },
		consumedOAuthCodes: new Set<string>(),
		redisClient: null,
		cacheManager: {
			set: jest.fn(async (key: string, value: unknown) => void cache.set(key, value)),
			get: jest.fn(async (key: string) => cache.get(key) ?? null),
			del: jest.fn(async (key: string) => void cache.delete(key))
		},
		resolveOAuthClient: jest.fn(async () => ({
			clientId: CLIENT_ID,
			clientSecretHash: 'stored-hash',
			redirectUris: [REDIRECT_URI],
			codeSecret: CODE_SECRET,
			name: 'Zapier',
			allowedScopes: ['zap', 'zap:write', 'authentication'],
			allowedGrantTypes: ['authorization_code'],
			pkceRequired: false,
			accessTokenTtl: 3600,
			tenantId: null
		})),
		oauthClientService: { validateClientSecret: jest.fn(async () => true) },
		hasActiveOrganizationMembership: jest.fn(async () => true),
		typeOrmUserRepository: {
			findOne: jest.fn(async ({ where }) => ([MEMBER] as any[]).find((row) => matches(row, where)) ?? null)
		},
		typeOrmEmployeeRepository: {
			findOne: jest.fn(async ({ where }) => EMPLOYEES.find((row) => matches(row, where)) ?? null),
			find: jest.fn(async ({ where }) => EMPLOYEES.filter((row) => matches(row, where)))
		},
		accessTokenService: { generate }
	});

	return { service, generate };
}

/** Approves the app in ORG_A for `scope`, as `OAuthAppController.approveAuthorize` does. */
function approve(service: AuthService, scope?: string) {
	return service.createOAuthAppAuthorizationCode({
		userId: MEMBER.id,
		tenantId: TENANT,
		organizationId: ORG_A,
		clientId: CLIENT_ID,
		redirectUri: REDIRECT_URI,
		scope
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

/** The payload of the access token the exchange minted. */
function mintedPayload(generate: jest.Mock): Record<string, unknown> {
	return generate.mock.calls[generate.mock.calls.length - 1][1];
}

beforeEach(() => {
	jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
	jest.spyOn(RequestContext, 'currentIp').mockReturnValue('203.0.113.7');
	jest.spyOn(RequestContext, 'currentUserAgent').mockReturnValue('jest');
});

afterEach(() => {
	jest.restoreAllMocks();
});

describe('AuthService — an OAuth app token carries the scopes the user approved (Q12)', () => {
	it('writes the approved client and scopes into the access token', async () => {
		const { service, generate } = buildAuthService();

		const response = await exchange(service, await approve(service, ZAPIER_SCOPE));

		expect(mintedPayload(generate)).toEqual(
			expect.objectContaining({
				id: MEMBER.id,
				organizationId: ORG_A,
				oauthApp: { clientId: CLIENT_ID, scopes: ['zap', 'zap:write', 'authentication'] }
			})
		);
		expect(response.scope).toBe(ZAPIER_SCOPE);
	});

	it('scopes a token approved without any scope to identity only (no permission)', async () => {
		const { service, generate } = buildAuthService();

		await exchange(service, await approve(service));

		expect(mintedPayload(generate)).toEqual(
			expect.objectContaining({ oauthApp: { clientId: CLIENT_ID, scopes: [] } })
		);
	});

	it('lets the user approve an app in their own session', async () => {
		const { service } = buildAuthService();

		await expect(approve(service, ZAPIER_SCOPE)).resolves.toMatch(/^v1\./);
	});

	describe('a request authenticated by an OAuth-app token', () => {
		beforeEach(() => {
			jest.spyOn(RequestContext, 'currentOAuthAppScopes').mockReturnValue(['zap', 'zap:write']);
		});

		it('cannot approve an application', async () => {
			const { service, generate } = buildAuthService();

			await expect(approve(service, ZAPIER_SCOPE)).rejects.toBeInstanceOf(ForbiddenException);
			expect(generate).not.toHaveBeenCalled();
		});

		it('cannot switch organization, switch workspace or list the workspaces’ sign-in tokens', async () => {
			const { service, generate } = buildAuthService();

			await expect(service.switchOrganization(ORG_A)).rejects.toBeInstanceOf(ForbiddenException);
			await expect(service.switchWorkspace(TENANT)).rejects.toBeInstanceOf(ForbiddenException);
			await expect(service.getUserWorkspaces()).rejects.toBeInstanceOf(ForbiddenException);
			expect(generate).not.toHaveBeenCalled();
		});
	});
});
