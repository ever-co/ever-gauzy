import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { IPagination, ITaskRelatedIssueType } from '@gauzy/contracts';
import { TaskRelatedIssueTypeService } from '../../related-issue-type.service';
import { FindRelatedIssueTypesQuery } from '../find-related-issue-type.query';

@QueryHandler(FindRelatedIssueTypesQuery)
export class FindRelatedIssueTypesHandler implements IQueryHandler<FindRelatedIssueTypesQuery> {

	constructor(
		private readonly TaskRelatedIssueTypeervice: TaskRelatedIssueTypeService
	) { }

	/**
	 *
	 * @param query
	 * @returns
	 */
	async execute(query: FindRelatedIssueTypesQuery): Promise<IPagination<ITaskRelatedIssueType>> {
		const { options } = query;
		return await this.TaskRelatedIssueTypeervice.fetchAll(options);
	}
}
