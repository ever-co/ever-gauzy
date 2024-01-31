import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { IActivity, PermissionsEnum } from '@gauzy/contracts';
import { isEmpty, isNotEmpty } from '@gauzy/common';
import { Activity } from '../../activity.entity';
import { BulkActivitiesSaveCommand } from '../bulk-activities-save.command';
import { RequestContext } from '../../../../core/context';
import { Employee } from './../../../../core/entities/internal';
import { TypeOrmActivityRepository } from '../../repository/type-orm-activity.repository';
import { TypeOrmEmployeeRepository } from '../../../../employee/repository/type-orm-employee.repository';

@CommandHandler(BulkActivitiesSaveCommand)
export class BulkActivitiesSaveHandler
	implements ICommandHandler<BulkActivitiesSaveCommand> {

	constructor(
		@InjectRepository(Activity)
		private readonly typeOrmActivityRepository: TypeOrmActivityRepository,

		@InjectRepository(Employee)
		private readonly typeOrmEmployeeRepository: TypeOrmEmployeeRepository
	) { }

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
				let employee = await this.typeOrmEmployeeRepository.findOneByOrFail({
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
			let employee = await this.typeOrmEmployeeRepository.findOneBy({
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
		if (isNotEmpty(activities)) {
			return await this.typeOrmActivityRepository.save(activities);
		} else {
			return [];
		}
	}
}
