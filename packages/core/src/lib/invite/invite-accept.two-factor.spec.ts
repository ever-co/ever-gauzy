import '../core/entities/internal';

import { HttpStatus } from '@nestjs/common';
import { RolesEnum, TWO_FACTOR_REQUIRED_CODE } from '@gauzy/contracts';
import { TwoFactorRequiredException, verifyTwoFactorChallenge } from '../auth/two-factor/two-factor-challenge';
import { InviteAcceptHandler } from './commands/handlers/invite-accept.handler';
import { InviteAcceptCommand } from './commands/invite-accept.command';

/**
 * ever-co/ever-gauzy#11916: accepting an invitation ends with a session, and an invitation can name an existing
 * account of the tenant. For an account with two-factor authentication on, the invitation alone is not enough: the
 * acceptance answers the challenge every other sign-in answers, before any token is minted.
 */

const TENANT_ID = '9a100000-0000-4000-8000-00000000000a';
const ORGANIZATION_ID = '9a100000-0000-4000-8000-0000000000a1';
const EMAIL = 'member@example.com';

function buildHandler(asksForCode: boolean) {
	const invite = {
		id: 'invite-1',
		email: EMAIL,
		tenantId: TENANT_ID,
		tenant: { id: TENANT_ID },
		role: { id: 'employee-role', name: RolesEnum.EMPLOYEE }
	};
	const inviteService = {
		validateByToken: jest.fn().mockResolvedValue(invite),
		validateByCode: jest.fn().mockResolvedValue(invite),
		findOneByIdString: jest.fn().mockResolvedValue(invite)
	};
	const existingUser = { id: 'existing-user', email: EMAIL, tenantId: TENANT_ID, isActive: true };
	const commandBus = { execute: jest.fn().mockResolvedValue(existingUser) };
	const typeOrmUserRepository = { findOneOrFail: jest.fn().mockResolvedValue(existingUser) };
	const authService = {
		getJwtAccessToken: jest.fn().mockResolvedValue('access'),
		getJwtRefreshToken: jest.fn().mockResolvedValue('refresh'),
		asksForTwoFactorCode: jest.fn().mockResolvedValue(asksForCode)
	};
	const userService = { setCurrentRefreshToken: jest.fn().mockResolvedValue(undefined) };
	const employeeService = {
		findOneByUserId: jest
			.fn()
			.mockResolvedValue({ organizationId: ORGANIZATION_ID, isActive: true, isArchived: false })
	};
	const handler = new InviteAcceptHandler(
		typeOrmUserRepository as never,
		commandBus as never,
		inviteService as never,
		authService as never,
		userService as never,
		employeeService as never
	);
	return { handler, authService, userService };
}

const accept = (handler: InviteAcceptHandler) =>
	handler.execute(
		new InviteAcceptCommand({ email: EMAIL, code: 123456, user: { firstName: 'Amina' } } as never, 'en' as never)
	);

describe('InviteAcceptHandler with two-factor authentication', () => {
	it('answers the challenge for an account that has it on, and mints no token', async () => {
		const { handler, authService, userService } = buildHandler(true);

		const error = await accept(handler).then(
			() => null,
			(reason: unknown) => reason
		);

		expect(error).toBeInstanceOf(TwoFactorRequiredException);
		const exception = error as TwoFactorRequiredException;
		expect(exception.getStatus()).toBe(HttpStatus.FORBIDDEN);
		const body = exception.getResponse() as { code: string; challenge: string };
		expect(body.code).toBe(TWO_FACTOR_REQUIRED_CODE);
		expect(verifyTwoFactorChallenge(body.challenge)).toEqual({
			userId: 'existing-user',
			email: EMAIL,
			tenantId: TENANT_ID,
			lastOrganizationId: ORGANIZATION_ID
		});
		expect(authService.getJwtAccessToken).not.toHaveBeenCalled();
		expect(userService.setCurrentRefreshToken).not.toHaveBeenCalled();
	});

	it('signs an account without it in as before', async () => {
		const { handler } = buildHandler(false);

		await expect(accept(handler)).resolves.toEqual(
			expect.objectContaining({ token: 'access', refresh_token: 'refresh' })
		);
	});
});
