import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { moment } from '../../../../core/moment-extend';
import { decode, Data } from 'clarity-decode';
import { RequestContext } from '../../../../core/context';
import { TimeSlot } from '../../../time-slot/time-slot.entity';
import { ProcessTrackingDataCommand } from '../process-tracking-data.command';
import { prepareSQLQuery as p } from '../../../../database/database.helper';
import { ICustomActivity, ITrackingSession, ITrackingPayload } from '@gauzy/contracts';

@CommandHandler(ProcessTrackingDataCommand)
export class ProcessTrackingDataHandler implements ICommandHandler<ProcessTrackingDataCommand> {
	private readonly logger = new Logger(ProcessTrackingDataHandler.name);

	constructor(
		@InjectRepository(TimeSlot)
		private readonly timeSlotRepository: Repository<TimeSlot>
	) {}

	async execute(command: ProcessTrackingDataCommand): Promise<any> {
		const { input } = command;
		const { payload, startTime } = input;

		try {
			// Get context information
			const tenantId = RequestContext.currentTenantId() || input.tenantId;

			// Get organizationId from headers first, then fallback to user context
			const req = RequestContext.currentRequest();
			let organizationId = (req?.headers?.['organization-id'] as string) || input.organizationId;

			// Fallback to user's organization if not in headers
			if (!organizationId) {
				const currentUser = RequestContext.currentUser();
				organizationId = currentUser?.employee?.organizationId;
			}

			if (!organizationId) {
				this.logger.error('No organizationId found in headers, input, or user context');
			}

			// Get user context - could be employee or other user types
			let employeeId = input.employeeId;
			if (!employeeId) {
				// Try to get from current context
				const currentUser = RequestContext.currentUser();
				if (currentUser?.employee?.id) {
					employeeId = currentUser.employee.id;
				} else if (RequestContext.currentEmployeeId()) {
					employeeId = RequestContext.currentEmployeeId();
				}
			}

			if (!employeeId) {
				throw new BadRequestException('Employee context is required for tracking data');
			}

			if (!tenantId || !organizationId) {
				throw new BadRequestException('Tenant and Organization context is required');
			}

			// Decode the payload to extract session information
			const { sessionId, timestamp, decodedData } = await this.decodeTrackingPayload(payload);
			this.logger.debug('Session decoded', {
				sessionId,
				timestamp,
				hasDecodedData: !!decodedData
			});
			// Use provided startTime or extracted timestamp
			const trackingTime = startTime ? new Date(startTime) : new Date(timestamp);

			// Find or create appropriate TimeSlot
			const timeSlot = await this.findOrCreateTimeSlot(employeeId, organizationId, tenantId, trackingTime);

			// Update TimeSlot with tracking data (store both encoded and decoded data)
			await this.updateTimeSlotWithTrackingData(timeSlot, sessionId, payload, decodedData, trackingTime);

			// Return the complete session data across all TimeSlots with the same sessionId
			const allSessionData = await this.getCompleteSessionData(sessionId, employeeId, organizationId, tenantId);

			return {
				success: true,
				sessionId,
				timeSlotId: timeSlot.id,
				message: 'Tracking data processed successfully',
				session: allSessionData
			};
		} catch (error) {
			this.logger.error('Failed to process tracking data', error.stack);
			throw new BadRequestException(`Failed to process tracking data: ${error.message}`);
		}
	}

	/**
	 * Decode tracking payload to extract session information
	 */
	private async decodeTrackingPayload(
		payload: string
	): Promise<{ sessionId: string; timestamp: number; decodedData: Data.DecodedPayload | null }> {
		try {
			const decodedData: Data.DecodedPayload = decode(payload);

			// Extract session ID and timestamp from decoded data
			const sessionId = decodedData.envelope.sessionId;
			const timestamp = decodedData.timestamp;

			return { sessionId, timestamp, decodedData };
		} catch (error) {
			// Fallback if decoding fails
			return {
				sessionId: `fallback-session-${Date.now()}`,
				timestamp: Date.now(),
				decodedData: null
			};
		}
	}

