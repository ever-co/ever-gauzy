import { IAvailabilitySlot, IAvailabilitySlotsCreateInput, ID, IPagination, PermissionsEnum } from '@gauzy/contracts';
import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Put,
	Post,
	Query,
	UseGuards,
	UsePipes
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CrudController } from './../core/crud';
import { TenantOrganizationBaseDTO } from './../core/dto';
import { AvailabilitySlot } from './availability-slots.entity';
import { AvailabilitySlotsService } from './availability-slots.service';
import { Permissions } from './../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { AbstractValidationPipe, ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';
import { AvailabilitySlotsBulkCreateCommand, AvailabilitySlotsCreateCommand } from './commands';

@ApiTags('AvailabilitySlots')
@UseGuards(TenantPermissionGuard)
@Controller('/availability-slots')
export class AvailabilitySlotsController extends CrudController<AvailabilitySlot> {
	constructor(
		private readonly availabilitySlotsService: AvailabilitySlotsService,
		private readonly commandBus: CommandBus
	) {
		super(availabilitySlotsService);
	}

	/**
	 * CREATE slots in bulk
	 *
	 * @param entity
	 * @returns
	 */
	@ApiOperation({ summary: 'Create slots in bulk' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The records have been successfully created.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.CREATED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.EMPLOYEE_AVAILABILITY_CREATE)
	@Post('/bulk')
	async createBulkAvailabilitySlot(@Body() entity: IAvailabilitySlotsCreateInput[]): Promise<IAvailabilitySlot[]> {
		return await this.commandBus.execute(new AvailabilitySlotsBulkCreateCommand(entity));
	}

	/**
	 * GET all availability slots
	 *
	 * @param data
	 * @returns
	 */
	@ApiOperation({ summary: 'Find all availability slots' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found availability slots',
		type: AvailabilitySlot
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findAll(@Query('data', ParseJsonPipe) data: any): Promise<IPagination<IAvailabilitySlot>> {
		const { relations, findInput } = data;
		return this.availabilitySlotsService.findAll({
			where: findInput,
			relations
		});
	}

	/**
	 * CREATE new availability slot
	 *
	 * @param entity
	 * @param options
	 * @returns
	 */
	@ApiOperation({ summary: 'Create new record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.EMPLOYEE_AVAILABILITY_CREATE)
	@Post()
	async create(@Body() entity: IAvailabilitySlotsCreateInput): Promise<IAvailabilitySlot> {
		return await this.commandBus.execute(new AvailabilitySlotsCreateCommand(entity));
	}

	/**
	 * UPDATE availability slot by id — one the caller can read (its own, or any when it may act for other
	 * employees); any other id answers 404.
	 *
	 * @param id
	 * @param entity
	 * @param options
	 * @returns
	 */
	@ApiOperation({ summary: 'Update record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully updated.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.EMPLOYEE_AVAILABILITY_UPDATE)
	@Put(':id')
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: IAvailabilitySlot
	): Promise<IAvailabilitySlot> {
		return this.availabilitySlotsService.updateSlot(id, entity);
	}

	/**
	 * DELETE availability slot by id
	 *
	 * Overrides the inherited `CrudController.delete()` route only to attach the permission gate:
	 * `PermissionGuard` authorizes any route that carries no `@Permissions` metadata, so an inherited handler is
	 * reachable by every member of the tenant until it is gated here (GHSA-v79w-54p2-wmh5).
	 *
	 * @param id
	 * @returns
	 */
	@ApiOperation({ summary: 'Delete record' })
	@ApiResponse({
		status: HttpStatus.ACCEPTED,
		description: 'The record has been successfully deleted'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.EMPLOYEE_AVAILABILITY_DELETE)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<any> {
		return super.delete(id);
	}

	/**
	 * SOFT DELETE availability slot by id
	 *
	 * Overrides the inherited `CrudController.softRemove()` route only to attach the permission gate: the edit grant
	 * `update` states, as owner decision 5 (2026-10-13) has the soft-delete/recover pair require.
	 *
	 * @param id
	 * @returns
	 */
	@ApiOperation({ summary: 'Soft delete a record by ID' })
	@ApiResponse({
		status: HttpStatus.ACCEPTED,
		description: 'Record soft deleted successfully'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.EMPLOYEE_AVAILABILITY_UPDATE)
	@Delete(':id/soft')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<AvailabilitySlot> {
		return super.softRemove(id, ...options);
	}

	/**
	 * RESTORE a soft-deleted availability slot by id
	 *
	 * Overrides the inherited `CrudController.softRecover()` route only to attach the permission gate: the edit grant
	 * `update` states, as owner decision 5 (2026-10-13) has the soft-delete/recover pair require.
	 *
	 * @param id
	 * @returns
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted record by ID' })
	@ApiResponse({
		status: HttpStatus.ACCEPTED,
		description: 'Record restored successfully'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.EMPLOYEE_AVAILABILITY_UPDATE)
	@Put(':id/recover')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<AvailabilitySlot> {
		return super.softRecover(id, ...options);
	}
}
