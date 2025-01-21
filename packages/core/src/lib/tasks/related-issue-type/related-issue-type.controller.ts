import { QueryBus } from '@nestjs/cqrs';
import { Controller, Get, HttpCode, HttpStatus, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
	IPagination,
	IPaginationParam,
	ITaskRelatedIssueType,
	ITaskRelatedIssueTypeCreateInput,
	ITaskRelatedIssueTypeFindInput,
	ITaskRelatedIssueTypeUpdateInput
} from '@gauzy/contracts';
import { TenantPermissionGuard } from '../../shared/guards';
import { CountQueryDTO } from '../../shared/dto';
import { UseValidationPipe } from '../../shared/pipes';
import { CrudFactory, PaginationParams } from '../../core/crud';
import { TaskRelatedIssueTypeService } from './related-issue-type.service';
import { TaskRelatedIssueType } from './related-issue-type.entity';
import { FindRelatedIssueTypesQuery } from './queries';
import { CreateRelatedIssueTypeDTO, RelatedIssueTypeQueryDTO, UpdatesRelatedIssueTypeDTO } from './dto';

@UseGuards(TenantPermissionGuard)
@ApiTags('Task RelatedIssueTypes')
@Controller('/task-related-issue-types')
export class TaskRelatedIssueTypeController extends CrudFactory<
	TaskRelatedIssueType,
	IPaginationParam,
	ITaskRelatedIssueTypeCreateInput,
	ITaskRelatedIssueTypeUpdateInput,
	ITaskRelatedIssueTypeFindInput
>(PaginationParams, CreateRelatedIssueTypeDTO, UpdatesRelatedIssueTypeDTO, CountQueryDTO) {
	constructor(
		private readonly queryBus: QueryBus,
		protected readonly TaskRelatedIssueTypeService: TaskRelatedIssueTypeService
	) {
		super(TaskRelatedIssueTypeService);
	}

	/**
	 * GET statuses by filters
	 * If parameters not match, retrieve global statuses
	 *
	 * @param params
	 * @returns
	 */
	@ApiOperation({ summary: 'Find task statuses by filters.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found task statuses by filters.'
	})
	@HttpCode(HttpStatus.OK)
	@Get()
	@UseValidationPipe({ whitelist: true })
	async findTaskRelatedIssueType(
		@Query() params: RelatedIssueTypeQueryDTO
	): Promise<IPagination<ITaskRelatedIssueType>> {
		return await this.queryBus.execute(new FindRelatedIssueTypesQuery(params));
	}
}