	/**
	 * Find existing TimeSlot or create new one for the tracking time
	 */
	private async findOrCreateTimeSlot(
		employeeId: string,
		organizationId: string,
		tenantId: string,
		trackingTime: Date
	): Promise<TimeSlot> {
		// Calculate 10-minute slot boundary
		const slotStart = this.roundToNearestTenMinutes(moment(trackingTime)).toDate();

		let timeSlot: TimeSlot;
		try {
			// Try to find existing TimeSlot
			const query = this.timeSlotRepository.createQueryBuilder('time_slot');
			query.leftJoinAndSelect(`${query.alias}.timeLogs`, 'timeLogs');

			query.where(p(`"${query.alias}"."tenantId" = :tenantId`), { tenantId });
			query.andWhere(p(`"${query.alias}"."organizationId" = :organizationId`), { organizationId });
			query.andWhere(p(`"${query.alias}"."employeeId" = :employeeId`), { employeeId });
			query.andWhere(p(`"${query.alias}"."startedAt" = :startedAt`), { startedAt: slotStart });

			timeSlot = await query.getOne();
		} catch (error) {
			this.logger.warn(`Error finding TimeSlot: ${error.message}`);
			timeSlot = null;
		}

		// Create new TimeSlot if not found
		if (!timeSlot) {
			const entity = this.timeSlotRepository.create({
				employeeId,
				organizationId,
				tenantId,
				startedAt: slotStart,
				duration: 0,
				keyboard: 0,
				mouse: 0,
				overall: 0,
				customActivity: {}
			});
			timeSlot = await this.timeSlotRepository.save(entity as TimeSlot);
		}

		return timeSlot;
	}

	/**
	 * Round a moment date to the nearest 10 minutes
	 */
	private roundToNearestTenMinutes(date: moment.Moment): moment.Moment {
		const minutes = date.minutes();
		return date
			.minutes(minutes - (minutes % 10))
			.seconds(0)
			.milliseconds(0);
	}

	/**
	 * Get complete session data across all TimeSlots with the same sessionId
	 */
	private async getCompleteSessionData(
		sessionId: string,
		employeeId: string,
		organizationId: string,
		tenantId: string
	): Promise<ITrackingSession | null> {
		// Find all TimeSlots that contain this sessionId
		const timeSlots = await this.timeSlotRepository
			.createQueryBuilder('timeSlot')
			.where('timeSlot.employeeId = :employeeId', { employeeId })
			.andWhere('timeSlot.organizationId = :organizationId', { organizationId })
			.andWhere('timeSlot.tenantId = :tenantId', { tenantId })
			.andWhere('timeSlot.customActivity IS NOT NULL')
			.getMany();

		// Extract and merge all payloads for this sessionId
		let allPayloads: ITrackingPayload[] = [];
		let sessionInfo: Omit<ITrackingSession, 'payloads'> | null = null;

		for (const timeSlot of timeSlots) {
			const customActivity = timeSlot.customActivity as ICustomActivity;
			if (!customActivity?.trackingSessions) continue;

			const session = customActivity.trackingSessions.find((s: ITrackingSession) => s.sessionId === sessionId);
			if (session) {
				if (!sessionInfo) {
					sessionInfo = {
						sessionId: session.sessionId,
						startTime: session.startTime,
						lastActivity: session.lastActivity,
						createdAt: session.createdAt,
						updatedAt: session.updatedAt
					};
				}
				// Merge payloads from this TimeSlot
				allPayloads = [...allPayloads, ...session.payloads];
			}
		}

		if (!sessionInfo) {
			return null;
		}

		// Sort payloads by timestamp
		allPayloads.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

		return {
			...sessionInfo,
			payloads: allPayloads
		};
	}

	/**
	 * Update TimeSlot with tracking data (store both encoded and decoded data)
	 */
	private async updateTimeSlotWithTrackingData(
		timeSlot: TimeSlot,
		sessionId: string,
		encodedPayload: string,
		decodedData: Data.DecodedPayload | null,
		timestamp: Date
	): Promise<void> {
		// Initialize customActivity if it doesn't exist or ensure trackingSessions exists
		const customActivity: ICustomActivity = {
			trackingSessions: []
		};

		// If timeSlot already has customActivity, preserve existing trackingSessions
		if (timeSlot.customActivity) {
			const existingActivity = timeSlot.customActivity as ICustomActivity;
			if (existingActivity.trackingSessions && Array.isArray(existingActivity.trackingSessions)) {
				customActivity.trackingSessions = existingActivity.trackingSessions;
			}
		}

		// Find existing session or create new one
		let existingSession = customActivity.trackingSessions.find(
			(session: ITrackingSession) => session.sessionId === sessionId
		);

		const payload: ITrackingPayload = {
			timestamp: timestamp.toISOString(),
			encodedData: encodedPayload,
			decodedData: decodedData || undefined
		};

		if (existingSession) {
			// Update existing session
			existingSession.payloads.push(payload);
			existingSession.updatedAt = new Date().toISOString();
			existingSession.lastActivity = timestamp.toISOString();
		} else {
			// Create new session
			existingSession = {
				sessionId,
				startTime: timestamp.toISOString(),
				lastActivity: timestamp.toISOString(),
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
				payloads: [payload]
			};
			customActivity.trackingSessions.push(existingSession);
		}

		// Update TimeSlot
		await this.timeSlotRepository.update(timeSlot.id, {
			customActivity: customActivity as any
		});
	}
}
