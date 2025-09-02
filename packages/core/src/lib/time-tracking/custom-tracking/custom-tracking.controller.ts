import { Controller, Post, Get, Body, Param, Query, HttpStatus, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { TenantPermissionGuard, PermissionGuard } from '../../shared/guards';
import { PermissionsEnum } from '@gauzy/contracts';
import { Permissions } from '../../shared/decorators';
import { UseValidationPipe } from '../../shared/pipes';
import { CustomTrackingService } from './custom-tracking.service';
import { CustomTrackingDataDTO, CustomTrackingSessionsQueryDTO } from './dto';

@ApiTags('Custom Tracking')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.TIME_TRACKER, PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ALL_ORG_VIEW)
@Controller('/timesheet/custom-tracking')
export class CustomTrackingController {
	constructor(private readonly customTrackingService: CustomTrackingService) {}

	/**
	 * Submit custom tracking data
	 */
	@ApiOperation({
		summary: 'Submit custom tracking data',
		description: 'Submit encoded tracking data to be stored in the appropriate TimeSlot'
	})
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Custom tracking data submitted successfully'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid tracking data or no active TimeSlot found'
	})
	@Post('')
	@UseValidationPipe({ transform: true })
	async submitTrackingData(@Body() dto: CustomTrackingDataDTO) {
		return await this.customTrackingService.submitTrackingData(dto);
	}

	/**
	 * Get custom tracking sessions with filtering and grouping
	 */
	@ApiOperation({
		summary: 'Get custom tracking sessions',
		description: 'Retrieve custom tracking sessions with optional filtering by date range, employee, and project'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Custom tracking sessions retrieved successfully'
	})
	@Get('/sessions')
	@UseValidationPipe({ whitelist: true, transform: true })
	async getTrackingSessions(@Query() query: CustomTrackingSessionsQueryDTO) {
		return await this.customTrackingService.getTrackingSessions(query);
	}

	/**
	 * Get tracking data for a specific TimeSlot
	 */
	@ApiOperation({
		summary: 'Get TimeSlot tracking data',
		description: 'Retrieve custom tracking data for a specific TimeSlot'
	})
	@ApiParam({
		name: 'id',
		type: String,
		description: 'TimeSlot ID'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'TimeSlot tracking data retrieved successfully'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'TimeSlot not found'
	})
	@Get('/time-slot/:id')
	async getTimeSlotTrackingData(@Param('id', ParseUUIDPipe) timeSlotId: string) {
		return await this.customTrackingService.getTimeSlotTrackingData(timeSlotId);
	}
}
