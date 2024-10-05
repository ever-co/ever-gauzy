import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IActivity, PermissionsEnum } from '@gauzy/contracts';
import { isEmpty, isNotEmpty } from '@gauzy/common';
import { Activity } from '../../activity.entity';
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
		const tenantId = RequestContext.currentTenantId() ?? input.tenantId;

		// Check if the logged user has permission to change the selected employee
		const hasChangeEmployeePermission = RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE);

		// Assign current employeeId if the user doesn't have permission or if employeeId is not provided
		if (!hasChangeEmployeePermission || (isEmpty(employeeId) && RequestContext.currentEmployeeId())) {
			employeeId = RequestContext.currentEmployeeId();
		}

		// Assign the current user's organizationId if it's not provided
		if (isEmpty(organizationId) && employeeId) {
			const employee = await this.typeOrmEmployeeRepository.findOneBy({ id: employeeId });
			organizationId = employee ? employee.organizationId : null;
		}

		// Log empty activities and filter out any invalid ones
		console.log(
			`Empty bulk App & URL's activities for employee (${user.name}): ${employeeId}`,
			activities.filter((activity: IActivity) => Object.keys(activity).length === 0)
		);

		activities = activities
			.filter((activity: IActivity) => Object.keys(activity).length !== 0)
			.map(
				(activity: IActivity) =>
					new Activity({
						...activity,
						...(projectId ? { projectId } : {}),
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
