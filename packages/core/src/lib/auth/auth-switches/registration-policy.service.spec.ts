import { ForbiddenException } from '@nestjs/common';
import { environment, IAuthSwitches } from '@gauzy/config';
import * as utils from '../../core/utils';
import { MultiORMEnum } from '../../core/utils';
import {
	RegistrationPolicyService,
	SELF_REGISTRATION_DISABLED_MESSAGE,
	TENANT_REGISTRATION_DISABLED_MESSAGE
} from './registration-policy.service';

/**
 * #5784 / #7821: the operator can close the public sign-up (`APP_USER_REGISTRATION=false`) and the creation of new
 * tenants (`ALLOW_TENANTS_REGISTRATION=false`). With the default switches nothing changes and no query runs; with a
 * switch off, an installation without any tenant can still create its first one.
 */

const OPEN: IAuthSwitches = { userRegistration: true, tenantsRegistration: true, adminPasswordReset: true };

const switches = environment as unknown as { authSwitches: IAuthSwitches };
let previousSwitches: IAuthSwitches;

function setSwitches(overrides: Partial<IAuthSwitches>) {
	switches.authSwitches = { ...OPEN, ...overrides };
}

/** A policy over a tenant table that holds `tenants` rows (TypeORM unless stated). */
function buildPolicy({ tenants = 1, orm = MultiORMEnum.TypeORM as utils.MultiORM } = {}) {
	jest.spyOn(utils, 'getORMType').mockReturnValue(orm);
	const typeOrm = { exists: jest.fn(async () => tenants > 0) };
	const mikroOrm = { count: jest.fn(async () => tenants) };
	const policy = new RegistrationPolicyService(typeOrm as never, mikroOrm as never);
	return { policy, typeOrm, mikroOrm };
}

beforeEach(() => {
	previousSwitches = switches.authSwitches;
	switches.authSwitches = { ...OPEN };
});

afterEach(() => {
	switches.authSwitches = previousSwitches;
	jest.restoreAllMocks();
});

describe('RegistrationPolicyService — with the default switches', () => {
	it('keeps the public sign-up and tenant creation open without querying anything', async () => {
		const { policy, typeOrm, mikroOrm } = buildPolicy();

		await expect(policy.isSelfRegistrationOpen()).resolves.toBe(true);
		await expect(policy.isTenantRegistrationOpen()).resolves.toBe(true);
		await expect(policy.assertSelfRegistrationOpen()).resolves.toBeUndefined();
		await expect(policy.assertTenantRegistrationOpen()).resolves.toBeUndefined();
		expect(typeOrm.exists).not.toHaveBeenCalled();
		expect(mikroOrm.count).not.toHaveBeenCalled();
	});
});

describe('RegistrationPolicyService — APP_USER_REGISTRATION=false', () => {
	beforeEach(() => setSwitches({ userRegistration: false }));

	it('closes the public sign-up with a 403 that says why', async () => {
		const { policy } = buildPolicy({ tenants: 3 });

		await expect(policy.isSelfRegistrationOpen()).resolves.toBe(false);
		await expect(policy.assertSelfRegistrationOpen()).rejects.toThrow(
			new ForbiddenException(SELF_REGISTRATION_DISABLED_MESSAGE)
		);
	});

	it('leaves tenant creation to its own switch', async () => {
		const { policy } = buildPolicy({ tenants: 3 });

		await expect(policy.isTenantRegistrationOpen()).resolves.toBe(true);
	});

	it('still lets a new installation without any tenant sign up its first account', async () => {
		const { policy, typeOrm } = buildPolicy({ tenants: 0 });

		await expect(policy.isSelfRegistrationOpen()).resolves.toBe(true);
		expect(typeOrm.exists).toHaveBeenCalledWith({ withDeleted: true });
	});
});

describe('RegistrationPolicyService — ALLOW_TENANTS_REGISTRATION=false', () => {
	beforeEach(() => setSwitches({ tenantsRegistration: false }));

	it('closes tenant creation with a 403 once a tenant exists', async () => {
		const { policy } = buildPolicy({ tenants: 1 });

		await expect(policy.isTenantRegistrationOpen()).resolves.toBe(false);
		await expect(policy.assertTenantRegistrationOpen()).rejects.toThrow(
			new ForbiddenException(TENANT_REGISTRATION_DISABLED_MESSAGE)
		);
	});

	it('closes the public sign-up too: such an account can only go on to create a tenant', async () => {
		const { policy } = buildPolicy({ tenants: 1 });

		await expect(policy.isSelfRegistrationOpen()).resolves.toBe(false);
	});

	it('lets a new installation create its first tenant', async () => {
		const { policy } = buildPolicy({ tenants: 0 });

		await expect(policy.isTenantRegistrationOpen()).resolves.toBe(true);
		await expect(policy.isSelfRegistrationOpen()).resolves.toBe(true);
	});

	it('asks MikroORM for the count, soft-deleted tenants included', async () => {
		const { policy, mikroOrm, typeOrm } = buildPolicy({ tenants: 2, orm: MultiORMEnum.MikroORM });

		await expect(policy.isTenantRegistrationOpen()).resolves.toBe(false);
		expect(mikroOrm.count).toHaveBeenCalledWith({}, { filters: false });
		expect(typeOrm.exists).not.toHaveBeenCalled();
	});
});

describe('RegistrationPolicyService.hasAnyTenant', () => {
	it('asks again while the installation has no tenant', async () => {
		const { policy, typeOrm } = buildPolicy({ tenants: 0 });

		await policy.hasAnyTenant();
		await policy.hasAnyTenant();

		expect(typeOrm.exists).toHaveBeenCalledTimes(2);
	});

	it('remembers a tenant once it has seen one', async () => {
		const { policy, typeOrm } = buildPolicy({ tenants: 1 });

		await expect(policy.hasAnyTenant()).resolves.toBe(true);
		await expect(policy.hasAnyTenant()).resolves.toBe(true);

		expect(typeOrm.exists).toHaveBeenCalledTimes(1);
	});
});

describe('RegistrationPolicyService.isFirstTenantExceptionOpen', () => {
	it('is closed with the default switch, without querying anything', async () => {
		const { policy, typeOrm } = buildPolicy({ tenants: 0 });

		await expect(policy.isFirstTenantExceptionOpen()).resolves.toBe(false);
		expect(typeOrm.exists).not.toHaveBeenCalled();
	});

	it('is open while ALLOW_TENANTS_REGISTRATION=false and the installation has no tenant', async () => {
		setSwitches({ tenantsRegistration: false });
		const { policy } = buildPolicy({ tenants: 0 });

		await expect(policy.isFirstTenantExceptionOpen()).resolves.toBe(true);
	});

	it('is over once the installation has a tenant', async () => {
		setSwitches({ tenantsRegistration: false });
		const { policy } = buildPolicy({ tenants: 1 });

		await expect(policy.isFirstTenantExceptionOpen()).resolves.toBe(false);
	});
});
