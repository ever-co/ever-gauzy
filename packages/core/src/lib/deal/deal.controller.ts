import { Body, Controller, Get, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
	ApiBadRequestResponse,
	ApiCreatedResponse,
	ApiInternalServerErrorResponse,
	ApiOperation,
	ApiResponse,
	ApiTags
} from '@nestjs/swagger';
import { ID, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { Deal } from './deal.entity';
import { DealService } from './deal.service';
import { CrudController, OptionParams, PaginationParams } from '../core/crud';
import { Permissions } from '../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { UseValidationPipe, UUIDValidationPipe } from '../shared/pipes';
import { CreateDealDTO } from './dto';

@ApiTags('Deal')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.VIEW_SALES_PIPELINES)
@Controller('/deals')
export class DealController extends CrudController<Deal> {
	constructor(private readonly _dealService: DealService) {
		super(_dealService);
	}

	/**
	 * Retrieve all deals with optional filtering and pagination.
	 *
	 * @param params - Pagination and filtering parameters
	 * @returns A paginated result of deals
	 */
	@ApiOperation({ summary: 'Retrieve all deals with optional filtering and pagination' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Successfully retrieved deals.'
	})
	@Get('/')
	async findAll(@Query() params: PaginationParams<Deal>): Promise<IPagination<Deal>> {
		return await this._dealService.findAll(params);
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
	@ApiOperation({ summary: 'Find a deal by ID' })
	@ApiResponse({ status: 200, description: 'The found deal' })
	@ApiResponse({ status: 404, description: 'Deal not found' })
	@Get('/:id')
	async findById(@Param('id', UUIDValidationPipe) id: ID, @Query() options: OptionParams<Deal>): Promise<Deal> {
		return await this._dealService.findOneByIdString(id, options);
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
	@UseValidationPipe({ whitelist: true })
	async create(@Body() entity: CreateDealDTO): Promise<Deal> {
		// Call the create method on the dealService with the provided entity data
		return await this._dealService.create(entity);
	}
}
