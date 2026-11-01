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
	UsePipes
} from '@nestjs/common';
import {
	ApiBadRequestResponse,
	ApiCreatedResponse,
	ApiInternalServerErrorResponse,
	ApiOperation,
	ApiResponse,
	ApiTags
} from '@nestjs/swagger';
import { DeleteResult, UpdateResult } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { ID, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { Deal } from './deal.entity';
import { DealService } from './deal.service';
import { CrudController, FindOptionsQueryDTO, BaseQueryDTO } from '../core/crud';
import { TenantOrganizationBaseDTO } from '../core/dto';
import { Permissions } from '../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { AbstractValidationPipe, UseValidationPipe, UUIDValidationPipe } from '../shared/pipes';
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
	async findAll(@Query() params: BaseQueryDTO<Deal>): Promise<IPagination<Deal>> {
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
	async findById(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query() options: FindOptionsQueryDTO<Deal>
	): Promise<Deal> {
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

	/*
	 * The four writes below are the ones `CrudController` declares. They are overridden only to state
	 * `EDIT_SALES_PIPELINES`, the permission the web app already asks for before it offers to edit,
	 * move, delete or restore a deal: inherited, they ran under the class's view permission. Each
	 * hands the request to the base route unchanged, so what a write accepts and answers stays the
	 * same. The GraphQL fields that mirror them state the same permission.
	 */

	/**
	 * Updates a deal.
	 *
	 * @param id - The deal to update.
	 * @param entity - The values to write.
	 * @returns The result of the update.
	 */
	@ApiOperation({ summary: 'Update a deal' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The deal has been successfully updated.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Deal not found' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input provided for update' })
	@HttpCode(HttpStatus.ACCEPTED)
	@Permissions(PermissionsEnum.EDIT_SALES_PIPELINES)
	@Put(':id')
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: QueryDeepPartialEntity<Deal>
	): Promise<UpdateResult | Deal> {
		return await super.update(id, entity);
	}

	/**
	 * Deletes a deal.
	 *
	 * @param id - The deal to delete.
	 * @returns The result of the deletion.
	 */
	@ApiOperation({ summary: 'Delete a deal' })
	@ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'The deal has been successfully deleted.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Deal not found' })
	@HttpCode(HttpStatus.ACCEPTED)
	@Permissions(PermissionsEnum.EDIT_SALES_PIPELINES)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<DeleteResult> {
		return await super.delete(id);
	}

	/**
	 * Soft deletes a deal, so it can be restored.
	 *
	 * @param id - The deal to soft delete.
	 * @param options - The inherited options, forwarded to the base route.
	 * @returns The soft-deleted deal.
	 */
	@ApiOperation({ summary: 'Soft delete a deal by ID' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Deal soft deleted successfully' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Deal not found' })
	@HttpCode(HttpStatus.ACCEPTED)
	@Permissions(PermissionsEnum.EDIT_SALES_PIPELINES)
	@Delete(':id/soft')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: ID, ...options: unknown[]): Promise<Deal> {
		return await super.softRemove(id, ...options);
	}

	/**
	 * Restores a soft-deleted deal.
	 *
	 * @param id - The deal to restore.
	 * @param options - The inherited options, forwarded to the base route.
	 * @returns The restored deal.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted deal by ID' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Deal restored successfully' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Deal not found or not in a soft-deleted state' })
	@HttpCode(HttpStatus.ACCEPTED)
	@Permissions(PermissionsEnum.EDIT_SALES_PIPELINES)
	@Put(':id/recover')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: ID, ...options: unknown[]): Promise<Deal> {
		return await super.softRecover(id, ...options);
	}
}
