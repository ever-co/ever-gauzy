import { CommandBus } from '@nestjs/cqrs';
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
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
		private readonly entitySubscriptionService: EntitySubscriptionService,
		private readonly commandBus: CommandBus
	) {
		super(entitySubscriptionService);
	}

	@ApiOperation({
		summary: 'Find all subscriptions filtered by type.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found subscriptions',
		type: EntitySubscription
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	@UseValidationPipe()
	async findAll(@Query() params: PaginationParams<EntitySubscription>): Promise<IPagination<IEntitySubscription>> {
		return await this.entitySubscriptionService.findAll(params);
	}

	@ApiOperation({ summary: 'Find by id' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found one record' /*, type: T*/
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get(':id')
	@UseValidationPipe()
	async findById(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query() params: OptionParams<EntitySubscription>
	): Promise<EntitySubscription> {
		return this.entitySubscriptionService.findOneByIdString(id, params);
	}

	@ApiOperation({ summary: 'Subscribe to an entity' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe({ whitelist: true })
	async create(@Body() entity: CreateEntitySubscriptionDTO): Promise<IEntitySubscription> {
		return await this.commandBus.execute(new EntitySubscriptionCreateCommand(entity));
	}

	@ApiOperation({ summary: 'Unsubscribe from entity' })
	@ApiResponse({
		status: HttpStatus.NO_CONTENT,
		description: 'Subscription was deleted successfully'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Delete('/:id')
	@UseValidationPipe({ whitelist: true })
	async delete(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query() options: EntitySubscriptionFindInputDTO
	): Promise<DeleteResult> {
		return await this.entitySubscriptionService.unsubscribe(id, options);
	}
}
