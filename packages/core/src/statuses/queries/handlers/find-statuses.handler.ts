import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { IPagination, IStatus } from '@gauzy/contracts';
import { StatusService } from '../../status.service';
import { FindStatusesQuery } from '../find-statuses.query';

@QueryHandler(FindStatusesQuery)
export class FindStatusesHandler implements IQueryHandler<FindStatusesQuery> {
	constructor(private readonly statusService: StatusService) {}

	async execute(query: FindStatusesQuery): Promise<IPagination<IStatus>> {
		const { options } = query;
		return await this.statusService.findAllStatuses(options);
	}
}
