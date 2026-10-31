/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service — the entity graph has
 * to finish initializing before anything applies `@IsEmployeeBelongsToOrganization()`. See the note
 * in `time-tracking/time-log/time-log.service.spec.ts`.
 */
import '../core/entities/internal';

// The i18n middleware is not part of this test module, and `@I18nLang()` throws without it: the language is fixed.
jest.mock('nestjs-i18n', () => {
	const { createParamDecorator } = jest.requireActual('@nestjs/common');
	return { ...jest.requireActual('nestjs-i18n'), I18nLang: createParamDecorator(() => 'en') };
});

import { CanActivate, ExecutionContext, INestApplication } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { PUBLIC_METHOD_METADATA } from '@gauzy/constants';
import { environment, IAuthSwitches } from '@gauzy/config';
import {
	AuthRefreshGuard,
	PermissionGuard,
	RegisterAuthorizationGuard,
	SubscriptionRequiredGuard,
	TenantPermissionGuard
} from '../shared/guards';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RegistrationPolicyService, SELF_REGISTRATION_DISABLED_MESSAGE, SelfRegistrationGuard } from './auth-switches';

/**
 * #5784 / #7821 at the HTTP boundary: `POST /api/auth/register` answers 403 to a public sign-up while the operator
 * has closed registration, lets an administrator's user creation through, and `GET /api/auth/registration/config`
 * tells the sign-in pages whether to show their Register links. The real controller, the real
 * `SelfRegistrationGuard` and the real `RegistrationPolicyService` run; the other guards and the tenant table are
 * stand-ins.
 */

const switches = environment as unknown as { authSwitches: IAuthSwitches };
const OPEN: IAuthSwitches = { userRegistration: true, tenantsRegistration: true, adminPasswordReset: true };

/**
 * Stands in for RegisterAuthorizationGuard, with its rule: only a body that carries a privileged field (here
 * `organizationId`) is authenticated, and a bearer token then marks an administrator. A body without one passes
 * unauthenticated even with a token, because it creates a tenant-less account exactly like a public sign-up.
 */
class AdminFromHeaderGuard implements CanActivate {
	canActivate(context: ExecutionContext): boolean {
		const req = context.switchToHttp().getRequest();
		if (req.body?.organizationId && req.headers.authorization) {
			req.user = { id: 'admin-id', tenantId: 'tenant-id' };
		}
		return true;
	}
}

const allow: CanActivate = { canActivate: () => true };

const ORGANIZATION_ID = '0f0f0f0f-0000-4000-8000-000000000001';

const signup = {
	user: { email: 'new.person@corp.test', firstName: 'New' },
	password: 'correct-horse-battery',
	confirmPassword: 'correct-horse-battery'
};

describe('AuthController — registration switches over HTTP', () => {
	jest.setTimeout(60_000);

	let app: INestApplication;
	let previousSwitches: IAuthSwitches;
	const execute = jest.fn(async () => ({ id: 'new-user-id' }));
	const tenantTable = { exists: jest.fn(async () => true) };

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({
			controllers: [AuthController],
			providers: [
				{ provide: AuthService, useValue: {} },
				{ provide: CommandBus, useValue: { execute } },
				{
					provide: RegistrationPolicyService,
					useFactory: () => new RegistrationPolicyService(tenantTable as never, { count: jest.fn() } as never)
				}
			]
		})
			.overrideGuard(RegisterAuthorizationGuard)
			.useValue(new AdminFromHeaderGuard())
			.overrideGuard(SubscriptionRequiredGuard)
			.useValue(allow)
			.overrideGuard(AuthRefreshGuard)
			.useValue(allow)
			.overrideGuard(PermissionGuard)
			.useValue(allow)
			.overrideGuard(TenantPermissionGuard)
			.useValue(allow)
			.compile();

		app = moduleRef.createNestApplication();
		app.setGlobalPrefix('api');
		await app.init();
	});

	afterAll(() => app?.close());

	beforeEach(() => {
		previousSwitches = switches.authSwitches;
		switches.authSwitches = { ...OPEN };
		execute.mockClear();
	});

	afterEach(() => {
		switches.authSwitches = previousSwitches;
	});

	it('runs SelfRegistrationGuard after RegisterAuthorizationGuard and before the subscription paywall', () => {
		const guards = Reflect.getMetadata('__guards__', AuthController.prototype.register);
		expect(guards).toEqual([RegisterAuthorizationGuard, SelfRegistrationGuard, SubscriptionRequiredGuard]);
	});

	it('registers a public sign-up with the default switches (today’s behaviour)', async () => {
		await request(app.getHttpServer()).post('/api/auth/register').send(signup).expect(201);
		expect(execute).toHaveBeenCalledTimes(1);
	});

	it.each([
		['APP_USER_REGISTRATION=false', { userRegistration: false }],
		['ALLOW_TENANTS_REGISTRATION=false', { tenantsRegistration: false }]
	])('refuses a public sign-up with 403 under %s', async (_label, closed) => {
		switches.authSwitches = { ...OPEN, ...closed };

		const response = await request(app.getHttpServer()).post('/api/auth/register').send(signup).expect(403);

		expect(response.body.message).toBe(SELF_REGISTRATION_DISABLED_MESSAGE);
		expect(execute).not.toHaveBeenCalled();
	});

	it('lets an administrator create a user in their tenant while registration is closed', async () => {
		switches.authSwitches = { ...OPEN, userRegistration: false, tenantsRegistration: false };

		await request(app.getHttpServer())
			.post('/api/auth/register')
			.set('Authorization', 'Bearer admin-token')
			.send({ ...signup, organizationId: ORGANIZATION_ID })
			.expect(201);
		expect(execute).toHaveBeenCalledTimes(1);
	});

	it('refuses a tenant-less sign-up while registration is closed, even with a token', async () => {
		switches.authSwitches = { ...OPEN, userRegistration: false };

		// Without a privileged field nothing ties the new account to the caller's tenant: it is a public sign-up.
		const response = await request(app.getHttpServer())
			.post('/api/auth/register')
			.set('Authorization', 'Bearer admin-token')
			.send(signup)
			.expect(403);

		expect(response.body.message).toBe(SELF_REGISTRATION_DISABLED_MESSAGE);
		expect(execute).not.toHaveBeenCalled();
	});

	it('publishes whether the public sign-up is open, without authentication', async () => {
		expect(new Reflector().get(PUBLIC_METHOD_METADATA, AuthController.prototype.registrationConfig)).toBe(true);

		await request(app.getHttpServer()).get('/api/auth/registration/config').expect(200, { enabled: true });

		switches.authSwitches = { ...OPEN, userRegistration: false };
		await request(app.getHttpServer()).get('/api/auth/registration/config').expect(200, { enabled: false });
	});
});
