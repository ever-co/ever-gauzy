import { environment, IAuthSwitches } from '@gauzy/config';
import { RolesEnum } from '@gauzy/contracts';
import { canResetPasswordByEmail } from './admin-password-reset';

/**
 * #7821: `ADMIN_PASSWORD_RESET=false` stops the e-mailed password reset for Admin and Super Admin accounts. On by
 * default, so every account keeps it unless the operator says otherwise.
 */
const account = (role?: RolesEnum | string) => ({ role: role ? ({ name: role } as never) : undefined });

describe('canResetPasswordByEmail', () => {
	it.each([RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN, RolesEnum.EMPLOYEE, RolesEnum.VIEWER, undefined])(
		'lets %p reset by e-mail while the switch is on',
		(role) => {
			expect(canResetPasswordByEmail(account(role), true)).toBe(true);
		}
	);

	it.each([RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN])('refuses %p while the switch is off', (role) => {
		expect(canResetPasswordByEmail(account(role), false)).toBe(false);
	});

	it.each([RolesEnum.EMPLOYEE, RolesEnum.MANAGER, RolesEnum.CANDIDATE, RolesEnum.VIEWER, 'Custom role', undefined])(
		'lets %p reset by e-mail while the switch is off',
		(role) => {
			expect(canResetPasswordByEmail(account(role), false)).toBe(true);
		}
	);

	it('lets an account without a loaded role through (it holds no admin role to protect)', () => {
		expect(canResetPasswordByEmail(null, false)).toBe(true);
		expect(canResetPasswordByEmail(undefined, false)).toBe(true);
	});

	it('reads the switch from the environment by default', () => {
		const target = environment as unknown as { authSwitches: IAuthSwitches };
		const previous = target.authSwitches;
		try {
			target.authSwitches = { ...previous, adminPasswordReset: false };
			expect(canResetPasswordByEmail(account(RolesEnum.ADMIN))).toBe(false);

			target.authSwitches = { ...previous, adminPasswordReset: true };
			expect(canResetPasswordByEmail(account(RolesEnum.ADMIN))).toBe(true);
		} finally {
			target.authSwitches = previous;
		}
	});
});
