import { Body, Controller, Get, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
	ApiBadRequestResponse,
	ApiCreatedResponse,
	ApiInternalServerErrorResponse,
	ApiOperation,
	ApiResponse,
	ApiTags
} from '@nestjs/swagger';
import { DeepPartial } from 'typeorm';
import { ID, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { Deal } from './deal.entity';
import { DealService } from './deal.service';
import { CrudController, OptionParams, PaginationParams } from '../core/crud';
import { Permissions } from '../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { UUIDValidationPipe } from '../shared/pipes';

@ApiTags('Deal')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.VIEW_SALES_PIPELINES)
@Controller()
export class DealController extends CrudController<Deal> {
	constructor(private readonly dealService: DealService) {
		super(dealService);
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
	async findAll(@Query() filter: PaginationParams<Deal>): Promise<IPagination<Deal>> {
		return await this.dealService.findAll(filter);
	}

	/**
	 * Find a deal by ID.
	 *
	 * Retrieves a deal by its unique identifier.
	 *
	 * @param id - The ID of the deal to retrieve.
	 * @param query - Query parameters for relations.
	 * @returns A promise resolving to the found deal entity.
	 */
	@Get('/:id')
	@ApiOperation({ summary: 'Find a deal by ID' })
	@ApiResponse({ status: 200, description: 'The found deal' })
	@ApiResponse({ status: 404, description: 'Deal not found' })
	async findById(@Param('id', UUIDValidationPipe) id: ID, @Query() options: OptionParams<Deal>): Promise<Deal> {
		return await this.dealService.findById(id, options);
	}

	/**
	 * Creates a new deal entity.
	 *
	 * This method handles the creation of a new deal entity by calling the create method
	 * on the dealService with the provided entity data.
	 *
	 * @param entity - The partial deal entity data to create.
	 * @returns A promise that resolves to the created deal entity.
	 */
	@ApiOperation({ summary: 'Create a new deal' })
	@ApiCreatedResponse({ type: Deal, description: 'The deal has been successfully created.' })
	@ApiBadRequestResponse({ description: 'Invalid request data.' })
	@ApiInternalServerErrorResponse({ description: 'Internal server error.' })
	@Permissions(PermissionsEnum.EDIT_SALES_PIPELINES)
	@Post('/')
	async create(@Body() entity: DeepPartial<Deal>): Promise<Deal> {
		// Call the create method on the dealService with the provided entity data
		return await this.dealService.create(entity);
	}
}
