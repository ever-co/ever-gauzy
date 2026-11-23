import { IEmployee, IInvite, IOrganization, IUser } from '@gauzy/contracts';
import { TypeOrmEmployeeRepository } from '../employee/repository/type-orm-employee.repository';

/**
 * Creates the employee an accepted invitation gives its invitee in the invitation's organization, active from the
 * invitation's action date.
 *
 * @param repository The employee repository the acceptance writes with.
 * @param invite The invitation being accepted.
 * @param organization The invitation's organization.
 * @param user The invitee's account.
 * @returns The created employee.
 */
export async function createInvitedEmployee(
	repository: TypeOrmEmployeeRepository,
	invite: IInvite,
	organization: IOrganization,
	user: IUser
): Promise<IEmployee> {
	const { tenantId, actionDate } = invite;

	const employee = repository.create({
		user,
		organization,
		tenantId,
		startedWorkOn: actionDate || null,
		isActive: true,
		isArchived: false
	});

	return await repository.save(employee);
}
