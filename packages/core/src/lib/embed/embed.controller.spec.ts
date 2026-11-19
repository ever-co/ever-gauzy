import { NotFoundException, RequestMethod } from '@nestjs/common';
import {
	GUARDS_METADATA,
	HEADERS_METADATA,
	HTTP_CODE_METADATA,
	METHOD_METADATA,
	PATH_METADATA
} from '@nestjs/common/constants';
import { Request } from 'express';
import { sign } from 'jsonwebtoken';
import { THROTTLER_LIMIT, THROTTLER_TRACKER } from '@nestjs/throttler/dist/throttler.constants';
import { PERMISSIONS_METADATA, PUBLIC_METHOD_METADATA } from '@gauzy/constants';
import { IEmbedClientReport, PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { EmbedClientService } from './embed-client.service';
import { EmbedCredentialService } from './embed-credential.service';
import {
	EmbedAllowedOriginController,
	EmbedCredentialController,
	EmbedProjectController,
	EmbedSiteGrantController,
	EmbedTokenController
} from './embed.controller';
import { EmbedSiteGrantService } from './embed-site-grant.service';
import { EmbedAllowedOriginService } from './embed-allowed-origin.service';
import { EmbedEnabledGuard } from './embed.guards';
import {
	EMBED_CLIENT_CLAIM,
	EMBED_CREDENTIAL_CLAIM,
	EMBED_EMPLOYEE_CLAIM,
	reachableByEmbedToken
} from './embed-session';
import { EMBED_TOKENS_ENV } from './embed.utils';
import { EMBED_EXCHANGE_LIMIT_PER_ADDRESS, embedExchangeAddress } from './embed-exchange-throttle';

/**
 * `POST /api/embed/client-report`, as the controller declares it: public (the credential is the proof), behind the
 * switch that answers 404 while embeds are off, answered 200, and handed to the service with the client address the
 * rate limiter resolves. Its rate limit is the exchange's (`embed-exchange-throttle.spec.ts`).
 */

const handler = EmbedTokenController.prototype.clientReport;

let savedSwitch: string | undefined;
beforeAll(() => {
	savedSwitch = process.env[EMBED_TOKENS_ENV];
});
// Each case starts with embeds off, whatever the developer's environment says, even when it runs alone.
beforeEach(() => {
	delete process.env[EMBED_TOKENS_ENV];
});
afterEach(() => {
	delete process.env[EMBED_TOKENS_ENV];
});
afterAll(() => {
	if (savedSwitch !== undefined) {
		process.env[EMBED_TOKENS_ENV] = savedSwitch;
	}
});

describe('POST /embed/client-report', () => {
	it('is a public POST under /embed, answered 200', () => {
		expect(Reflect.getMetadata(PATH_METADATA, EmbedTokenController)).toBe('/embed');
		expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe('/client-report');
		expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(RequestMethod.POST);
		expect(Reflect.getMetadata(HTTP_CODE_METADATA, handler)).toBe(200);
		expect(Reflect.getMetadata(PUBLIC_METHOD_METADATA, handler)).toBe(true);
	});

	it('answers 404 while embeds are off, through the switch the other embed routes have', () => {
		expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toEqual([EmbedEnabledGuard]);

		expect(() => new EmbedEnabledGuard().canActivate()).toThrow(NotFoundException);
		process.env[EMBED_TOKENS_ENV] = 'true';
		expect(new EmbedEnabledGuard().canActivate()).toBe(true);
	});

	it('hands the body and the client address to the service, and answers its report', async () => {
		const report = { client: { id: 'c', name: 'Northwind' } } as IEmbedClientReport;
		const clientReport = jest.fn(async () => report);
		const controller = new EmbedTokenController({ clientReport } as unknown as EmbedCredentialService);
		const body = { credential: 'gze_a-credential' };
		const request = { ip: '203.0.113.7', headers: {}, body } as unknown as Request;

		await expect(controller.clientReport(body, request)).resolves.toBe(report);

		expect(clientReport).toHaveBeenCalledWith(body, '203.0.113.7');
	});
});

describe('GET /embed-credentials/config', () => {
	it('tells the settings page what credentials and allowed sites can do here, with embeds on or off', () => {
		const controller = new EmbedCredentialController({} as EmbedCredentialService);
		const features = { clientLimits: true, addMembers: true, personSignIn: true };

		process.env[EMBED_TOKENS_ENV] = 'false';
		expect(controller.config()).toEqual({ enabled: false, ...features });
		process.env[EMBED_TOKENS_ENV] = 'true';
		expect(controller.config()).toEqual({ enabled: true, ...features });
	});
});

/**
 * `GET /api/embed/projects`, as the controller declares it: behind the switch, for a caller authenticated with a
 * permission an embed token keeps, and answered only to an embed token, with the projects of its client or member.
 */
describe('GET /embed/projects', () => {
	const TENANT = '7a000000-0000-4000-8000-00000000000a';
	const ORG = '7a000000-0000-4000-8000-0000000000f1';
	const EMPLOYEE = '7a000000-0000-4000-8000-0000000000e1';
	const CREDENTIAL = '7a000000-0000-4000-8000-0000000000c1';
	const CLIENT = '7a000000-0000-4000-8000-0000000000d1';
	const WEBSITE = { id: '7a000000-0000-4000-8000-0000000000a1', name: 'Website' };

	const projectsHandler = EmbedProjectController.prototype.projects;
	const embedClaims = { [EMBED_CREDENTIAL_CLAIM]: CREDENTIAL, [EMBED_EMPLOYEE_CLAIM]: EMPLOYEE };
	const bearer = (claims: Record<string, unknown>) =>
		`Bearer ${sign({ id: 'user', tenantId: TENANT, organizationId: ORG, ...claims }, 'any-secret')}`;
	const requestWith = (authorization: string) => ({ headers: { authorization } }) as unknown as Request;
	const authenticatedAs = (user: Record<string, unknown> | null) =>
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue(user as any);

	const build = () => {
		const trackableProjectsOf = jest.fn(async () => [WEBSITE]);
		const controller = new EmbedProjectController({ trackableProjectsOf } as unknown as EmbedClientService);
		return { controller, trackableProjectsOf };
	};

	afterEach(() => jest.restoreAllMocks());

	it('is a GET under /embed, behind the switch and the permission guards, never public', () => {
		expect(Reflect.getMetadata(PATH_METADATA, EmbedProjectController)).toBe('/embed');
		expect(Reflect.getMetadata(PATH_METADATA, projectsHandler)).toBe('/projects');
		expect(Reflect.getMetadata(METHOD_METADATA, projectsHandler)).toBe(RequestMethod.GET);
		expect(Reflect.getMetadata(GUARDS_METADATA, EmbedProjectController)).toEqual([
			EmbedEnabledGuard,
			TenantPermissionGuard,
			PermissionGuard
		]);
		expect(Reflect.getMetadata(PUBLIC_METHOD_METADATA, projectsHandler)).toBeUndefined();
		expect(Reflect.getMetadata(PUBLIC_METHOD_METADATA, EmbedProjectController)).toBeUndefined();

		expect(() => new EmbedEnabledGuard().canActivate()).toThrow(NotFoundException);
		process.env[EMBED_TOKENS_ENV] = 'true';
		expect(new EmbedEnabledGuard().canActivate()).toBe(true);
	});

	it('declares only a permission an embed token keeps', () => {
		const declared = Reflect.getMetadata(PERMISSIONS_METADATA, EmbedProjectController);

		expect(declared).toEqual([PermissionsEnum.TIME_TRACKER]);
		expect(reachableByEmbedToken({ embedCredentialId: CREDENTIAL }, declared)).toEqual(declared);
	});

	it("answers the client's projects to a token limited to a client", async () => {
		const { controller, trackableProjectsOf } = build();
		authenticatedAs({ id: 'user', embedCredentialId: CREDENTIAL });

		const answer = await controller.projects(requestWith(bearer({ ...embedClaims, [EMBED_CLIENT_CLAIM]: CLIENT })));

		expect(answer).toEqual([WEBSITE]);
		expect(trackableProjectsOf).toHaveBeenCalledWith({
			tenantId: TENANT,
			organizationId: ORG,
			employeeId: EMPLOYEE,
			clientId: CLIENT
		});
	});

	it("answers the member's projects to a token without a client", async () => {
		const { controller, trackableProjectsOf } = build();
		authenticatedAs({ id: 'user', embedCredentialId: CREDENTIAL });

		await expect(controller.projects(requestWith(bearer(embedClaims)))).resolves.toEqual([WEBSITE]);

		expect(trackableProjectsOf).toHaveBeenCalledWith({
			tenantId: TENANT,
			organizationId: ORG,
			employeeId: EMPLOYEE,
			clientId: null
		});
	});

	it('refuses with 403 EMBED_TOKEN_REQUIRED a request no embed token authenticated', async () => {
		const { controller, trackableProjectsOf } = build();
		const refused = { response: { statusCode: 403, code: 'EMBED_TOKEN_REQUIRED' } };

		authenticatedAs({ id: 'user' });
		await expect(controller.projects(requestWith(bearer({})))).rejects.toMatchObject(refused);
		// The embed claims, on a request its user was not authenticated with as that credential.
		await expect(controller.projects(requestWith(bearer(embedClaims)))).rejects.toMatchObject(refused);
		authenticatedAs({ id: 'user', embedCredentialId: '7a000000-0000-4000-8000-0000000000c2' });
		await expect(controller.projects(requestWith(bearer(embedClaims)))).rejects.toMatchObject(refused);
		authenticatedAs(null);
		await expect(controller.projects(requestWith(''))).rejects.toMatchObject(refused);

		expect(trackableProjectsOf).not.toHaveBeenCalled();
	});
});

/**
 * A person's sign-in from an allowed site, as the controller declares it: every route behind the switch, the
 * authorization for a signed-in person only, its answer never cached.
 */
describe('POST /embed/authorize', () => {
	const authorizeHandler = EmbedSiteGrantController.prototype.authorize;

	it('is a POST under /embed, behind the switch, for a signed-in person, answered 200 and never cached', () => {
		expect(Reflect.getMetadata(PATH_METADATA, EmbedSiteGrantController)).toBe('/embed');
		expect(Reflect.getMetadata(GUARDS_METADATA, EmbedSiteGrantController)).toEqual([EmbedEnabledGuard]);
		expect(Reflect.getMetadata(PATH_METADATA, authorizeHandler)).toBe('/authorize');
		expect(Reflect.getMetadata(METHOD_METADATA, authorizeHandler)).toBe(RequestMethod.POST);
		expect(Reflect.getMetadata(HTTP_CODE_METADATA, authorizeHandler)).toBe(200);
		expect(Reflect.getMetadata(GUARDS_METADATA, authorizeHandler)).toEqual([TenantPermissionGuard]);
		expect(Reflect.getMetadata(PUBLIC_METHOD_METADATA, authorizeHandler)).toBeUndefined();
		expect(Reflect.getMetadata(PUBLIC_METHOD_METADATA, EmbedSiteGrantController)).toBeUndefined();
		expect(Reflect.getMetadata(HEADERS_METADATA, authorizeHandler)).toEqual(
			expect.arrayContaining([{ name: 'Cache-Control', value: 'no-store' }])
		);
	});

	it('hands the body to the service and answers its tokens', async () => {
		const tokens = {
			token: 'a-timer-token',
			expiresAt: '2026-11-19T09:15:00.000Z',
			renewalToken: 'gzr_a-renewal-token',
			renewalExpiresAt: '2026-12-19T09:00:00.000Z'
		};
		const authorize = jest.fn(async () => tokens);
		const controller = new EmbedSiteGrantController({ authorize } as unknown as EmbedSiteGrantService);
		const body = { organizationId: '7a000000-0000-4000-8000-0000000000f1', origin: 'https://team.example.com' };

		await expect(controller.authorize(body)).resolves.toBe(tokens);

		expect(authorize).toHaveBeenCalledWith(body);
	});
});

/**
 * `POST /api/embed/renew`, as the controller declares it: public (the renewal token is the proof), behind the switch,
 * limited per address, never cached, and handed to the service with the request's Origin header.
 */
describe('POST /embed/renew', () => {
	const renewHandler = EmbedSiteGrantController.prototype.renew;

	it('is a public POST under /embed, limited per address, answered 200 and never cached', () => {
		expect(Reflect.getMetadata(PATH_METADATA, renewHandler)).toBe('/renew');
		expect(Reflect.getMetadata(METHOD_METADATA, renewHandler)).toBe(RequestMethod.POST);
		expect(Reflect.getMetadata(HTTP_CODE_METADATA, renewHandler)).toBe(200);
		expect(Reflect.getMetadata(PUBLIC_METHOD_METADATA, renewHandler)).toBe(true);
		expect(Reflect.getMetadata(GUARDS_METADATA, renewHandler)).toBeUndefined();
		expect(Reflect.getMetadata(`${THROTTLER_LIMIT}default`, renewHandler)).toBe(EMBED_EXCHANGE_LIMIT_PER_ADDRESS);
		expect(Reflect.getMetadata(`${THROTTLER_TRACKER}default`, renewHandler)).toBe(embedExchangeAddress);
		expect(Reflect.getMetadata(HEADERS_METADATA, renewHandler)).toEqual(
			expect.arrayContaining([{ name: 'Cache-Control', value: 'no-store' }])
		);
	});

	it("hands the body and the request's Origin header to the service, and answers its tokens", async () => {
		const tokens = { token: 'a-timer-token', renewalToken: 'gzr_next' };
		const renew = jest.fn(async () => tokens);
		const controller = new EmbedSiteGrantController({ renew } as unknown as EmbedSiteGrantService);
		const body = { renewalToken: 'gzr_a-renewal-token' };
		const request = { headers: { origin: 'https://team.example.com' }, body } as unknown as Request;

		await expect(controller.renew(body, request)).resolves.toBe(tokens);

		expect(renew).toHaveBeenCalledWith(body, 'https://team.example.com');
	});
});

/** `POST /api/embed/revoke`, the site's sign-out: public, behind the switch, limited per address, answered 204. */
describe('POST /embed/revoke', () => {
	const revokeHandler = EmbedSiteGrantController.prototype.revoke;

	it('is a public POST under /embed, limited per address, answered 204', () => {
		expect(Reflect.getMetadata(PATH_METADATA, revokeHandler)).toBe('/revoke');
		expect(Reflect.getMetadata(METHOD_METADATA, revokeHandler)).toBe(RequestMethod.POST);
		expect(Reflect.getMetadata(HTTP_CODE_METADATA, revokeHandler)).toBe(204);
		expect(Reflect.getMetadata(PUBLIC_METHOD_METADATA, revokeHandler)).toBe(true);
		expect(Reflect.getMetadata(`${THROTTLER_LIMIT}default`, revokeHandler)).toBe(EMBED_EXCHANGE_LIMIT_PER_ADDRESS);
		expect(Reflect.getMetadata(`${THROTTLER_TRACKER}default`, revokeHandler)).toBe(embedExchangeAddress);
	});

	it('hands the body to the service', async () => {
		const revoke = jest.fn(async () => undefined);
		const controller = new EmbedSiteGrantController({ revoke } as unknown as EmbedSiteGrantService);
		const body = { renewalToken: 'gzr_a-renewal-token' };

		await expect(controller.revoke(body)).resolves.toBeUndefined();

		expect(revoke).toHaveBeenCalledWith(body);
	});
});

/** `GET /api/embed/grants`: behind the switch, for a signed-in person, who names an organization to list everyone's. */
describe('GET /embed/grants', () => {
	const grantsHandler = EmbedSiteGrantController.prototype.grants;

	it('is a GET under /embed for a signed-in person, never public', () => {
		expect(Reflect.getMetadata(PATH_METADATA, grantsHandler)).toBe('/grants');
		expect(Reflect.getMetadata(METHOD_METADATA, grantsHandler)).toBe(RequestMethod.GET);
		expect(Reflect.getMetadata(GUARDS_METADATA, grantsHandler)).toEqual([TenantPermissionGuard]);
		expect(Reflect.getMetadata(PUBLIC_METHOD_METADATA, grantsHandler)).toBeUndefined();
	});

	it("asks the service for the person's own grants, or the organization's it names", async () => {
		const listGrants = jest.fn(async () => []);
		const controller = new EmbedSiteGrantController({ listGrants } as unknown as EmbedSiteGrantService);
		const organizationId = '7a000000-0000-4000-8000-0000000000f1';

		await controller.grants({});
		await controller.grants({ organizationId });

		expect(listGrants.mock.calls).toEqual([[undefined], [organizationId]]);
	});
});

/** `DELETE /api/embed/grants/:id`: behind the switch, for a signed-in person, answered 204. */
describe('DELETE /embed/grants/:id', () => {
	const revokeGrantHandler = EmbedSiteGrantController.prototype.revokeGrant;

	it('is a DELETE under /embed for a signed-in person, never public, answered 204', () => {
		expect(Reflect.getMetadata(PATH_METADATA, revokeGrantHandler)).toBe('/grants/:id');
		expect(Reflect.getMetadata(METHOD_METADATA, revokeGrantHandler)).toBe(RequestMethod.DELETE);
		expect(Reflect.getMetadata(HTTP_CODE_METADATA, revokeGrantHandler)).toBe(204);
		expect(Reflect.getMetadata(GUARDS_METADATA, revokeGrantHandler)).toEqual([TenantPermissionGuard]);
		expect(Reflect.getMetadata(PUBLIC_METHOD_METADATA, revokeGrantHandler)).toBeUndefined();
	});

	it('hands the grant to the service', async () => {
		const revokeGrant = jest.fn(async () => undefined);
		const controller = new EmbedSiteGrantController({ revokeGrant } as unknown as EmbedSiteGrantService);
		const id = '7a000000-0000-4000-8000-0000000000c9';

		await expect(controller.revokeGrant(id)).resolves.toBeUndefined();

		expect(revokeGrant).toHaveBeenCalledWith(id);
	});
});

/** `PATCH /api/embed-allowed-origins/:id`: the sign-in setting of an allowed site, with the permission of add and remove. */
describe('PATCH /embed-allowed-origins/:id', () => {
	const setHandler = EmbedAllowedOriginController.prototype.setPersonSignIn;

	it('is a PATCH of an allowed origin, behind the guards and the permission of add and remove', () => {
		expect(Reflect.getMetadata(PATH_METADATA, EmbedAllowedOriginController)).toBe('/embed-allowed-origins');
		expect(Reflect.getMetadata(PATH_METADATA, setHandler)).toBe('/:id');
		expect(Reflect.getMetadata(METHOD_METADATA, setHandler)).toBe(RequestMethod.PATCH);
		expect(Reflect.getMetadata(GUARDS_METADATA, EmbedAllowedOriginController)).toEqual([
			TenantPermissionGuard,
			PermissionGuard,
			EmbedEnabledGuard
		]);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, EmbedAllowedOriginController)).toEqual([
			PermissionsEnum.ALL_ORG_EDIT
		]);
		expect(Reflect.getMetadata(PUBLIC_METHOD_METADATA, setHandler)).toBeUndefined();
	});

	it('hands the origin and the setting to the service, and answers the origin', async () => {
		const origin = {
			id: '7a000000-0000-4000-8000-00000000d001',
			origin: 'https://team.example.com',
			allowPersonSignIn: true
		};
		const setPersonSignIn = jest.fn(async () => origin);
		const controller = new EmbedAllowedOriginController({
			setPersonSignIn
		} as unknown as EmbedAllowedOriginService);

		await expect(controller.setPersonSignIn(origin.id, { allowPersonSignIn: true })).resolves.toBe(origin);

		expect(setPersonSignIn).toHaveBeenCalledWith(origin.id, true);
	});
});
