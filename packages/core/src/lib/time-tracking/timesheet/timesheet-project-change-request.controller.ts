import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ID, ITimesheetProjectChangeRequest, PermissionsEnum } from '@gauzy/contracts';
import { Permissions } from './../../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from './../../shared/guards';
import { UUIDValidationPipe, UseValidationPipe } from './../../shared/pipes';
import { RequestTimesheetProjectChangeDTO, ReviewTimesheetProjectChangeDTO } from './dto';
import { TimesheetProjectChangeRequestService } from './timesheet-project-change-request.service';

/**
 * Endpoints for the timesheet project change workflow (issue #9516).
 *
 * Raising a request needs nothing more than the time tracker permission every employee already
 * has — it changes no data on its own. Approving or rejecting one needs `CAN_APPROVE_TIMESHEET`,
 * the same permission that already gates approving a timesheet.
 */
@ApiTags('TimesheetProjectChangeRequest')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller('/timesheet-project-change-request')
export class TimesheetProjectChangeRequestController {
	constructor(private readonly timesheetProjectChangeRequestService: TimesheetProjectChangeRequestService) {}

	/**
	 * Employee asks for the time booked to one project in their timesheet to be moved to another.
	 *
	 * @param input the request payload
	 * @returns the created request, in `PENDING` state
	 */
	@ApiOperation({ summary: 'Request a project change for a timesheet' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The project change request has been created.' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input, check the response body for details' })
	@Permissions(PermissionsEnum.TIME_TRACKER)
	@Post()
	@HttpCode(HttpStatus.CREATED)
	@UseValidationPipe({ transform: true, whitelist: true })
	async requestProjectChange(
		@Body() input: RequestTimesheetProjectChangeDTO
	): Promise<ITimesheetProjectChangeRequest> {
		return this.timesheetProjectChangeRequestService.requestProjectChange(input);
	}

	/**
	 * Approve or reject a pending project change request.
	 *
	 * @param id the request to review
	 * @param input the new status and an optional review note
	 * @returns the reviewed request
	 */
	@ApiOperation({ summary: 'Approve or reject a project change request' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The project change request has been reviewed.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found' })
	@Permissions(PermissionsEnum.CAN_APPROVE_TIMESHEET)
	@Put('/:id/review')
	@HttpCode(HttpStatus.OK)
	@UseValidationPipe({ transform: true, whitelist: true })
	async review(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() input: ReviewTimesheetProjectChangeDTO
	): Promise<ITimesheetProjectChangeRequest> {
		return this.timesheetProjectChangeRequestService.review(id, input);
	}

	/**
	 * List the project change requests raised against a timesheet.
	 *
	 * @param timesheetId the timesheet to list requests for
	 * @param organizationId the organization the timesheet belongs to
	 * @returns the matching requests, newest first
	 */
	@ApiOperation({ summary: 'Get the project change requests of a timesheet' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Found project change requests' })
	@Permissions(PermissionsEnum.TIME_TRACKER, PermissionsEnum.CAN_APPROVE_TIMESHEET)
	@Get('/timesheet/:timesheetId')
	async findAllByTimesheet(
		@Param('timesheetId', UUIDValidationPipe) timesheetId: ID,
		@Query('organizationId', UUIDValidationPipe) organizationId: ID
	): Promise<ITimesheetProjectChangeRequest[]> {
		return this.timesheetProjectChangeRequestService.findAllByTimesheet(timesheetId, organizationId);
	}
}
