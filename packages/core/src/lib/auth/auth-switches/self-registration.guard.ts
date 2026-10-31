import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { RegistrationPolicyService } from './registration-policy.service';

/**
 * Closes the public sign-up on `POST /auth/register` when the operator turned registration off
 * (`APP_USER_REGISTRATION=false` or `ALLOW_TENANTS_REGISTRATION=false`), with a 403 that says so.
 *
 * Runs after `RegisterAuthorizationGuard`, which sets `request.user` for an authenticated Admin or Super Admin
 * creating a user in their own tenant: that is not a sign-up, and it goes through. Invitations do not use this
 * route at all. Runs before `SubscriptionRequiredGuard`, so a closed server never asks Stripe about the address.
 */
@Injectable()
export class SelfRegistrationGuard implements CanActivate {
	constructor(private readonly registrationPolicyService: RegistrationPolicyService) {}

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

		await this.registrationPolicyService.assertSelfRegistrationOpen();
		return true;
	}
}
