/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service — the entity graph has
 * to finish initializing before TenantService (and the repositories it imports) are evaluated.
 */
import '../core/entities/internal';
import { ForbiddenException } from '@nestjs/common';
import { environment, IAuthSwitches } from '@gauzy/config';
import { MultiORMEnum } from '../core/utils';
import * as utils from '../core/utils';
import {
	RegistrationPolicyService,
	TENANT_REGISTRATION_DISABLED_MESSAGE
} from '../auth/auth-switches/registration-policy.service';
import { TenantService } from './tenant.service';

/**
 * #7821: with `ALLOW_TENANTS_REGISTRATION=false` nobody creates a new tenant (workspace) once the installation has
 * one, through REST (`POST /tenant`) or GraphQL (`createTenant`): both reach `TenantService.onboardTenant`. A new
 * installation still creates its first tenant, and a creator still finishes the tenant their own failed attempt left
 * behind (that adds no workspace). The real policy runs here, over an in-memory tenant table.
 */

const USER_ID = '66666666-6666-4666-8666-666666666666';
const NEW_TENANT = '77777777-7777-4777-8777-777777777777';
const UNFINISHED_TENANT = '88888888-8888-4888-8888-888888888888';

const switches = environment as unknown as { authSwitches: IAuthSwitches };
let previousSwitches: IAuthSwitches;

/** A TenantService whose installation holds `tenants` tenants, and `unfinished` left behind by this creator. */
function buildService({ tenants = 1, unfinished = false } = {}) {
	const service: any = Object.create(TenantService.prototype);
	Object.defineProperty(service, 'ormType', { get: () => MultiORMEnum.TypeORM });
	// The creator's unfinished tenant has no user and no organization yet.
	service.typeOrmRepository = { manager: { getRepository: () => ({ exists: jest.fn(async () => false) }) } };
	service.find = jest.fn(async () => (unfinished ? [{ id: UNFINISHED_TENANT, name: 'First try' }] : []));
	service.create = jest.fn(async (input: any) => ({ id: NEW_TENANT, ...input }));
	service.update = jest.fn(async () => ({ affected: 1 }));
	service.findOneByIdString = jest.fn(async () => undefined);
	service.commandBus = { execute: jest.fn(async () => []) };
	service.executeTenantUpdateTasks = jest.fn(async () => undefined);
	service.typeOrmRoleRepository = { findOneBy: jest.fn(async ({ tenantId }: any) => ({ id: `role-${tenantId}` })) };
	service.typeOrmUserRepository = {
		exists: jest.fn(async () => false),
		update: jest.fn(async () => ({ affected: 1 }))
	};
	service.linkStripeCustomerAtOnboarding = jest.fn(async () => null);
	service.importRecords = jest.fn(async () => undefined);
	service.registrationPolicyService = new RegistrationPolicyService(
		{ exists: jest.fn(async () => tenants > 0) } as never,
		{ count: jest.fn(async () => tenants) } as never
	);
	return service;
}

const creator = () => ({ id: USER_ID, email: 'founder@newco.test' }) as any;

beforeEach(() => {
	previousSwitches = switches.authSwitches;
	switches.authSwitches = { userRegistration: true, tenantsRegistration: true, adminPasswordReset: true };
	jest.spyOn(utils, 'getORMType').mockReturnValue(MultiORMEnum.TypeORM);
	jest.spyOn(console, 'time').mockImplementation(() => undefined);
	jest.spyOn(console, 'timeEnd').mockImplementation(() => undefined);
});

afterEach(() => {
	switches.authSwitches = previousSwitches;
	jest.restoreAllMocks();
});

describe('TenantService.onboardTenant — ALLOW_TENANTS_REGISTRATION', () => {
	it('creates a new tenant with the default switch (today’s behaviour)', async () => {
		const service = buildService({ tenants: 5 });

		const tenant = await service.onboardTenant({ name: 'NewCo' }, creator());

		expect(tenant.id).toBe(NEW_TENANT);
		expect(service.create).toHaveBeenCalledTimes(1);
	});

	it('refuses a new tenant with a 403 once the installation has one', async () => {
		switches.authSwitches = { ...switches.authSwitches, tenantsRegistration: false };
		const service = buildService({ tenants: 1 });

		await expect(service.onboardTenant({ name: 'NewCo' }, creator())).rejects.toThrow(
			new ForbiddenException(TENANT_REGISTRATION_DISABLED_MESSAGE)
		);
		expect(service.create).not.toHaveBeenCalled();
		expect(service.commandBus.execute).not.toHaveBeenCalled();
		expect(service.typeOrmUserRepository.update).not.toHaveBeenCalled();
	});

	it('lets a new installation create its first tenant', async () => {
		switches.authSwitches = { ...switches.authSwitches, tenantsRegistration: false };
		const service = buildService({ tenants: 0 });

		const tenant = await service.onboardTenant({ name: 'First Co' }, creator());

		expect(tenant.id).toBe(NEW_TENANT);
		expect(service.typeOrmUserRepository.update).toHaveBeenCalledWith(USER_ID, {
			tenant: { id: NEW_TENANT },
			role: { id: `role-${NEW_TENANT}` }
		});
	});

	it('lets the creator finish the tenant their own failed attempt left behind', async () => {
		switches.authSwitches = { ...switches.authSwitches, tenantsRegistration: false };
		const service = buildService({ tenants: 1, unfinished: true });

		const tenant = await service.onboardTenant({ name: 'Second try' }, creator());

		expect(service.create).not.toHaveBeenCalled();
		expect(tenant).toEqual(expect.objectContaining({ id: UNFINISHED_TENANT, name: 'Second try' }));
	});

	it('is not closed by APP_USER_REGISTRATION=false alone', async () => {
		switches.authSwitches = { ...switches.authSwitches, userRegistration: false };
		const service = buildService({ tenants: 1 });

		await expect(service.onboardTenant({ name: 'NewCo' }, creator())).resolves.toEqual(
			expect.objectContaining({ id: NEW_TENANT })
		);
	});
});
