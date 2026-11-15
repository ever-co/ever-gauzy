import {
	BaseEntityEnum,
	EmployeeNotificationTypeEnum,
	ID,
	NotificationActionTypeEnum
} from '@gauzy/contracts';
import { EmployeeCreateNotificationEvent } from '../employee-notification/events/employee-notification.event';
import { generateNotificationTitle } from '../employee-notification/employee-notification.helper';

/**
 * What the members of a project hear of (ever-co/ever-teams#5022): being added to it. Pure, so the project service and
 * its specs read it alike.
 */

/**
 * The notifications that tell employees they were added to a project: an `Assignment` about the project, as a task's
 * new assignees are told (`Ana Assigned you to the Project "Website"`). The employee who added them is not told about
 * themselves, and an employee is told once however many times the list names them.
 *
 * @param project The project.
 * @param employeeIds The employees just added.
 * @param actor The employee who added them, and the name the title gives them.
 */
export function projectMemberAddedEvents(
	project: { id: ID; name?: string | null; organizationId: ID; tenantId: ID },
	employeeIds: ReadonlyArray<ID>,
	actor: { employeeId?: ID | null; name: string }
): EmployeeCreateNotificationEvent[] {
	const receivers = [...new Set(employeeIds.filter(Boolean).map(String))].filter(
		(employeeId) => !actor.employeeId || employeeId !== String(actor.employeeId)
	);
	const title = generateNotificationTitle(
		NotificationActionTypeEnum.Assigned,
		BaseEntityEnum.OrganizationProject,
		project.name ?? '',
		actor.name
	);
	return receivers.map(
		(receiverEmployeeId) =>
			new EmployeeCreateNotificationEvent({
				entity: BaseEntityEnum.OrganizationProject,
				entityId: project.id,
				type: EmployeeNotificationTypeEnum.ASSIGNMENT,
				title,
				receiverEmployeeId,
				...(actor.employeeId ? { sentByEmployeeId: actor.employeeId } : {}),
				organizationId: project.organizationId,
				tenantId: project.tenantId
			})
	);
}
