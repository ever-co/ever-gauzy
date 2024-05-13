import { Body, Controller, Get, HttpCode, HttpStatus, Param, Put, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
	IIssueType,
	IIssueTypeCreateInput,
	IIssueTypeFindInput,
	IIssueTypeUpdateInput,
	IPagination,
	IPaginationParam
} from '@gauzy/contracts';
import { CountQueryDTO } from '../../shared/dto';
import { UseValidationPipe } from '../../shared/pipes';
import { CrudFactory, PaginationParams } from './../../core/crud';
import { IssueType } from './issue-type.entity';
import { IssueTypeService } from './issue-type.service';
import { CreateIssueTypeDTO, IssueTypeQueryDTO, UpdateIssueTypeDTO } from './dto';
import { TenantPermissionGuard } from '../../shared/guards';

@UseGuards(TenantPermissionGuard)
@ApiTags('Issue Type')
@Controller()
export class IssueTypeController extends CrudFactory<
	IssueType,
	IPaginationParam,
	IIssueTypeCreateInput,
	IIssueTypeUpdateInput,
	IIssueTypeFindInput
>(PaginationParams, CreateIssueTypeDTO, UpdateIssueTypeDTO, CountQueryDTO) {
	constructor(protected readonly issueTypeService: IssueTypeService) {
		super(issueTypeService);
	}

	/**
	 * GET issue types by filters
	 * If parameters not match, retrieve global task sizes
	 *
	 * @param params
	 * @returns
	 */
	@ApiOperation({ summary: 'Find issue types by filters.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found task issue type by filters.'
	})
	@HttpCode(HttpStatus.OK)
	@Get()
	@UseValidationPipe({ whitelist: true })
	async findAllIssueTypes(@Query() params: IssueTypeQueryDTO): Promise<IPagination<IIssueType>> {
		console.log('IssueTypeController -> findAllIssueTypes -> params', params);
		return await this.issueTypeService.fetchAll(params);
	}

	@ApiOperation({ summary: 'Make issue type default.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Task issue type maked as default'
	})
	@HttpCode(HttpStatus.OK)
	@Put(':id/default')
	@UseValidationPipe({ whitelist: true })
	async makeIssueTypeAsDefault(
		@Param('id') id: IIssueType['id'],
		@Body() input: IIssueTypeUpdateInput
	): Promise<IIssueType[]> {
		console.log('===============================route', 'child controller');
		return await this.issueTypeService.makeIssueTypeAsDefault(id, input);
	}
}
