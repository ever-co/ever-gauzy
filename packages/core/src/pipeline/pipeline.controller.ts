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
	UseGuards
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DeepPartial } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { IDeal, IPagination, IPipeline, PermissionsEnum } from '@gauzy/contracts';
import { CrudController, PaginationParams } from './../core/crud';
import { Pipeline } from './pipeline.entity';
import { PipelineService } from './pipeline.service';
import { UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';
import { Permissions } from './../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';

@ApiTags('Pipeline')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.EDIT_SALES_PIPELINES)
@Controller()
export class PipelineController extends CrudController<Pipeline> {
	constructor(protected readonly pipelineService: PipelineService) {
		super(pipelineService);
	}

	/**
	 * Paginate sales pipelines with permissions, validation, and filtering options.
	 *
	 * @param filter - The filtering options for pagination.
	 * @returns The paginated result of sales pipelines.
	 */
	@Permissions(PermissionsEnum.VIEW_SALES_PIPELINES)
	@Get('pagination')
	@UseValidationPipe({ transform: true })
	async pagination(@Query() filter: PaginationParams<Pipeline>): Promise<IPagination<IPipeline>> {
		return await this.pipelineService.pagination(filter);
	}

	/**
	 * Find all sales pipelines with permissions, API documentation, and query parameter parsing.
	 *
	 * @param data - The query parameter data.
	 * @returns A paginated result of sales pipelines.
	 */
	@ApiOperation({ summary: 'find all' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found records'
	})
	@Permissions(PermissionsEnum.VIEW_SALES_PIPELINES)
	@Get()
	public async findAll(@Query() filter: PaginationParams<Pipeline>): Promise<IPagination<IPipeline>> {
		return await this.pipelineService.findAll(filter);
	}

	/**
	 * Find deals for a specific sales pipeline with permissions, API documentation, and parameter validation.
	 *
	 * @param id - The identifier of the sales pipeline.
	 * @returns A paginated result of deals for the specified sales pipeline.
	 */
	@ApiOperation({ summary: 'find deals' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found records'
	})
	@Permissions(PermissionsEnum.VIEW_SALES_PIPELINES)
	@Get(':id/deals')
	public async findDeals(@Param('id', UUIDValidationPipe) id: string): Promise<IPagination<IDeal>> {
		return await this.pipelineService.findDeals(id);
	}

	/**
	 * Create a new record with permissions, API documentation, and HTTP status codes.
	 *
	 * @param entity - The data to create a new record.
	 * @returns The created record.
	 */
	@ApiOperation({ summary: 'Create new record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.' /*, type: T*/
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.CREATED)
	@Permissions(PermissionsEnum.EDIT_SALES_PIPELINES)
	@Post()
	async create(@Body() entity: DeepPartial<Pipeline>): Promise<IPipeline> {
		return await this.pipelineService.create(entity);
	}

	/**
	 * Update an existing record with permissions, API documentation, and HTTP status codes.
	 *
	 * @param id - The identifier of the record to update.
	 * @param entity - The data to update the existing record.
	 * @param options - Additional options if needed.
	 * @returns The updated record.
	 */
	@ApiOperation({ summary: 'Update an existing record' })
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
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Permissions(PermissionsEnum.EDIT_SALES_PIPELINES)
	@Put(':id')
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: QueryDeepPartialEntity<Pipeline>
	): Promise<any> {
		return await this.pipelineService.update(id, entity);
	}

	/**
	 * Delete a record with permissions, API documentation, and HTTP status codes.
	 *
	 * @param id - The identifier of the record to delete.
	 * @param options - Additional options if needed.
	 * @returns The result of the deletion operation.
	 */
	@ApiOperation({ summary: 'Delete record' })
	@ApiResponse({
		status: HttpStatus.NO_CONTENT,
		description: 'The record has been successfully deleted'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Permissions(PermissionsEnum.EDIT_SALES_PIPELINES)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: string): Promise<any> {
		return await this.pipelineService.delete(id);
	}
}
