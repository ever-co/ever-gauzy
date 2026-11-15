import { BaseEntityEnum, EmployeeNotificationTypeEnum } from '@gauzy/contracts';
import { projectMemberAddedEvents } from './project-notifications';

describe('project notifications', () => {
	describe('projectMemberAddedEvents', () => {
		const project = { id: 'project-1', name: 'Website', organizationId: 'org-1', tenantId: 'tenant-1' };

		it('tells each added employee once, as an assignment about the project, named as a project', () => {
			const events = projectMemberAddedEvents(project, ['employee-1', 'employee-2', 'employee-1'], {
				employeeId: 'employee-admin',
				name: 'Ada Lovelace'
			});

			expect(events.map(({ input }) => input)).toEqual([
				{
					entity: BaseEntityEnum.OrganizationProject,
					entityId: 'project-1',
					type: EmployeeNotificationTypeEnum.ASSIGNMENT,
					title: 'Ada Lovelace Assigned you to the Project "Website"',
					receiverEmployeeId: 'employee-1',
					sentByEmployeeId: 'employee-admin',
					organizationId: 'org-1',
					tenantId: 'tenant-1'
				},
				expect.objectContaining({ receiverEmployeeId: 'employee-2' })
			]);
		});

		it('does not tell the employee who added themselves (an employee who creates a project manages it)', () => {
			const events = projectMemberAddedEvents(project, ['employee-creator', 'employee-1'], {
				employeeId: 'employee-creator',
				name: 'Grace Hopper'
			});

			expect(events.map(({ input }) => input.receiverEmployeeId)).toEqual(['employee-1']);
		});

		it('names no sender when the one who added them has no employee (a super admin)', () => {
			const [event] = projectMemberAddedEvents(project, ['employee-1'], { employeeId: null, name: 'Admin' });

			expect(event.input).not.toHaveProperty('sentByEmployeeId');
			expect(event.input.title).toBe('Admin Assigned you to the Project "Website"');
		});

		it('tells nobody when nobody was added', () => {
			expect(projectMemberAddedEvents(project, [], { employeeId: 'employee-admin', name: 'Ada' })).toEqual([]);
		});
	});

});
