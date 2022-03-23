import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { IActivity } from '@gauzy/contracts';
import { Repository } from 'typeorm';
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

	public async execute(command: BulkActivitiesSaveCommand): Promise<any> {
		const { input } = command;
		const tenantId = RequestContext.currentTenantId();
		let { employeeId, organizationId, activities = [] } = input;

		if (!organizationId) {
			const user = RequestContext.currentUser();
			const employee = await this.employeeRepository.findOne(
				user.employeeId
			);
			organizationId = employee.organizationId;
		}
		const insertActivities = activities.map((activity: IActivity) => {
			activity = new Activity({
				employeeId,
				organizationId,
				tenantId,
				...(input.projectId ? { projectId: input.projectId } : {}),
				...activity
			});
			return activity;
		});

		if (insertActivities.length > 0) {
			return await this.activityRepository.save(insertActivities);
		} else {
			return [];
		}
	}
}
