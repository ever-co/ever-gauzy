import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BulkActivitiesSaveCommand } from '../bulk-activities-save.command';
import { InjectRepository } from '@nestjs/typeorm';
import { Activity } from '../../activity.entity';
import { Repository } from 'typeorm';
import { RequestContext } from '../../../../core/context';
import { Employee } from '../../../../employee/employee.entity';

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
		if (!input.organizationId) {
			const user = RequestContext.currentUser();
			const employee = await this.employeeRepository.findOne(
				user.employeeId
			);
			input.organizationId = employee.organizationId;
		}
		const insertActivities = input.activities.map((activity) => {
			activity = new Activity({
				employeeId: input.employeeId,
				organizationId: input.organizationId,
				tenantId: RequestContext.currentTenantId(),
				...(input.projectId ? { projectId: input.projectId } : {}),
				...activity
			});
			return activity;
		});

		if (insertActivities.length > 0) {
			await this.activityRepository.save(insertActivities);
			return insertActivities;
		} else {
			return [];
		}
	}
}
