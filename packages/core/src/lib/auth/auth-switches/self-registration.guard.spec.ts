import { ForbiddenException } from '@nestjs/common';
import { SELF_REGISTRATION_DISABLED_MESSAGE } from './registration-policy.service';
import { SelfRegistrationGuard } from './self-registration.guard';

/**
 * The guard on `POST /auth/register`: a public sign-up asks the registration policy; an administrator creating a
 * user (authenticated by `RegisterAuthorizationGuard`, or carrying an administrator's token while registration is
 * closed) does not need it open. `self-registration.guard.authorization.spec.ts` runs it with the real
 * `RegisterAuthorizationGuard`.
 */

function context(request: { body?: unknown; user?: unknown }) {
	return { switchToHttp: () => ({ getRequest: () => request }) } as never;
}

function buildGuard(open: boolean, administrator = false) {
	const policy = { isSelfRegistrationOpen: jest.fn(async () => open) };
	const registerAuthorization = { isAdministratorRequest: jest.fn(async () => administrator) };
	return {
		guard: new SelfRegistrationGuard(policy as never, registerAuthorization as never),
		policy,
		registerAuthorization
	};
}

const signup = { body: { user: { email: 'new@corp.test' } } };

describe('SelfRegistrationGuard', () => {
	it('lets a public sign-up through while registration is open, without reading any token', async () => {
		const { guard, policy, registerAuthorization } = buildGuard(true);

		await expect(guard.canActivate(context(signup))).resolves.toBe(true);
		expect(policy.isSelfRegistrationOpen).toHaveBeenCalledTimes(1);
		expect(registerAuthorization.isAdministratorRequest).not.toHaveBeenCalled();
	});

	it('refuses a public sign-up with a 403 while registration is closed', async () => {
		const { guard } = buildGuard(false);

		await expect(guard.canActivate(context(signup))).rejects.toThrow(
			new ForbiddenException(SELF_REGISTRATION_DISABLED_MESSAGE)
		);
	});

	it('lets an administrator authenticated by RegisterAuthorizationGuard through while registration is closed', async () => {
		const { guard, policy } = buildGuard(false);
		const admin = { id: 'admin-id', tenantId: 'tenant-id' };

		await expect(guard.canActivate(context({ ...signup, user: admin }))).resolves.toBe(true);
		expect(policy.isSelfRegistrationOpen).not.toHaveBeenCalled();
	});

	it('lets an administrator’s token through while registration is closed, attaching nothing', async () => {
		const { guard, registerAuthorization } = buildGuard(false, true);
		const request: { body: unknown; user?: unknown } = { ...signup };

		await expect(guard.canActivate(context(request))).resolves.toBe(true);
		expect(registerAuthorization.isAdministratorRequest).toHaveBeenCalledWith(request);
		expect(request.user).toBeUndefined();
	});
});
