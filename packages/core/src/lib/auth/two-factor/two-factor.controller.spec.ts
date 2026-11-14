// cspell:ignore efgh ijkl mnop otpauth
import '../../core/entities/internal';

import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { RequestContext } from '../../core/context';
import { TwoFactorController } from './two-factor.controller';

/**
 * The routes of ever-co/ever-gauzy#11916 decide who may act on whose two-factor authentication: a user on their own,
 * only in a first-party session; an administrator who may edit users resets a member's, never their own (that takes a
 * code), and a super admin's only with the right to edit super admins.
 */

const ADMIN = '9f000000-0000-4000-8000-0000000000a1';
const MEMBER = '9f000000-0000-4000-8000-0000000000b1';
const TENANT = '9f000000-0000-4000-8000-00000000000a';

function buildController(memberRole: RolesEnum = RolesEnum.EMPLOYEE) {
	const authService = { signinWithTwoFactorCode: jest.fn(async () => ({ token: 'session' })) };
	const userTwoFactorService = {
		resetByAdministrator: jest.fn(async () => true),
		enroll: jest.fn(async () => ({ secret: 'S', otpauthUrl: 'otpauth://totp/x' }))
	};
	const userService = {
		findOneByIdString: jest.fn(async (id: string) => ({ id, role: { name: memberRole } }))
	};
	const controller = new TwoFactorController(
		authService as never,
		userTwoFactorService as never,
		userService as never
	);
	return { controller, authService, userTwoFactorService, userService };
}

describe('TwoFactorController', () => {
	let permissions: PermissionsEnum[];

	beforeEach(() => {
		permissions = [PermissionsEnum.ORG_USERS_EDIT];
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(ADMIN);
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({
			id: ADMIN,
			tenantId: TENANT,
			email: 'admin@example.com'
		} as never);
		jest.spyOn(RequestContext, 'currentOAuthAppScopes').mockReturnValue(null);
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation((permission) =>
			permissions.includes(permission)
		);
	});

	afterEach(() => jest.restoreAllMocks());

	describe("an administrator's reset", () => {
		it("resets a member's, and says whether there was something to reset", async () => {
			const { controller, userTwoFactorService } = buildController();

			await expect(controller.resetForMember(MEMBER)).resolves.toEqual({ reset: true });
			expect(userTwoFactorService.resetByAdministrator).toHaveBeenCalledWith(MEMBER, ADMIN);
		});

		it('never resets the administrator their own: that takes a code', async () => {
			const { controller, userTwoFactorService } = buildController();

			await expect(controller.resetForMember(ADMIN)).rejects.toBeInstanceOf(ForbiddenException);
			expect(userTwoFactorService.resetByAdministrator).not.toHaveBeenCalled();
		});

		it("resets a super admin's only with the right to edit super admins", async () => {
			const { controller, userTwoFactorService } = buildController(RolesEnum.SUPER_ADMIN);

			await expect(controller.resetForMember(MEMBER)).rejects.toBeInstanceOf(ForbiddenException);
			expect(userTwoFactorService.resetByAdministrator).not.toHaveBeenCalled();

			permissions.push(PermissionsEnum.SUPER_ADMIN_EDIT);
			await expect(controller.resetForMember(MEMBER)).resolves.toEqual({ reset: true });
		});
	});

	it('refuses a sign-in proof with neither a code nor a recovery code, before anything is checked', async () => {
		const { controller, authService } = buildController();

		await expect(controller.verify({ challenge: 'challenge', code: ' ' })).rejects.toBeInstanceOf(
			BadRequestException
		);
		expect(authService.signinWithTwoFactorCode).not.toHaveBeenCalled();

		await expect(
			controller.verify({ challenge: 'challenge', recoveryCode: 'ABCD-EFGH-IJKL-MNOP' })
		).resolves.toEqual({
			token: 'session'
		});
	});

	it('lets no third-party application token set up two-factor authentication for its user', async () => {
		const { controller, userTwoFactorService } = buildController();
		jest.spyOn(RequestContext, 'currentOAuthAppScopes').mockReturnValue(['read']);

		await expect(controller.enroll({})).rejects.toBeInstanceOf(ForbiddenException);
		expect(userTwoFactorService.enroll).not.toHaveBeenCalled();
	});
});
