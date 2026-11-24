import { ConflictException } from '@nestjs/common';
import { IEmployee, IInvite, IOrganization, IUser } from '@gauzy/contracts';
import { TypeOrmEmployeeRepository } from '../employee/repository/type-orm-employee.repository';

/** What an acceptance answers when the invitee's employee in the organization has ended. */
export const ENDED_EMPLOYEE_MESSAGE =
	"This person's employee record in the organization has ended. An administrator restores it, then the invitation can be accepted.";

/**
 * The invitee's employee in the invitation's organization is deactivated or archived: joining teams with it would
 * consume the invitation and still leave the person unable to sign in there. Refused before anything is written, so
 * the invitation stays open for when an administrator restores the employee.
 */
export class EndedEmployeeException extends ConflictException {
	constructor() {
		super(ENDED_EMPLOYEE_MESSAGE);
	}
}

/**
 * Refuses an employee whose work in the organization ended (deactivated or archived). No employee yet passes: the
 * acceptance creates one.
 *
 * @param employee The invitee's employee in the invitation's organization, if any.
 */
export function assertEmployeeNotEnded(employee: IEmployee | null | undefined): void {
	if (employee && (employee.isActive === false || employee.isArchived === true)) {
		throw new EndedEmployeeException();
	}
}

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
