import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { IPagination, ITaskVersion } from '@gauzy/contracts';
import { TaskVersionService } from '../../version.service';
import { FindVersionsQuery } from '../find-versions.query';

@QueryHandler(FindVersionsQuery)
export class FindVersionsHandler implements IQueryHandler<FindVersionsQuery> {

	constructor(
		private readonly taskVersionService: TaskVersionService
	) { }

	/**
	 *
	 * @param query
	 * @returns
	 */
	async execute(query: FindVersionsQuery): Promise<IPagination<ITaskVersion>> {
		const { options } = query;
		return await this.taskVersionService.fetchAll(options);
	}
}
