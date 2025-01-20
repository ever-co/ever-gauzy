import { Controller, UseGuards, Put, HttpStatus, Body, Get, Query, Param, HttpException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CommandBus } from '@nestjs/cqrs';
import { ID, ITimesheet, PermissionsEnum } from '@gauzy/contracts';
import { TimeSheetService } from './timesheet.service';
import { PermissionGuard, TenantPermissionGuard } from './../../shared/guards';
import { UUIDValidationPipe, UseValidationPipe } from './../../shared/pipes';
import { Permissions } from './../../shared/decorators';
import { SubmitTimesheetStatusDTO, TimesheetQueryDTO, UpdateTimesheetStatusDTO } from './dto/query';
import { TimesheetSubmitCommand, TimesheetUpdateStatusCommand } from './commands';

@ApiTags('TimeSheet')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.CAN_APPROVE_TIMESHEET)
@Controller('/timesheet')
export class TimeSheetController {
	constructor(private readonly _commandBus: CommandBus, private readonly _timeSheetService: TimeSheetService) {}

	/**
	 * GET timesheet counts for the same tenant
	 * This method retrieves the count of timesheets for a tenant, filtered by the provided query options.
	 *
	 * @param options - The query parameters for filtering timesheets, such as tenant ID, date range, employee ID, etc.
	 * @returns Promise<number> - The count of timesheets matching the provided filters.
	 * @throws HttpException - If an error occurs during query execution, it returns an HTTP 400 error with an error message.
	 */
	@ApiOperation({ summary: 'Get timesheet count' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Timesheet count successfully retrieved'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, check the response body for more details'
	})
	@Get('/count')
	@UseValidationPipe({ whitelist: true })
	async getTimesheetCount(@Query() options: TimesheetQueryDTO): Promise<number> {
		try {
			// Return the timesheet count directly
			return await this._timeSheetService.getTimeSheetCount(options);
		} catch (error) {
			// Handle errors and throw an appropriate error response
			throw new HttpException(`Error retrieving timesheet count: ${error.message}`, HttpStatus.BAD_REQUEST);
		}
	}

	/**
	 * UPDATE timesheet status
	 * This method updates the status of a timesheet based on the data provided in the DTO.
	 *
	 * @param entity - The DTO containing the updated status for the timesheet.
	 * @returns Promise<ITimesheet[]> - The updated list of timesheets after applying the status changes.
	 * @throws HttpException - If an error occurs during status update, it throws an HTTP 400 error.
	 */
	@ApiOperation({ summary: 'Update timesheet' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The timesheet has been successfully updated.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Put('/status')
	@UseValidationPipe({ whitelist: true })
	async updateTimesheetStatus(@Body() entity: UpdateTimesheetStatusDTO): Promise<ITimesheet[]> {
		return await this._commandBus.execute(new TimesheetUpdateStatusCommand(entity));
	}

	/**
	 * UPDATE timesheet submit status
	 * This method submits a timesheet by updating its submission status.
	 *
	 * @param entity - The DTO containing the submission details for the timesheet.
	 * @returns Promise<ITimesheet[]> - The updated list of timesheets after the submission.
	 * @throws HttpException - If an error occurs during submission, it throws an HTTP 400 error.
	 */
	@ApiOperation({ summary: 'Submit timesheet' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The timesheet has been successfully submit.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Put('/submit')
	@UseValidationPipe({ whitelist: true })
	async submitTimeSheet(@Body() entity: SubmitTimesheetStatusDTO): Promise<ITimesheet[]> {
		return await this._commandBus.execute(new TimesheetSubmitCommand(entity));
	}

	/**
	 * GET all timesheets in the same tenant
	 * This method retrieves all timesheets for the same tenant based on the provided query options.
	 *
	 * @param options - The query parameters for filtering timesheets, such as tenant ID, date range, employee ID, etc.
	 * @returns Promise<ITimesheet[]> - A list of timesheets matching the provided filters.
	 * @throws HttpException - If an error occurs during query execution, it throws an HTTP 400 error with an error message.
	 */
	@ApiOperation({ summary: 'Get timesheet' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Get timesheet'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Get()
	@UseValidationPipe({ whitelist: true })
	async get(@Query() options: TimesheetQueryDTO): Promise<ITimesheet[]> {
		try {
			return await this._timeSheetService.getTimeSheets(options);
		} catch (error) {
			// Handle errors and throw an appropriate error response
			throw new HttpException(`Error retrieving timesheets: ${error.message}`, HttpStatus.BAD_REQUEST);
		}
	}

	/**
	 * Find timesheet by ID
	 * This method retrieves a specific timesheet by its unique identifier.
	 *
	 * @param id - The UUID of the timesheet to retrieve.
	 * @returns Promise<ITimesheet> - The timesheet with the specified ID.
	 * @throws HttpException - If the timesheet with the specified ID is not found, it throws an HTTP 400 error.
	 */
	@ApiOperation({ summary: 'Find timesheet by id' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found timesheet by id'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Get('/:id')
	async findById(@Param('id', UUIDValidationPipe) id: ID): Promise<ITimesheet> {
		return await this._timeSheetService.findOneByIdString(id);
	}
}
