import {
	Controller,
	Post,
	Get,
	Body,
	Param,
	Query,
	HttpStatus,
	UseGuards,
	DefaultValuePipe,
	ParseIntPipe,
	ValidationPipe
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { TenantPermissionGuard, PermissionGuard } from '../../shared/guards';
import { PermissionsEnum, ITrackingSession, ITimeLog, ITrackingSessionResponse } from '@gauzy/contracts';
import { Permissions } from '../../shared/decorators';
import { UUIDValidationPipe, UseValidationPipe, BulkBodyLoadTransformPipe } from '../../shared/pipes';
import { CustomTrackingService } from './custom-tracking.service';
import {
	CustomTrackingSessionsQueryDTO,
	CustomTrackingBulkInputDTO,
	ProcessTrackingDataDTO,
	BulkProcessResult
} from './dto';

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
	async submitTrackingData(@Body() input: ProcessTrackingDataDTO): Promise<{
		success: boolean;
		sessionId: string;
		timeSlotId: string;
		message: string;
		session: ITrackingSession | null;
	}> {
		return await this.customTrackingService.submitTrackingData(input);
	}

	/**
	 * Submit bulk custom tracking data
	 */
	@ApiOperation({
		summary: 'Submit bulk custom tracking data',
		description: 'Submit multiple encoded tracking data entries to be processed in bulk'
	})
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Bulk custom tracking data submitted successfully'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid bulk tracking data'
	})
	@Post('/bulk')
	async submitBulkTrackingData(
		@Body(
			BulkBodyLoadTransformPipe,
			new ValidationPipe({
				transform: true,
				whitelist: true,
				forbidNonWhitelisted: true,
				forbidUnknownValues: true
			})
		)
		input: CustomTrackingBulkInputDTO
	): Promise<{
		results: BulkProcessResult[];
		summary: {
			total: number;
			successful: number;
			failed: number;
		};
	}> {
		return await this.customTrackingService.submitBulkTrackingData(input.list);
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
	async getTrackingSessions(@Query() query: CustomTrackingSessionsQueryDTO): Promise<{
		sessions: ITrackingSessionResponse[];
		summary: {
			totalSessions: number;
			totalTimeSlots: number;
			dateRange: { start: Date; end: Date } | null;
		};
	}> {
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
	async getTimeSlotTrackingData(@Param('id', UUIDValidationPipe) timeSlotId: string): Promise<{
		timeSlotId: string;
		hasTrackingData: boolean;
		message?: string;
		timeSlot?: {
			startedAt: Date;
			duration: number;
			timeLogs: ITimeLog[];
		};
		trackingSessions?: ITrackingSession[];
	}> {
		return await this.customTrackingService.getTimeSlotTrackingData(timeSlotId);
	}

	/**
	 * Get tracking sessions by sessionId with efficient lookup
	 */
	@ApiOperation({
		summary: 'Get tracking sessions by sessionId',
		description: 'Retrieve tracking sessions for a specific sessionId'
	})
	@ApiParam({
		name: 'sessionId',
		type: String,
		description: 'Session ID to search for'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Tracking sessions retrieved successfully'
	})
	@Get('/session/:sessionId')
	async getSessionsBySessionId(
		@Param('sessionId') sessionId: string,
		@Query('startDate') startDate?: string,
		@Query('endDate') endDate?: string
	): Promise<ITrackingSessionResponse[]> {
		const start = startDate ? new Date(startDate) : undefined;
		const end = endDate ? new Date(endDate) : undefined;
		return await this.customTrackingService.getSessionsBySessionId(sessionId, undefined, undefined, start, end);
	}

	/**
	 * Get active tracking sessions
	 */
	@ApiOperation({
		summary: 'Get active tracking sessions',
		description: 'Retrieve currently active tracking sessions with recent activity'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Active tracking sessions retrieved successfully'
	})
	@Get('/active')
	async getActiveSessions(
		@Query('employeeId', UUIDValidationPipe) employeeId?: string,
		@Query('activityThresholdMinutes', new DefaultValuePipe(30), ParseIntPipe) activityThresholdMinutes?: number
	): Promise<any[]> {
		return await this.customTrackingService.getActiveSessions(employeeId, Math.max(1, activityThresholdMinutes!));
	}
}
