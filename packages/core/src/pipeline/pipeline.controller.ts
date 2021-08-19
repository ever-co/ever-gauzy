import { CrudController, PaginationParams } from './../core/crud';
import { Pipeline } from './pipeline.entity';
import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Put,
	Query,
	UseGuards,
	UsePipes,
	ValidationPipe
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PipelineService } from './pipeline.service';
import { ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';
import { DeepPartial } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { IDeal, IPagination, IPipeline, PermissionsEnum } from '@gauzy/contracts';
import { Permissions } from './../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';

@ApiTags('Pipeline')
@UseGuards(TenantPermissionGuard)
@Controller()
export class PipelineController extends CrudController<Pipeline> {
	public constructor(protected pipelineService: PipelineService) {
		super(pipelineService);
	}

	@Get('pagination')
	@UsePipes(new ValidationPipe({ transform: true }))
	async pagination(
		@Query() filter: PaginationParams<IPipeline>
	): Promise<IPagination<IPipeline>> {
		return this.pipelineService.pagination(filter);
	}

	@ApiOperation({ summary: 'find all' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found records'
	})
	@Get()
	public async findAll(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<IPipeline>> {
		const { relations = [], findInput: where = null } = data;
		return this.pipelineService.findAll({
			relations,
			where
		});
	}

	@ApiOperation({ summary: 'find deals' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found records'
	})
	@Get(':id/deals')
	public async findDeals(
		@Param('id', UUIDValidationPipe) id: string
	): Promise<IPagination<IDeal>> {
		return this.pipelineService.findDeals(id);
	}

	@ApiOperation({ summary: 'Create new record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.' /*, type: T*/
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Permissions(PermissionsEnum.EDIT_SALES_PIPELINES)
	@HttpCode(HttpStatus.CREATED)
	@UseGuards(PermissionGuard)
	@Post()
	async create(
		@Body() entity: DeepPartial<Pipeline>,
		...options: any[]
	): Promise<IPipeline> {
		return super.create(entity, ...options);
	}

	@ApiOperation({ summary: 'Update an existing record' })
	@Permissions(PermissionsEnum.EDIT_SALES_PIPELINES)
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully edited.'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Put(':id')
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: QueryDeepPartialEntity<Pipeline>,
		...options: any[]
	): Promise<any> {
		return super.update(id, entity, ...options);
	}

	@ApiOperation({ summary: 'Delete record' })
	@Permissions(PermissionsEnum.EDIT_SALES_PIPELINES)
	@ApiResponse({
		status: HttpStatus.NO_CONTENT,
		description: 'The record has been successfully deleted'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return super.delete(id);
	}
}
