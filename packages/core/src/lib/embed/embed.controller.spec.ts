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
import { PERMISSIONS_METADATA, PUBLIC_METHOD_METADATA } from '@gauzy/constants';
import { IEmbedClientReport, PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { EmbedClientService } from './embed-client.service';
import { EmbedCredentialService } from './embed-credential.service';
import {
	EmbedCredentialController,
	EmbedProjectController,
	EmbedSiteGrantController,
	EmbedTokenController
} from './embed.controller';
import { EmbedSiteGrantService } from './embed-site-grant.service';
import { EmbedEnabledGuard } from './embed.guards';
import {
	EMBED_CLIENT_CLAIM,
	EMBED_CREDENTIAL_CLAIM,
	EMBED_EMPLOYEE_CLAIM,
	reachableByEmbedToken
} from './embed-session';
import { EMBED_TOKENS_ENV } from './embed.utils';

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
	it('tells the settings page that a credential can be limited to a client and add members, with embeds on or off', () => {
		const controller = new EmbedCredentialController({} as EmbedCredentialService);

		process.env[EMBED_TOKENS_ENV] = 'false';
		expect(controller.config()).toEqual({ enabled: false, clientLimits: true, addMembers: true });
		process.env[EMBED_TOKENS_ENV] = 'true';
		expect(controller.config()).toEqual({ enabled: true, clientLimits: true, addMembers: true });
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
