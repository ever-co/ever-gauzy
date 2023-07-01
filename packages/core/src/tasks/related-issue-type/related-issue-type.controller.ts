import { QueryBus } from '@nestjs/cqrs';
import {
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Query,
	UseGuards,
	UsePipes,
	ValidationPipe,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
	IPagination,
	IPaginationParam,
	ITaskRelatedIssueType,
	ITaskRelatedIssueTypeCreateInput,
	ITaskRelatedIssueTypeFindInput,
	ITaskRelatedIssueTypeUpdateInput,
} from '@gauzy/contracts';
import { TenantPermissionGuard } from '../../shared/guards';
import { CountQueryDTO } from '../../shared/dto';
import { CrudFactory, PaginationParams } from '../../core/crud';
import { TaskRelatedIssueTypesService } from './related-issue-type.service';
import { TaskRelatedIssueTypes } from './related-issue-type.entity';
import { FindRelatedIssueTypesQuery } from './queries';
import {
	CreateRelatedIssueTypeDTO,
	RelatedIssueTypeQueryDTO,
	UpdatesRelatedIssueTypeDTO,
} from './dto';

@UseGuards(TenantPermissionGuard)
@ApiTags('Task RelatedIssueTypes')
@Controller()
export class TaskRelatedIssueTypesController extends CrudFactory<
	TaskRelatedIssueTypes,
	IPaginationParam,
	ITaskRelatedIssueTypeCreateInput,
	ITaskRelatedIssueTypeUpdateInput,
	ITaskRelatedIssueTypeFindInput
>(
	PaginationParams,
	CreateRelatedIssueTypeDTO,
	UpdatesRelatedIssueTypeDTO,
	CountQueryDTO
) {
	constructor(
		private readonly queryBus: QueryBus,
		protected readonly taskRelatedIssueTypesService: TaskRelatedIssueTypesService
	) {
		super(taskRelatedIssueTypesService);
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
		description: 'Found task statuses by filters.',
	})
	@HttpCode(HttpStatus.OK)
	@Get()
	@UsePipes(new ValidationPipe({ whitelist: true }))
	async findTaskRelatedIssueTypes(
		@Query() params: RelatedIssueTypeQueryDTO
	): Promise<IPagination<ITaskRelatedIssueType>> {
		return await this.queryBus.execute(
			new FindRelatedIssueTypesQuery(params)
		);
	}
}
