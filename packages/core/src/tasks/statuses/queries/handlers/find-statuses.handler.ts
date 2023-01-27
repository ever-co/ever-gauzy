import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { IPagination, ITaskStatus } from '@gauzy/contracts';
import { TaskStatusService } from '../../status.service';
import { FindStatusesQuery } from '../find-statuses.query';

@QueryHandler(FindStatusesQuery)
export class FindStatusesHandler implements IQueryHandler<FindStatusesQuery> {

	constructor(
		private readonly taskStatusService: TaskStatusService
	) {}

	async execute(query: FindStatusesQuery): Promise<IPagination<ITaskStatus>> {
		const { options } = query;
		return await this.taskStatusService.findAllStatuses(options);
	}
}
