import { ForbiddenException } from '@nestjs/common';
import { SELF_REGISTRATION_DISABLED_MESSAGE } from './registration-policy.service';
import { SelfRegistrationGuard } from './self-registration.guard';

/**
 * The guard on `POST /auth/register`: a public sign-up asks the registration policy; an administrator creating a
 * user in their own tenant (authenticated by `RegisterAuthorizationGuard`, which sets `request.user`) does not.
 */

function context(request: { body?: unknown; user?: unknown }) {
	return { switchToHttp: () => ({ getRequest: () => request }) } as never;
}

function buildGuard(open: boolean) {
	const policy = {
		assertSelfRegistrationOpen: jest.fn(async () => {
			if (!open) throw new ForbiddenException(SELF_REGISTRATION_DISABLED_MESSAGE);
		})
	};
	return { guard: new SelfRegistrationGuard(policy as never), policy };
}

describe('SelfRegistrationGuard', () => {
	it('lets a public sign-up through while registration is open', async () => {
		const { guard, policy } = buildGuard(true);

		await expect(guard.canActivate(context({ body: { user: { email: 'new@corp.test' } } }))).resolves.toBe(true);
		expect(policy.assertSelfRegistrationOpen).toHaveBeenCalledTimes(1);
	});

	it('refuses a public sign-up with a 403 while registration is closed', async () => {
		const { guard } = buildGuard(false);

		await expect(guard.canActivate(context({ body: { user: { email: 'new@corp.test' } } }))).rejects.toThrow(
			new ForbiddenException(SELF_REGISTRATION_DISABLED_MESSAGE)
		);
	});

	it('lets an administrator create a user in their tenant while registration is closed', async () => {
		const { guard, policy } = buildGuard(false);
		const admin = { id: 'admin-id', tenantId: 'tenant-id' };

		await expect(
			guard.canActivate(context({ body: { user: { email: 'new@corp.test' } }, user: admin }))
		).resolves.toBe(true);
		expect(policy.assertSelfRegistrationOpen).not.toHaveBeenCalled();
	});
});
