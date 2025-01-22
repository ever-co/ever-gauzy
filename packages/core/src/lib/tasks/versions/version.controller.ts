import { QueryBus } from '@nestjs/cqrs';
import { Controller, Get, HttpCode, HttpStatus, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
	IPagination,
	IPaginationParam,
	ITaskVersion,
	ITaskVersionCreateInput,
	ITaskVersionFindInput,
	ITaskVersionUpdateInput
} from '@gauzy/contracts';
import { CrudFactory, PaginationParams } from '../../core/crud';
import { TenantPermissionGuard } from '../../shared/guards';
import { CountQueryDTO } from '../../shared/dto';
import { UseValidationPipe } from '../../shared/pipes';
import { TaskVersionService } from './version.service';
import { TaskVersion } from './version.entity';
import { FindVersionsQuery } from './queries';
import { CreateVersionDTO, VersionQueryDTO, UpdatesVersionDTO } from './dto';

@UseGuards(TenantPermissionGuard)
@ApiTags('Task Version')
@Controller('/task-versions')
export class TaskVersionController extends CrudFactory<
	TaskVersion,
	IPaginationParam,
	ITaskVersionCreateInput,
	ITaskVersionUpdateInput,
	ITaskVersionFindInput
>(PaginationParams, CreateVersionDTO, UpdatesVersionDTO, CountQueryDTO) {
	constructor(private readonly queryBus: QueryBus, protected readonly taskVersionService: TaskVersionService) {
		super(taskVersionService);
	}

	/**
	 * GET versions by filters
	 * If parameters not match, retrieve global versions
	 *
	 * @param params
	 * @returns
	 */
	@ApiOperation({ summary: 'Find task versions by filters.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found task versions by filters.'
	})
	@HttpCode(HttpStatus.OK)
	@Get()
	@UseValidationPipe({ whitelist: true })
	async findTaskVersions(@Query() params: VersionQueryDTO): Promise<IPagination<ITaskVersion>> {
		return await this.queryBus.execute(new FindVersionsQuery(params));
	}
}
