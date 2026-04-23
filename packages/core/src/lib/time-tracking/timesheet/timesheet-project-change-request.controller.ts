import { Controller, Post, Put, Get, Body, Param, UseGuards, HttpStatus, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { IRequestTimesheetProjectChange, ITimesheetProjectChangeRequest, IUpdateTimesheetProjectChangeStatus, PermissionsEnum } from '@gauzy/contracts';
import { TimesheetProjectChangeRequestService } from './timesheet-project-change-request.service';
  import { PermissionGuard, TenantPermissionGuard } from './../../shared/guards';
    import { Permissions } from './../../shared/decorators';
    import { RequestContext } from './../../core/context';

    @ApiTags('Timesheet Project Change Request')
    @UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller('timesheet-project-change-request')
export class TimesheetProjectChangeRequestController {
	constructor(private readonly changeRequestService: TimesheetProjectChangeRequestService) {}

	/**
	 * Employee requests a project change for an existing timesheet.
    	 * POST /timesheet-project-change-request
    	 */
	@ApiOperation({ summary: 'Request a project change for a timesheet' })
    	@ApiResponse({ status: HttpStatus.CREATED, description: 'Project change request submitted successfully' })
    	@Post()
	@HttpCode(HttpStatus.CREATED)
	async requestProjectChange(
		@Body() input: IRequestTimesheetProjectChange
	): Promise<ITimesheetProjectChangeRequest> {
		const employee = RequestContext.currentEmployee();
		return this.changeRequestService.requestProjectChange(input, employee.id);
}

	/**
	 * Admin approves or rejects a project change request.
    	 * PUT /timesheet-project-change-request/:id/review
    	 */
	@ApiOperation({ summary: 'Review (approve or reject) a project change request' })
    	@ApiResponse({ status: HttpStatus.OK, description: 'Project change request reviewed successfully' })
    	@Permissions(PermissionsEnum.CAN_APPROVE_TIMESHEET)
    	@Put(':id/review')
    	async reviewProjectChangeRequest(
		@Param('id') changeRequestId: string,
    		@Body() input: Omit<IUpdateTimesheetProjectChangeStatus, 'changeRequestId'>
    	): Promise<ITimesheetProjectChangeRequest> {
    		const reviewer = RequestContext.currentUser();
    		return this.changeRequestService.reviewProjectChangeRequest(
          { ...input, changeRequestId },
          			reviewer.id
          		);
       }

	/**
	 * Get all project change requests for a specific timesheet.
    	 * GET /timesheet-project-change-request/timesheet/:timesheetId
    	 */
	@ApiOperation({ summary: 'Get project change requests for a timesheet' })
    	@ApiResponse({ status: HttpStatus.OK, description: 'List of project change requests' })
    	@Get('timesheet/:timesheetId')
    	async getByTimesheet(
		@Param('timesheetId') timesheetId: string
    	): Promise<ITimesheetProjectChangeRequest[]> {
        		return this.changeRequestService.getChangeRequestsByTimesheet(timesheetId);
       }
       }
