import { EntityManager } from 'typeorm';
import { OrganizationProject } from '../../core/entities/internal';
import { ITrackedContext, ITrackedEmployee, projectIdOfTask } from './organization-tracking-requirements';

/**
 * Whether time is billable by its project's setting, for a client that asks for it with `billableFromProject`
 * (ever-co/ever-teams#5571). The project is the one the time names, else its task's; a project with no setting
 * counts as not billable, as in the Ever Teams web app. Undefined for time without a project, or with a project the
 * employee's organization does not hold: the request's own `isBillable` then decides, as before.
 *
 * @param manager Reads the task and the project.
 * @param employee The employee the time is for; the task and the project are read in their organization.
 * @param context The time's project and task.
 */
export async function billableOfProject(
	manager: EntityManager,
	employee: ITrackedEmployee,
	context: Pick<ITrackedContext, 'projectId' | 'taskId'>
): Promise<boolean | undefined> {
	const projectId = context.projectId || (await projectIdOfTask(manager, employee, context.taskId));
	if (!projectId) {
		return undefined;
	}
	const { organizationId, tenantId } = employee;
	const project = await manager.findOne(OrganizationProject, {
		where: { id: projectId, tenantId, organizationId },
		select: { id: true, billable: true }
	});
	if (!project) {
		return undefined;
	}
	return project.billable === true;
}
