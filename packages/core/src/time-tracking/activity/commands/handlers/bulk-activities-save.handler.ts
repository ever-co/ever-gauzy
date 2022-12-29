import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IActivity, PermissionsEnum } from '@gauzy/contracts';
import { isEmpty } from '@gauzy/common';
import { Activity } from '../../activity.entity';
import { BulkActivitiesSaveCommand } from '../bulk-activities-save.command';
import { RequestContext } from '../../../../core/context';
import { Employee } from './../../../../core/entities/internal';

@CommandHandler(BulkActivitiesSaveCommand)
export class BulkActivitiesSaveHandler
	implements ICommandHandler<BulkActivitiesSaveCommand> {

	constructor(
		@InjectRepository(Activity)
		private readonly activityRepository: Repository<Activity>,

		@InjectRepository(Employee)
		private readonly employeeRepository: Repository<Employee>
	) {}

	public async execute(command: BulkActivitiesSaveCommand): Promise<IActivity[]> {
		const { input } = command;
		let { employeeId, organizationId, activities = [] } = input;

		const user = RequestContext.currentUser();
		const tenantId = RequestContext.currentTenantId();

		/**
		 * Check logged user does not have employee selection permission
		 */
		if (!RequestContext.hasPermission(
			PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
		)) {
			try {
				let employee = await this.employeeRepository.findOneByOrFail({
					userId: user.id,
					tenantId
				});
				employeeId = employee.id;
				organizationId = employee.organizationId;
			} catch (error) {
				console.log(`Error while finding logged in employee for (${user.name}) create bulk activities`, error);
			}
		} else {
			/*
			* If employeeId not send from desktop timer request payload
			*/
			if (isEmpty(employeeId) && RequestContext.currentEmployeeId()) {
				employeeId = RequestContext.currentEmployeeId();
			}
		}

		/*
		 * If organization not found in request then assign current logged user organization
		 */
		if (isEmpty(organizationId)) {
			let employee = await this.employeeRepository.findOneBy({
				id: employeeId
			});
			organizationId = employee ? employee.organizationId : null;
		}

		console.log(`Empty bulk App & URL's activities for employee (${user.name}) : ${employeeId}`, activities.filter(
			(activity: IActivity) => Object.keys(activity).length === 0
		))

		activities = activities.filter(
			(activity: IActivity) => Object.keys(activity).length !== 0
		).map((activity: IActivity) => {
			activity = new Activity({
				...activity,
				...(input.projectId ? { projectId: input.projectId } : {}),
				employeeId,
				organizationId,
				tenantId,
			});
			return activity;
		});

		console.log(`Activities should be insert into database for employee (${user.name})`, { activities });
		if (activities.length > 0) {
			return await this.activityRepository.save(activities);
		} else {
			return [];
		}
	}
}
