import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IActivity } from '@gauzy/contracts';
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

		const user = RequestContext.currentUser();
		const tenantId = RequestContext.currentTenantId();

		let { employeeId, organizationId, activities = [] } = input;
		try {
			const userId = RequestContext.currentUserId();
			let employee = await this.employeeRepository.findOneByOrFail({
				userId,
				tenantId
			});
			employeeId = employee.id;
			organizationId = isEmpty(organizationId) ? employee.organizationId : organizationId;
		} catch (error) {
			console.log('Error while finding logged in employee for create bulk activities', error);
		}

		console.log(`Empty Bulk App & URL's Activities For: ${user.name} : ${employeeId}`, activities.filter(
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

		console.log('Activities should be insert into database:', { activities });
		if (activities.length > 0) {
			return await this.activityRepository.save(activities);
		} else {
			return [];
		}
	}
}
