import { environment } from '@gauzy/config';
import { IUser, RolesEnum } from '@gauzy/contracts';

/** The roles whose password `ADMIN_PASSWORD_RESET=false` keeps from being reset through the e-mailed link. */
export const EMAIL_PASSWORD_RESET_PROTECTED_ROLES: ReadonlySet<string> = new Set<string>([
	RolesEnum.SUPER_ADMIN,
	RolesEnum.ADMIN
]);

/**
 * Whether an account may reset its password through the e-mailed link.
 *
 * Always, unless the operator set `ADMIN_PASSWORD_RESET=false`; then not for an account whose role in its tenant is
 * Admin or Super Admin. Signing in is not affected: only the e-mailed link stops working for those accounts.
 *
 * @param user The account, with its role loaded.
 * @param adminPasswordReset The switch; read from the environment when omitted.
 * @returns False only for an Admin or Super Admin while the switch is off.
 */
export function canResetPasswordByEmail(
	user: Pick<IUser, 'role'> | null | undefined,
	adminPasswordReset: boolean = environment.authSwitches.adminPasswordReset
): boolean {
	if (adminPasswordReset) {
		return true;
	}
	return !EMAIL_PASSWORD_RESET_PROTECTED_ROLES.has(user?.role?.name);
}
