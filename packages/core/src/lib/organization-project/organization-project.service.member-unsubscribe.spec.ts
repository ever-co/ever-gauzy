import '../core/entities/internal';

import { BaseEntityEnum, EntitySubscriptionTypeEnum } from '@gauzy/contracts';
import { OrganizationProjectService } from './organization-project.service';

/**
 * Removing a member from a project must also remove their ASSIGNMENT subscription. The unsubscribe read
 * `member.employee.id`, a relation the member rows are loaded without: it threw, the error was swallowed,
 * and the removed member kept receiving the project's notifications.
 */
describe('OrganizationProjectService.updateOrganizationProjectMembers', () => {
	it("unsubscribes a removed member from the project, by the member row's employeeId", async () => {
		const entitySubscriptionService = { deleteForEmployee: jest.fn(), delete: jest.fn() };
		const self = {
			_roleService: { findOneByWhereOptions: jest.fn().mockResolvedValue({ id: 'role-manager' }) },
			// Loaded without relations, as the service does: `employee` is not populated
			typeOrmOrganizationProjectEmployeeRepository: {
				find: jest.fn().mockResolvedValue([
					{ id: 'row-a', employeeId: 'employee-a', roleId: null },
					{ id: 'row-b', employeeId: 'employee-b', roleId: null }
				]),
				update: jest.fn(),
				save: jest.fn()
			},
			deleteMemberByIds: jest.fn(),
			_entitySubscriptionService: entitySubscriptionService,
			_eventBus: { publish: jest.fn() }
		};

		await OrganizationProjectService.prototype.updateOrganizationProjectMembers.call(
			self,
			'project-1',
			'org-1',
			'tenant-1',
			[],
			[],
			['employee-a']
		);

		expect(self.deleteMemberByIds).toHaveBeenCalledTimes(1);
		expect(self.deleteMemberByIds).toHaveBeenCalledWith(['row-b']);
		expect(entitySubscriptionService.deleteForEmployee).toHaveBeenCalledTimes(1);
		expect(entitySubscriptionService.deleteForEmployee).toHaveBeenCalledWith({
			entity: BaseEntityEnum.OrganizationProject,
			entityId: 'project-1',
			employeeId: 'employee-b',
			type: EntitySubscriptionTypeEnum.ASSIGNMENT,
			organizationId: 'org-1',
			tenantId: 'tenant-1'
		});
		expect(entitySubscriptionService.delete).not.toHaveBeenCalled();
	});
});
