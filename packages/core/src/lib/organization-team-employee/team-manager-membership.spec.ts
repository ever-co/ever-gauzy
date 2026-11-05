import { IRole, RolesEnum } from '@gauzy/contracts';
import { mayFlagTeamManagers, teamRoleAfterEdit } from './team-manager-membership';

describe('teamRoleAfterEdit (#6569)', () => {
	const managerRole = { id: 'role-manager', name: RolesEnum.MANAGER } as IRole;
	const reviewer = { id: 'role-reviewer', name: 'Reviewer' } as IRole;

	it('gives the manager role to a member the edit names as a manager, whatever they held', () => {
		expect(teamRoleAfterEdit({ roleId: null, role: null }, true, managerRole)).toBe(managerRole);
		expect(teamRoleAfterEdit({ roleId: reviewer.id, role: reviewer }, true, managerRole)).toBe(managerRole);
	});

	it('keeps a custom role of a member the edit does not name as a manager', () => {
		expect(teamRoleAfterEdit({ roleId: reviewer.id, role: reviewer }, false, managerRole)).toBe(reviewer);
	});

	it('keeps a non-manager system role, such as EMPLOYEE', () => {
		const employee = { id: 'role-employee', name: RolesEnum.EMPLOYEE } as IRole;
		expect(teamRoleAfterEdit({ roleId: employee.id, role: employee }, false, managerRole)).toBe(employee);
	});

	it('leaves a plain member without a role', () => {
		expect(teamRoleAfterEdit({ roleId: null, role: null }, false, managerRole)).toBeNull();
		expect(teamRoleAfterEdit({}, false, managerRole)).toBeNull();
	});

	it('takes the manager role off a manager the edit no longer names', () => {
		expect(teamRoleAfterEdit({ roleId: managerRole.id, role: managerRole }, false, managerRole)).toBeNull();
	});

	it('recognises the manager role by id even when the loaded role carries no name', () => {
		expect(
			teamRoleAfterEdit({ roleId: managerRole.id, role: { id: managerRole.id } as IRole }, false, managerRole)
		).toBeNull();
		expect(teamRoleAfterEdit({ roleId: managerRole.id, role: {} as IRole }, false, managerRole)).toBeNull();
	});

	it.each([RolesEnum.MANAGER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN])(
		'takes a %s role off a member left out of the managers, as it makes them one of the team managers',
		(name) => {
			const role = { id: `role-${name}`, name } as IRole;
			expect(teamRoleAfterEdit({ roleId: role.id, role }, false, managerRole)).toBeNull();
		}
	);

	it('clears a role it cannot read (role id without the loaded role), as before', () => {
		expect(teamRoleAfterEdit({ roleId: reviewer.id, role: null }, false, managerRole)).toBeNull();
	});
});

describe('mayFlagTeamManagers', () => {
	const flagged = { employeeId: 'caller', isManager: true, isActive: true, isArchived: false };

	it('lets a caller who may act for every employee flag managers on any team', () => {
		expect(mayFlagTeamManagers([], null, true)).toBe(true);
	});

	it('lets a manager flagged on this team flag its co-managers', () => {
		expect(mayFlagTeamManagers([flagged], 'caller', false)).toBe(true);
	});

	it('refuses a caller who holds the manager role on this team without the flag', () => {
		expect(mayFlagTeamManagers([{ ...flagged, isManager: false }], 'caller', false)).toBe(false);
		expect(mayFlagTeamManagers([{ ...flagged, isManager: null }], 'caller', false)).toBe(false);
	});

	it('refuses a caller whose flagged membership of this team is inactive or archived', () => {
		expect(mayFlagTeamManagers([{ ...flagged, isActive: false }], 'caller', false)).toBe(false);
		expect(mayFlagTeamManagers([{ ...flagged, isArchived: true }], 'caller', false)).toBe(false);
	});

	it('refuses a caller who is not on the team, or has no employee', () => {
		expect(mayFlagTeamManagers([{ ...flagged, employeeId: 'someone-else' }], 'caller', false)).toBe(false);
		expect(mayFlagTeamManagers([flagged], null, false)).toBe(false);
	});
});
