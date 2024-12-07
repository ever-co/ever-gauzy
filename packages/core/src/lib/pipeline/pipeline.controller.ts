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
import { DeleteResult, UpdateResult } from 'typeorm';
import { ID, IDeal, IPagination, IPipeline, PermissionsEnum } from '@gauzy/contracts';
import { CrudController, OptionParams, PaginationParams } from './../core/crud';
import { Pipeline } from './pipeline.entity';
import { PipelineService } from './pipeline.service';
import { UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';
import { Permissions } from './../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { CreatePipelineDTO, UpdatePipelineDTO } from './dto';

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
	@Get('/pagination')
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
	@Get('/')
	public async findAll(@Query() filter: PaginationParams<Pipeline>): Promise<IPagination<IPipeline>> {
		return await this.pipelineService.findAll(filter);
	}

	/**
	 * Get deals associated with a specific pipeline
	 *
	 * @param pipelineId The ID of the pipeline
	 * @param options Filter conditions for fetching the deals
	 * @returns A promise of paginated deals
	 */
	@ApiOperation({ summary: 'Get deals for a specific pipeline' })
	@ApiResponse({ status: 200, description: 'Success' })
	@ApiResponse({ status: 400, description: 'Bad Request' })
	@ApiResponse({ status: 404, description: 'Not Found' })
	@Permissions(PermissionsEnum.VIEW_SALES_PIPELINES)
	@Get('/:pipelineId/deals')
	async getPipelineDeals(
		@Param('pipelineId', UUIDValidationPipe) pipelineId: ID,
		@Query() options: OptionParams<Pipeline>
	): Promise<IPagination<IDeal>> {
		return await this.pipelineService.getPipelineDeals(pipelineId, options.where);
	}

	/**
	 * Find a Pipeline by ID
	 *
	 * @param id - The ID of the Pipeline to find
	 * @returns The found Pipeline
	 */
	@ApiOperation({ summary: 'Find a Pipeline by ID' })
	@ApiResponse({ status: 200, description: 'The found Pipeline' })
	@ApiResponse({ status: 404, description: 'Pipeline not found' })
	@Permissions(PermissionsEnum.VIEW_SALES_PIPELINES)
	@Get('/:id')
	async findById(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query() options: OptionParams<Pipeline>
	): Promise<IPipeline> {
		return await this.pipelineService.findById(id, options);
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
	@Post('/')
	@UseValidationPipe()
	async create(@Body() entity: CreatePipelineDTO): Promise<IPipeline> {
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
	@Put('/:id')
	@UseValidationPipe()
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdatePipelineDTO
	): Promise<UpdateResult | Pipeline> {
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
	@Delete('/:id')
	async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<DeleteResult> {
		return await this.pipelineService.delete(id);
	}
}
