import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CommandBus } from '@nestjs/cqrs';
import { DeleteResult, UpdateResult } from 'typeorm';
import { IBroadcast, ID, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { CrudController, BaseQueryDTO } from '../core/crud';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { Permissions } from '../shared/decorators';
import { UseValidationPipe, UUIDValidationPipe } from '../shared/pipes';
import { Broadcast } from './broadcast.entity';
import { BroadcastService } from './broadcast.service';
import { BroadcastCreateCommand, BroadcastUpdateCommand } from './commands';
import { CreateBroadcastDTO, UpdateBroadcastDTO } from './dto';

@ApiTags('Broadcast')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller('/broadcasts')
export class BroadcastController extends CrudController<Broadcast> {
	constructor(
		private readonly broadcastService: BroadcastService,
		private readonly commandBus: CommandBus
	) {
		super(broadcastService);
	}

	/**
	 * GET all broadcasts with optional filters
	 *
	 * @param params - Query parameters for filtering (entity, entityId, organizationId, etc.)
	 * @returns Paginated list of broadcasts
	 */
	@ApiOperation({ summary: 'Find all broadcasts with optional filters' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found broadcasts',
		type: Broadcast,
		isArray: true
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Records not found'
	})
	@Permissions(PermissionsEnum.BROADCAST_READ)
	@Get()
	@UseValidationPipe()
	async findAll(@Query() params: BaseQueryDTO<Broadcast>): Promise<IPagination<IBroadcast>> {
		return await this.broadcastService.findAll(params);
	}

	/**
	 * GET a broadcast by ID
	 *
	 * @param id - The broadcast ID
	 * @returns The broadcast
	 */
	@ApiOperation({ summary: 'Find a broadcast by ID' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found broadcast',
		type: Broadcast
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Permissions(PermissionsEnum.BROADCAST_READ)
	@Get(':id')
	async findById(@Param('id', UUIDValidationPipe) id: ID, @Query() params: BaseQueryDTO<Broadcast>): Promise<IBroadcast> {
		return await this.broadcastService.findOneById(id, params);
	}

	/**
	 * CREATE a new broadcast
	 *
	 * @param entity - The broadcast data
	 * @returns The created broadcast
	 */
	@ApiOperation({ summary: 'Create a new broadcast' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Broadcast created successfully',
		type: Broadcast
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Permissions(PermissionsEnum.BROADCAST_CREATE)
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe()
	async create(@Body() entity: CreateBroadcastDTO): Promise<IBroadcast> {
		return await this.commandBus.execute(new BroadcastCreateCommand(entity));
	}

	/**
	 * UPDATE a broadcast by ID
	 *
	 * @param id - The broadcast ID
	 * @param entity - The updated broadcast data
	 * @returns The updated broadcast
	 */
	@ApiOperation({ summary: 'Update a broadcast' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Broadcast updated successfully',
		type: Broadcast
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Permissions(PermissionsEnum.BROADCAST_UPDATE)
	@HttpCode(HttpStatus.OK)
	@Put(':id')
	@UseValidationPipe()
	async update(@Param('id', UUIDValidationPipe) id: ID, @Body() entity: UpdateBroadcastDTO): Promise<IBroadcast | UpdateResult> {
		return await this.commandBus.execute(new BroadcastUpdateCommand(id, entity));
	}

	/**
	 * DELETE a broadcast by ID
	 *
	 * @param id - The broadcast ID
	 * @returns Delete result
	 */
	@ApiOperation({ summary: 'Delete a broadcast' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Broadcast deleted successfully'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Permissions(PermissionsEnum.BROADCAST_DELETE)
	@HttpCode(HttpStatus.OK)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<DeleteResult> {
		return await this.broadcastService.delete(id);
	}
}
