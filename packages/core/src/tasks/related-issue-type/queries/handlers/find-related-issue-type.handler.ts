import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { IPagination, ITaskRelatedIssueType } from '@gauzy/contracts';
import { TaskRelatedIssueTypesService } from '../../related-issue-type.service';
import { FindRelatedIssueTypesQuery } from '../find-related-issue-type.query';

@QueryHandler(FindRelatedIssueTypesQuery)
export class FindRelatedIssueTypesHandler
	implements IQueryHandler<FindRelatedIssueTypesQuery>
{
	constructor(
		private readonly taskRelatedIssueTypeService: TaskRelatedIssueTypesService
	) {}

	async execute(
		query: FindRelatedIssueTypesQuery
	): Promise<IPagination<ITaskRelatedIssueType>> {
		const { options } = query;
		return await this.taskRelatedIssueTypeService.findTaskRelatedIssueTypes(
			options
		);
	}
}
