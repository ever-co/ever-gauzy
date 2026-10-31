import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { RegisterAuthorizationGuard } from '../../shared/guards/register-authorization.guard';
import { RegistrationPolicyService, SELF_REGISTRATION_DISABLED_MESSAGE } from './registration-policy.service';

/**
 * Closes the public sign-up on `POST /auth/register` when the operator turned registration off
 * (`APP_USER_REGISTRATION=false` or `ALLOW_TENANTS_REGISTRATION=false`), with a 403 that says so.
 *
 * An administrator still creates users through this route while registration is closed:
 * - a body with privileged fields (role, organization, tenant) was already authenticated by
 *   `RegisterAuthorizationGuard`, which runs first and sets `request.user`;
 * - a body without them carries the administrator's token unverified (that guard authenticates privileged bodies
 *   only), so here, and only while registration is closed, the token is verified exactly as that guard verifies a
 *   privileged registration: an active Admin or Super Admin according to the database. A missing, invalid or
 *   expired token, or any other account, is a public sign-up and is refused. Nothing is attached to the request, so
 *   the registration then runs exactly as it would with registration open.
 *
 * With registration open (the default) this guard lets every request through without reading the token, as before.
 * Invitations do not use this route at all. Runs before `SubscriptionRequiredGuard`, so a closed server never asks
 * Stripe about the address.
 */
@Injectable()
export class SelfRegistrationGuard implements CanActivate {
	constructor(
		private readonly registrationPolicyService: RegistrationPolicyService,
		private readonly registerAuthorizationGuard: RegisterAuthorizationGuard
	) {}

	/**
	 * @param context The execution context.
	 * @returns True when the request may go on.
	 * @throws ForbiddenException when it is a public sign-up and registration is closed.
	 */
	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest();

		if (request?.user) {
			return true;
		}

		if (await this.registrationPolicyService.isSelfRegistrationOpen()) {
			return true;
		}

		if (await this.registerAuthorizationGuard.isAdministratorRequest(request)) {
			return true;
		}

		throw new ForbiddenException(SELF_REGISTRATION_DISABLED_MESSAGE);
	}
}
