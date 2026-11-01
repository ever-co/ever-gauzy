import { IRole, RolesEnum } from '@gauzy/contracts';
import { teamRoleAfterEdit } from './team-manager-membership';

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
