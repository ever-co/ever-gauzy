import { ForbiddenException, Injectable } from '@nestjs/common';
import { environment, isSelfServiceSignupAllowed } from '@gauzy/config';
import { getORMType, MultiORMEnum } from '../../core/utils';
import { TypeOrmTenantRepository } from '../../tenant/repository/type-orm-tenant.repository';
import { MikroOrmTenantRepository } from '../../tenant/repository/mikro-orm-tenant.repository';

/** The 403 of a public sign-up on a server whose operator closed registration. */
export const SELF_REGISTRATION_DISABLED_MESSAGE =
	'Registration is disabled on this server. Ask an administrator of your organization to invite you.';

/** The 403 of an attempt to create a new tenant (workspace) on a server whose operator closed that. */
export const TENANT_REGISTRATION_DISABLED_MESSAGE = 'Creating new workspaces is disabled on this server.';

/**
 * Decides whether the public sign-up and the creation of a new tenant are open, from the operator's switches
 * (`APP_USER_REGISTRATION`, `ALLOW_TENANTS_REGISTRATION`, see `IAuthSwitches` in `@gauzy/config`).
 *
 * With the switches on (the default) everything is open and no query runs: today's behaviour, at today's cost.
 *
 * With a switch off, one exception keeps a new installation usable: while it has no tenant at all, the first
 * account can still sign up and create the first tenant. Once a tenant exists the switch applies.
 *
 * What this never closes, because it is not a sign-up: accepting an invitation (the invite routes create the
 * account inside the inviting tenant), an administrator adding a user to their own tenant, and signing in.
 */
@Injectable()
export class RegistrationPolicyService {
	/**
	 * Set once a tenant has been seen. Tenants are not removed in normal operation, so after the first positive
	 * answer the bootstrap exception is over for the life of the process and the question is not asked again.
	 */
	private tenantSeen = false;

	constructor(
		private readonly typeOrmTenantRepository: TypeOrmTenantRepository,
		private readonly mikroOrmTenantRepository: MikroOrmTenantRepository
	) {}

	/**
	 * Whether a stranger may create an account through a public sign-up now.
	 *
	 * @returns False when `APP_USER_REGISTRATION` or `ALLOW_TENANTS_REGISTRATION` is off and a tenant exists.
	 */
	async isSelfRegistrationOpen(): Promise<boolean> {
		if (isSelfServiceSignupAllowed(environment.authSwitches)) {
			return true;
		}
		return !(await this.hasAnyTenant());
	}

	/**
	 * Refuses a public sign-up the switches close.
	 *
	 * @throws ForbiddenException with {@link SELF_REGISTRATION_DISABLED_MESSAGE}.
	 */
	async assertSelfRegistrationOpen(): Promise<void> {
		if (!(await this.isSelfRegistrationOpen())) {
			throw new ForbiddenException(SELF_REGISTRATION_DISABLED_MESSAGE);
		}
	}

	/**
	 * Whether a new tenant (workspace) may be created now.
	 *
	 * @returns False when `ALLOW_TENANTS_REGISTRATION` is off and a tenant exists.
	 */
	async isTenantRegistrationOpen(): Promise<boolean> {
		if (environment.authSwitches.tenantsRegistration) {
			return true;
		}
		return !(await this.hasAnyTenant());
	}

	/**
	 * Refuses the creation of a new tenant the switch closes.
	 *
	 * @throws ForbiddenException with {@link TENANT_REGISTRATION_DISABLED_MESSAGE}.
	 */
	async assertTenantRegistrationOpen(): Promise<void> {
		if (!(await this.isTenantRegistrationOpen())) {
			throw new ForbiddenException(TENANT_REGISTRATION_DISABLED_MESSAGE);
		}
	}

	/**
	 * Whether the installation has at least one tenant. Soft-deleted tenants count: an installation that has had a
	 * tenant is no longer a new one.
	 */
	async hasAnyTenant(): Promise<boolean> {
		if (this.tenantSeen) {
			return true;
		}

		const found =
			getORMType() === MultiORMEnum.MikroORM
				? (await this.mikroOrmTenantRepository.count({}, { filters: false })) > 0
				: await this.typeOrmTenantRepository.exists({ withDeleted: true });

		this.tenantSeen = found;
		return found;
	}
}
