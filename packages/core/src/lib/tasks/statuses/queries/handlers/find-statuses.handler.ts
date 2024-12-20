import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { BadRequestException } from '@nestjs/common';
import { IPagination, ITaskStatus } from '@gauzy/contracts';
import { TaskStatusService } from '../../status.service';
import { FindStatusesQuery } from '../find-statuses.query';

@QueryHandler(FindStatusesQuery)
export class FindStatusesHandler implements IQueryHandler<FindStatusesQuery> {

	constructor(
		private readonly taskStatusService: TaskStatusService
	) { }

	/**
	 * Executes a query to find task statuses with pagination options.
	 * @param query - The FindStatusesQuery containing search criteria and pagination options.
	 * @returns A promise of paginated results with task statuses.
	 */
	async execute(query: FindStatusesQuery): Promise<IPagination<ITaskStatus>> {
		try {
			const { options } = query;
			// Fetch all task statuses based on the query options
			return await this.taskStatusService.fetchAll(options);
		} catch (error) {
			// Handle errors and return appropriate error response
			throw new BadRequestException('An error occurred while fetching task statuses. Please check your query parameters.');
		}
	}
}
