import { canInviteWithRole } from './role-invite-ceiling';
import { RolesEnum } from './role.model';

describe('canInviteWithRole', () => {
	const { SUPER_ADMIN, ADMIN, MANAGER, DATA_ENTRY, EMPLOYEE, VIEWER, CANDIDATE, INTERVIEWER } = RolesEnum;

	/** The owner's order (2026-10-22), highest first; roles on one line share a level. */
	const LEVELS: RolesEnum[][] = [
		[SUPER_ADMIN],
		[ADMIN],
		[MANAGER],
		[DATA_ENTRY, EMPLOYEE],
		[VIEWER, CANDIDATE, INTERVIEWER]
	];
	const levelOf = (role: RolesEnum) => LEVELS.length - LEVELS.findIndex((level) => level.includes(role));

	it('ranks every built-in role', () => {
		expect(LEVELS.flat().sort()).toEqual(Object.values(RolesEnum).sort());
	});

	it('lets an inviter grant only their own level or lower', () => {
		for (const inviter of Object.values(RolesEnum)) {
			for (const invited of Object.values(RolesEnum)) {
				expect({ inviter, invited, allowed: canInviteWithRole(inviter, invited) }).toEqual({
					inviter,
					invited,
					allowed: levelOf(invited) <= levelOf(inviter)
				});
			}
		}
	});

	it('lets only an ADMIN or SUPER_ADMIN invite an ADMIN, and only a SUPER_ADMIN invite a SUPER_ADMIN', () => {
		const admins = Object.values(RolesEnum).filter((role) => canInviteWithRole(role, ADMIN));
		const superAdmins = Object.values(RolesEnum).filter((role) => canInviteWithRole(role, SUPER_ADMIN));

		expect(admins.sort()).toEqual([ADMIN, SUPER_ADMIN].sort());
		expect(superAdmins).toEqual([SUPER_ADMIN]);
	});

	it('keeps a role the tenant created for tenant admins, and ranks an inviter holding one lowest', () => {
		expect(canInviteWithRole(SUPER_ADMIN, 'RECRUITER')).toBe(true);
		expect(canInviteWithRole(ADMIN, 'RECRUITER')).toBe(true);
		expect(canInviteWithRole(MANAGER, 'RECRUITER')).toBe(false);
		expect(canInviteWithRole('RECRUITER', 'RECRUITER')).toBe(false);

		expect(canInviteWithRole('RECRUITER', VIEWER)).toBe(true);
		expect(canInviteWithRole('RECRUITER', EMPLOYEE)).toBe(false);
	});

	it('refuses a missing role on either side', () => {
		for (const missing of [undefined, null, '']) {
			expect(canInviteWithRole(missing, VIEWER)).toBe(false);
			expect(canInviteWithRole(SUPER_ADMIN, missing)).toBe(false);
		}
	});

	it('does not read inherited object keys as roles', () => {
		expect(canInviteWithRole('constructor', VIEWER)).toBe(true);
		expect(canInviteWithRole(MANAGER, 'toString')).toBe(false);
	});
});
