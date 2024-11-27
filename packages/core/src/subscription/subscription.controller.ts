import { CommandBus } from '@nestjs/cqrs';
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DeleteResult } from 'typeorm';
import { ID, IPagination, ISubscription } from '@gauzy/contracts';
import { UseValidationPipe, UUIDValidationPipe } from './../shared/pipes';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { CrudController, OptionParams, PaginationParams } from './../core/crud';
import { Subscription } from './subscription.entity';
import { SubscriptionService } from './subscription.service';
import { SubscriptionCreateCommand } from './commands';
import { CreateSubscriptionDTO, SubscriptionFindInputDTO } from './dto';

@ApiTags('Subscriptions')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller('/subscription')
export class SubscriptionController extends CrudController<Subscription> {
	constructor(private readonly subscriptionService: SubscriptionService, private readonly commandBus: CommandBus) {
		super(subscriptionService);
	}

	@ApiOperation({
		summary: 'Find all subscriptions filtered by type.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found subscriptions',
		type: Subscription
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	@UseValidationPipe()
	async findAll(@Query() params: PaginationParams<Subscription>): Promise<IPagination<ISubscription>> {
		return await this.subscriptionService.findAll(params);
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
	async findById(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query() params: OptionParams<Subscription>
	): Promise<Subscription> {
		return this.subscriptionService.findOneByIdString(id, params);
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
	@HttpCode(HttpStatus.ACCEPTED)
	@Post()
	@UseValidationPipe({ whitelist: true })
	async create(@Body() entity: CreateSubscriptionDTO): Promise<ISubscription> {
		return await this.commandBus.execute(new SubscriptionCreateCommand(entity));
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
	async delete(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query() options: SubscriptionFindInputDTO
	): Promise<DeleteResult> {
		return await this.subscriptionService.unsubscribe(id, options);
	}
}
