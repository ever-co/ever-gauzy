import { Controller, UseGuards, Get, Query, HttpStatus, Delete, Param, Post, Body, Put } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CommandBus } from '@nestjs/cqrs';
import { DeleteResult, FindOneOptions, UpdateResult } from 'typeorm';
import { ID, ITimeSlot, PermissionsEnum } from '@gauzy/contracts';
import { Permissions } from './../../shared/decorators';
import { OrganizationPermissionGuard, PermissionGuard, TenantPermissionGuard } from '../../shared/guards';
import { UUIDValidationPipe, UseValidationPipe } from './../../shared/pipes';
import { CreateTimeSlotCommand, DeleteTimeSlotCommand, UpdateTimeSlotCommand } from './commands';
import { TimeSlotService } from './time-slot.service';
import { DeleteTimeSlotDTO, TimeSlotQueryDTO } from './dto';

@ApiTags('TimeSlot')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.TIME_TRACKER, PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ALL_ORG_VIEW)
@Controller('/timesheet/time-slot')
export class TimeSlotController {
	constructor(private readonly _timeSlotService: TimeSlotService, private readonly _commandBus: CommandBus) {}

	/**
	 * Retrieves all time slots based on the provided query options.
	 *
	 * This method accepts query parameters to filter the list of time slots
	 * and uses the `TimeSlotQueryDTO` for validation and transformation.
	 * The method calls the `timeSlotService` to fetch the matching time slots.
	 *
	 * @param options - Query parameters for filtering the time slots.
	 * @returns A promise that resolves to an array of time slots matching the specified criteria.
	 */
	@ApiOperation({ summary: 'Get Time Slots' })
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Get('/')
	@UseValidationPipe({ whitelist: true, transform: true })
	async findAll(@Query() options: TimeSlotQueryDTO): Promise<ITimeSlot[]> {
		return await this._timeSlotService.getTimeSlots(options);
	}

	/**
	 * Retrieves a specific time slot by its ID.
	 *
	 * This method accepts a time slot ID as a parameter and query options for
	 * additional filtering or selecting specific fields. It uses `UUIDValidationPipe`
	 * to ensure that the provided ID is a valid UUID. The method calls the
	 * `timeSlotService` to find the time slot by its ID.
	 *
	 * @param id - The UUID of the time slot to retrieve.
	 * @param options - Additional query options to refine the search (e.g., relations).
	 * @returns A promise that resolves to the time slot object if found.
	 */
	@ApiOperation({ summary: 'Get Time Slot By Id' })
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Get('/:id')
	async findById(@Param('id', UUIDValidationPipe) id: ID, @Query() options: FindOneOptions): Promise<ITimeSlot> {
		return await this._timeSlotService.findOneByIdString(id, options);
	}

	/**
	 * Handles the creation of a new time slot based on the provided request data.
	 * This method is called via an HTTP POST request and invokes the `CreateTimeSlotCommand`
	 * to execute the time slot creation logic.
	 *
	 * @param {ITimeSlot} request - The time slot data provided in the request body.
	 * @returns {Promise<ITimeSlot>} - A promise that resolves to the created TimeSlot instance.
	 */
	@ApiOperation({ summary: 'Create Time Slot' })
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Post('/')
	async create(@Body() request: ITimeSlot): Promise<ITimeSlot> {
		return await this._commandBus.execute(new CreateTimeSlotCommand(request));
	}

	/**
	 * Updates a specific time slot by its ID.
	 *
	 * This method allows modifying the details of a time slot using its unique ID.
	 * It accepts a time slot ID as a parameter and the updated time slot data as the
	 * request body. The method is guarded by `OrganizationPermissionGuard` to ensure
	 * only authorized users with the `ALLOW_MODIFY_TIME` permission can perform updates.
	 *
	 * @param id - The UUID of the time slot to update.
	 * @param request - The updated time slot data to apply.
	 * @returns A promise that resolves to the updated time slot.
	 */
	@ApiOperation({ summary: 'Update Time Slot' })
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@UseGuards(OrganizationPermissionGuard)
	@Permissions(PermissionsEnum.ALLOW_MODIFY_TIME)
	@Put('/:id')
	async update(@Param('id', UUIDValidationPipe) id: ID, @Body() request: ITimeSlot): Promise<ITimeSlot> {
		return await this._commandBus.execute(new UpdateTimeSlotCommand(id, request));
	}

	/**
	 * Deletes time slots based on the provided query parameters.
	 *
	 * This method allows deleting multiple time slots by accepting a list of time slot IDs
	 * in the query parameters. The method is protected by `OrganizationPermissionGuard`
	 * to ensure that only authorized users with the `ALLOW_DELETE_TIME` permission can delete time slots.
	 *
	 * @param query - The DTO containing the IDs of the time slots to delete.
	 * @returns A promise that resolves to either a `DeleteResult` or `UpdateResult` indicating the outcome of the deletion process.
	 */
	@ApiOperation({ summary: 'Delete TimeSlot' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The time slot has been successfully deleted.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@UseGuards(OrganizationPermissionGuard)
	@Permissions(PermissionsEnum.ALLOW_DELETE_TIME)
	@Delete('/')
	@UseValidationPipe({ transform: true })
	async deleteTimeSlot(@Query() options: DeleteTimeSlotDTO): Promise<DeleteResult | UpdateResult> {
		return await this._commandBus.execute(new DeleteTimeSlotCommand(options));
	}
}
