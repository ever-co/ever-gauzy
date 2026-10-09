import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards, UsePipes } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CommandBus } from '@nestjs/cqrs';
import { DeleteResult, UpdateResult } from 'typeorm';
import { IBroadcast, ID, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { CrudController, BaseQueryDTO } from '../core/crud';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { Permissions } from '../shared/decorators';
import { UseValidationPipe, UUIDValidationPipe, AbstractValidationPipe } from '../shared/pipes';
import { Broadcast } from './broadcast.entity';
import { BroadcastService } from './broadcast.service';
import { BroadcastCreateCommand, BroadcastUpdateCommand } from './commands';
import { CreateBroadcastDTO, UpdateBroadcastDTO } from './dto';
import { TenantOrganizationBaseDTO } from '../core/dto';

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

	/**
	 * Soft deletes a record by id.
	 *
	 * Overrides the inherited `CrudController.softRemove()` route only to attach a permission. The base declares
	 * the route with no permission metadata, and `PermissionGuard` answers `true` to empty metadata, so any member
	 * of the tenant could retire the row. It now states `BROADCAST_DELETE`: the grant its own delete route states
	 * (GHSA-v79w-54p2-wmh5). The GraphQL field that mirrors it states the same.
	 *
	 * @param id The record to soft delete.
	 * @param options The inherited options, forwarded to the service.
	 * @returns The soft-deleted record.
	 */
	@ApiOperation({ summary: 'Soft delete a record by ID' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Record soft deleted successfully' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found' })
	@HttpCode(HttpStatus.ACCEPTED)
	@Permissions(PermissionsEnum.BROADCAST_DELETE)
	@Delete(':id/soft')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<Broadcast> {
		return await super.softRemove(id, ...options);
	}

	/**
	 * Restores a record by id.
	 *
	 * Overrides the inherited `CrudController.softRecover()` route only to attach a permission. The base declares
	 * the route with no permission metadata, and `PermissionGuard` answers `true` to empty metadata, so any member
	 * of the tenant could restore the row. It now states `BROADCAST_DELETE`: the grant its own delete route states
	 * (GHSA-v79w-54p2-wmh5). The GraphQL field that mirrors it states the same.
	 *
	 * @param id The record to restore.
	 * @param options The inherited options, forwarded to the service.
	 * @returns The restored record.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted record by ID' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Record restored successfully' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found or not in a soft-deleted state' })
	@HttpCode(HttpStatus.ACCEPTED)
	@Permissions(PermissionsEnum.BROADCAST_DELETE)
	@Put(':id/recover')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<Broadcast> {
		return await super.softRecover(id, ...options);
	}
}
