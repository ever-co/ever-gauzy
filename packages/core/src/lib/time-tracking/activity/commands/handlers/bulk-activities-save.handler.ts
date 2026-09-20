import { ForbiddenException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IActivity, PermissionsEnum } from '@gauzy/contracts';
import { isEmpty, isNotEmpty } from '@gauzy/utils';
import { Activity } from '../../activity.entity';
import { scopeActivitiesForWrite } from '../../activity-write-scope.helper';
import { BulkActivitiesSaveCommand } from '../bulk-activities-save.command';
import { RequestContext } from '../../../../core/context';
import { TypeOrmActivityRepository } from '../../repository/type-orm-activity.repository';
import { TypeOrmEmployeeRepository } from '../../../../employee/repository/type-orm-employee.repository';

@CommandHandler(BulkActivitiesSaveCommand)
export class BulkActivitiesSaveHandler implements ICommandHandler<BulkActivitiesSaveCommand> {
	constructor(
		private readonly typeOrmActivityRepository: TypeOrmActivityRepository,
		private readonly typeOrmEmployeeRepository: TypeOrmEmployeeRepository
	) {}

	/**
	 * Executes the bulk save operation for activities.
	 *
	 * @param command - The command containing the input data for saving multiple activities.
	 * @returns A promise that resolves with the saved activities.
	 * @throws BadRequestException if there is an error during the save process.
	 */
	public async execute(command: BulkActivitiesSaveCommand): Promise<IActivity[]> {
		const { input } = command;
		let { employeeId, organizationId, activities = [], projectId } = input;

		const user = RequestContext.currentUser();

		// Activities are written into the caller's tenant only; a body tenantId is never a fallback.
		const tenantId = RequestContext.currentTenantId();
		if (!tenantId) {
			throw new ForbiddenException('A tenant is required to save activities');
		}

		// Check if the logged user has permission to change the selected employee
		const hasChangeEmployeePermission = RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE);

		// Assign current employeeId if the user doesn't have permission or if employeeId is not provided
		if (!hasChangeEmployeePermission || (isEmpty(employeeId) && RequestContext.currentEmployeeId())) {
			employeeId = RequestContext.currentEmployeeId();
		}

		// The employee must belong to the caller's tenant: CHANGE_SELECTED_EMPLOYEE holders may name any
		// employee in the body, and the lookup used to resolve it in any tenant (GHSA-6qvm-3wg4-26w4).
		if (employeeId) {
			const employee = await this.typeOrmEmployeeRepository.findOneBy({ id: employeeId, tenantId });
			if (!employee) {
				throw new ForbiddenException('The employee does not belong to this tenant');
			}
			// Assign the employee's organizationId if it's not provided
			if (isEmpty(organizationId)) {
				organizationId = employee.organizationId;
			}
		}

		// Log empty activities and filter out any invalid ones
		console.log(
			`Empty bulk App & URL's activities for employee (${user.name}): ${employeeId}`,
			activities.filter((activity: IActivity) => Object.keys(activity).length === 0)
		);

		// Body-supplied activity ids / time slot ids are kept only when they are the employee's own:
		// save() upserts by primary key alone and would otherwise overwrite any tenant's activity. The
		// request-level `projectId` is applied BEFORE the check, so it is tenant-scoped like the
		// per-activity ones rather than overriding them unchecked.
		const validActivities = await scopeActivitiesForWrite(
			activities
				.filter((activity: IActivity) => Object.keys(activity).length !== 0)
				.map((activity: IActivity) => ({ ...activity, ...(projectId ? { projectId } : {}) })),
			this.typeOrmActivityRepository,
			{ tenantId, employeeId }
		);

		activities = validActivities
			.map(
				(activity: IActivity) =>
					// `recordedAt` is guaranteed by `ActivitySubscriber.beforeEntityCreate`, which
					// runs for every Activity write path (bulk save, single create, imports).
					new Activity({
						...activity,
						employeeId,
						organizationId,
						tenantId
					})
			);

		// Log the activities that will be inserted into the database
		console.log(`Activities should be inserted into database for employee (${user.name})`, { activities });

		// Save activities if they exist, otherwise return an empty array
		return isNotEmpty(activities) ? await this.typeOrmActivityRepository.save(activities) : [];
	}
}
