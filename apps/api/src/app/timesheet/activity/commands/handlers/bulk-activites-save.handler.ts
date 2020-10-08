import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BulkActivitesSaveCommand } from '../bulk-activites-save.command';
import { InjectRepository } from '@nestjs/typeorm';
import { Activity } from '../../../activity.entity';
import { Repository } from 'typeorm';
import { RequestContext } from 'apps/api/src/app/core/context';

@CommandHandler(BulkActivitesSaveCommand)
export class BulkActivitesSaveHandler
	implements ICommandHandler<BulkActivitesSaveCommand> {
	constructor(
		@InjectRepository(Activity)
		private readonly activityRepository: Repository<Activity>
	) {}

	public async execute(command: BulkActivitesSaveCommand): Promise<any> {
		const { input } = command;
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
