import { Controller, UseGuards, Put, HttpStatus, Body, Get, Query, Param, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CommandBus } from '@nestjs/cqrs';
import { ITimesheet, PermissionsEnum } from '@gauzy/contracts';
import { TimeSheetService } from './timesheet.service';
import { PermissionGuard, TenantPermissionGuard } from './../../shared/guards';
import { UUIDValidationPipe, UseValidationPipe } from './../../shared/pipes';
import { Permissions } from './../../shared/decorators';
import { SubmitTimesheetStatusDTO, TimesheetQueryDTO, UpdateTimesheetStatusDTO } from './dto/query';
import { TimesheetSubmitCommand, TimesheetUpdateStatusCommand } from './commands';

@ApiTags('TimeSheet')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.CAN_APPROVE_TIMESHEET)
@Controller()
export class TimeSheetController {
	constructor(private readonly commandBus: CommandBus, private readonly timeSheetService: TimeSheetService) {}

	/**
	 * GET timesheet counts in the same tenant
	 *
	 * @param options
	 * @returns
	 */
	@ApiOperation({ summary: 'Get timesheet Count' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Get timesheet Count'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Get('/count')
	@UseValidationPipe({ whitelist: true })
	async getTimesheetCount(@Query() options: TimesheetQueryDTO): Promise<number> {
		try {
			return await this.timeSheetService.getTimeSheetCount(options);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	/**
	 * UPDATE timesheet status
	 *
	 * @param entity
	 * @returns
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
		return await this.commandBus.execute(new TimesheetUpdateStatusCommand(entity));
	}

	/**
	 * UPDATE timesheet submit status
	 *
	 * @param entity
	 * @returns
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
		return await this.commandBus.execute(new TimesheetSubmitCommand(entity));
	}

	/**
	 * GET all timesheet in same tenant
	 *
	 * @param options
	 * @returns
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
			return await this.timeSheetService.getTimeSheets(options);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	/**
	 * Find timesheet by id
	 *
	 * @param id
	 * @returns
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
	async findById(@Param('id', UUIDValidationPipe) id: ITimesheet['id']): Promise<ITimesheet> {
		try {
			return await this.timeSheetService.findOneByIdString(id);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
