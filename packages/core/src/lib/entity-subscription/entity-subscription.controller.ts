import { CommandBus } from '@nestjs/cqrs';
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DeleteResult } from 'typeorm';
import { ID, IPagination, IEntitySubscription } from '@gauzy/contracts';
import { UseValidationPipe, UUIDValidationPipe } from './../shared/pipes';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { CrudController, OptionParams, PaginationParams } from './../core/crud';
import { EntitySubscription } from './entity-subscription.entity';
import { EntitySubscriptionService } from './entity-subscription.service';
import { EntitySubscriptionCreateCommand } from './commands/entity-subscription.create.command';
import { CreateEntitySubscriptionDTO, EntitySubscriptionFindInputDTO } from './dto';

@ApiTags('EntitySubscriptions')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller('/entity-subscription')
export class EntitySubscriptionController extends CrudController<EntitySubscription> {
	constructor(
		private readonly _entitySubscriptionService: EntitySubscriptionService,
		private readonly _commandBus: CommandBus
	) {
		super(_entitySubscriptionService);
	}

	/**
	 * Retrieve all subscriptions with optional filtering and pagination.
	 *
	 * Fetches a paginated list of subscriptions, applying any filtering options provided via query parameters.
	 *
	 * @param params - The pagination and filtering parameters for querying subscriptions.
	 * @returns A promise that resolves to a paginated list of subscriptions.
	 */
	@ApiOperation({
		summary: 'Retrieve subscriptions with filtering and pagination',
		description: 'Fetches all subscriptions with optional filtering by type, supporting pagination parameters.'
	})
	@ApiQuery({
		name: 'params',
		description: 'Pagination and filter parameters for subscriptions',
		type: PaginationParams // Ensure PaginationParams is decorated for Swagger if needed
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found subscriptions',
		type: EntitySubscription
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'No subscriptions found'
	})
	@Get('/')
	@UseValidationPipe()
	async findAll(@Query() params: PaginationParams<EntitySubscription>): Promise<IPagination<IEntitySubscription>> {
		return this._entitySubscriptionService.findAll(params);
	}

	/**
	 * Find subscription by ID.
	 *
	 * Retrieves a subscription record using its unique identifier. Optional query parameters can be used
	 * to filter or modify the data retrieval.
	 *
	 * @param id - The unique identifier (UUID) of the subscription.
	 * @param params - Optional query parameters for additional filtering.
	 * @returns A promise that resolves to the found subscription entity.
	 */
	@ApiOperation({
		summary: 'Find subscription by ID',
		description:
			'Retrieves a subscription record using its unique identifier. Optional query parameters allow further filtering of the data.'
	})
	@ApiParam({
		name: 'id',
		description: 'The unique UUID of the subscription',
		type: String
	})
	@ApiQuery({
		name: 'params',
		description: 'Optional query parameters for filtering the subscription data',
		type: OptionParams // Ensure OptionParams is properly defined elsewhere
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found one record',
		type: EntitySubscription
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@UseValidationPipe()
	@Get('/:id')
	async findById(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query() params: OptionParams<EntitySubscription>
	): Promise<IEntitySubscription> {
		return this._entitySubscriptionService.findOneByIdString(id, params);
	}

	/**
	 * Subscribe to an entity.
	 *
	 * Creates a new subscription for an entity using the provided subscription details.
	 *
	 * @param entity - The subscription details required to create a new subscription.
	 * @returns The newly created entity subscription.
	 */
	@ApiOperation({
		summary: 'Subscribe to an entity',
		description: 'Creates a new subscription for an entity using the provided subscription details.'
	})
	@ApiBody({
		description: 'The subscription details for creating a new entity subscription.',
		type: CreateEntitySubscriptionDTO
	})
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.',
		type: EntitySubscription
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input. The response body may contain clues as to what went wrong.'
	})
	@HttpCode(HttpStatus.CREATED)
	@UseValidationPipe({ whitelist: true })
	@Post('/')
	create(@Body() entity: CreateEntitySubscriptionDTO): Promise<IEntitySubscription> {
		return this._commandBus.execute(new EntitySubscriptionCreateCommand(entity));
	}

	/**
	 * Unsubscribe from an entity.
	 *
	 * Removes a subscription based on the provided subscription ID along with any additional query filters.
	 *
	 * @param id - The UUID of the subscription to be deleted.
	 * @param options - Optional query parameters to help locate the subscription.
	 * @returns A promise that resolves with the delete result.
	 */
	@ApiOperation({
		summary: 'Unsubscribe from an entity',
		description: 'Removes a subscription based on its UUID and optional query filters.'
	})
	@ApiParam({
		name: 'id',
		description: 'The unique UUID of the subscription to be deleted.',
		type: String
	})
	@ApiQuery({
		name: 'options',
		description: 'Optional filters to locate the subscription for unsubscribe.',
		type: EntitySubscriptionFindInputDTO
	})
	@ApiResponse({
		status: HttpStatus.ACCEPTED,
		description: 'Unsubscription request accepted.'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Subscription not found.'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@UseValidationPipe({ whitelist: true })
	@Delete('/:id')
	async delete(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query() params: EntitySubscriptionFindInputDTO
	): Promise<DeleteResult> {
		return this._entitySubscriptionService.unsubscribe(id, params);
	}
}
