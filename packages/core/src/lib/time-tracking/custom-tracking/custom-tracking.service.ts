import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CommandBus } from '@nestjs/cqrs';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { encode } from 'clarity-decode';
import {
	PermissionsEnum,
	ICustomActivity,
	ITrackingSession,
	ITrackingPayload,
	ITrackingSessionResponse
} from '@gauzy/contracts';
import { isNotEmpty } from '@gauzy/utils';
import { RequestContext } from '../../core/context';
import { TimeSlot } from '../time-slot/time-slot.entity';
import { CustomTrackingDataDTO, CustomTrackingSessionsQueryDTO } from './dto';
import { ProcessTrackingDataCommand } from './commands';
import { prepareSQLQuery as p } from '../../database/database.helper';
import { getDateRangeFormat } from '../../core/utils';
import { moment } from '../../core/moment-extend';

@Injectable()
export class CustomTrackingService {
	constructor(
		@InjectRepository(TimeSlot)
		private readonly timeSlotRepository: Repository<TimeSlot>,
		private readonly commandBus: CommandBus
	) {}

	/**
	 * Submit custom tracking data using command pattern
	 */
	async submitTrackingData(dto: CustomTrackingDataDTO): Promise<any> {
		const { trackingData, timestamp } = dto;

		// Use command bus to process tracking data
		return await this.commandBus.execute(
			new ProcessTrackingDataCommand({
				payload: trackingData,
				startTime: new Date(timestamp)
				// Context will be extracted in the handler
			})
		);
	}

	/**
	 * Get custom tracking sessions with optional filtering and grouping
	 */
	async getTrackingSessions(query: CustomTrackingSessionsQueryDTO): Promise<any> {
		const tenantId = RequestContext.currentTenantId();

		// Get organizationId from query parameters
		const { organizationId } = query;

		// Get employee IDs from query or context
		let employeeIds = query.employeeIds || [];
		if (employeeIds.length === 0) {
			const employeeId = RequestContext.currentEmployeeId();
			if (employeeId) {
				employeeIds = [employeeId];
			} else {
				const currentUser = RequestContext.currentUser();
				if (currentUser?.employee?.id) {
					employeeIds = [currentUser.employee.id];
				}
			}
		}

		if (!tenantId || !organizationId) {
			throw new BadRequestException('Tenant and Organization context is required');
		}

		// 1. Get TimeSlots with custom tracking data
		const timeSlots = await this.getTimeSlotsWithTracking(query, employeeIds, tenantId, organizationId);

		// 2. Extract tracking sessions with optional decoded data
		const sessions = await this.extractTrackingSessionsFromTimeSlots(timeSlots, query.includeDecodedData);

		// 3. Group by sessionId if requested
		let workSessions = [];
		if (query.groupBySession) {
			// Group by sessionId across multiple TimeSlots
			workSessions = this.groupSessionsBySessionId(sessions);
		} else {
			// Return sessions directly without grouping
			workSessions = sessions;
		}

		return {
			sessions: workSessions,
			summary: this.calculateSessionsSummary(workSessions)
		};
	}

	/**
	 * Get tracking data for a specific TimeSlot
	 */
	async getTimeSlotTrackingData(timeSlotId: string): Promise<{
		timeSlotId: string;
		hasTrackingData: boolean;
		message?: string;
		timeSlot?: {
			startedAt: Date;
			duration: number;
			timeLogs: any[];
		};
		trackingSessions?: ITrackingSession[];
	}> {
		const tenantId = RequestContext.currentTenantId();

		// Get organizationId from headers first, then fallback to user context
		const req = RequestContext.currentRequest();
		let organizationId = req?.headers?.['organization-id'] as string;

		if (!organizationId) {
			const currentUser = RequestContext.currentUser();
			organizationId = currentUser?.employee?.organizationId;
		}

		if (!tenantId || !organizationId) {
			throw new BadRequestException('Tenant and Organization context is required');
		}

		const timeSlot = await this.timeSlotRepository.findOne({
			where: {
				id: timeSlotId,
				tenantId,
				organizationId
			},
			relations: ['timeLogs', 'timeLogs.employee', 'timeLogs.project']
		});

		if (!timeSlot) {
			throw new NotFoundException('TimeSlot not found');
		}

		const customActivity = timeSlot.customActivity as ICustomActivity;
		if (!customActivity?.trackingSessions) {
			return {
				timeSlotId,
				hasTrackingData: false,
				message: 'No custom tracking data found for this TimeSlot'
			};
		}

		// Return decoded data directly, no encoding needed
		return {
			timeSlotId,
			hasTrackingData: true,
			timeSlot: {
				startedAt: timeSlot.startedAt,
				duration: timeSlot.duration,
				timeLogs: timeSlot.timeLogs
			},
			trackingSessions: customActivity.trackingSessions
		};
	}

	/**
	 * Get TimeSlots with custom tracking data based on query filters
	 */
	private async getTimeSlotsWithTracking(
		query: CustomTrackingSessionsQueryDTO,
		employeeIds: string[],
		tenantId: string,
		organizationId: string
	): Promise<TimeSlot[]> {
		// Calculate start and end dates
		const { start, end } = getDateRangeFormat(
			moment.utc(query.startDate || moment().startOf('day')),
			moment.utc(query.endDate || moment().endOf('day'))
		);

		// Create a query builder for the TimeSlot entity
		const qb = this.timeSlotRepository.createQueryBuilder('time_slot');
		qb.leftJoin(
			`${qb.alias}.employee`,
			'employee',
			`"employee"."tenantId" = :tenantId AND "employee"."organizationId" = :organizationId`,
			{ tenantId, organizationId }
		);
		qb.leftJoinAndSelect(`${qb.alias}.timeLogs`, 'time_log');

		// Set find options for the query
		qb.setFindOptions({
			select: {
				organization: {
					id: true,
					name: true
				},
				employee: {
					id: true,
					user: {
						id: true,
						firstName: true,
						lastName: true,
						imageUrl: true
					}
				}
			},
			relations: query.relations || []
		});

		// Add where conditions
		qb.where((subQb: SelectQueryBuilder<TimeSlot>) => {
			// Filter by time range if dates are provided
			if (query.startDate && query.endDate) {
				subQb.andWhere(p(`"${subQb.alias}"."startedAt" BETWEEN :startDate AND :endDate`), {
					startDate: start,
					endDate: end
				});
			}

			// Filter by employeeIds if provided
			if (isNotEmpty(employeeIds)) {
				subQb.andWhere(p(`"${subQb.alias}"."employeeId" IN (:...employeeIds)`), { employeeIds });
			}

			// Filter by projectIds if provided
			if (isNotEmpty(query.projectIds)) {
				subQb.andWhere(p(`"time_log"."projectId" IN (:...projectIds)`), { projectIds: query.projectIds });
			}

			// Filter by tenantId and organizationId
			subQb.andWhere(
				`"${subQb.alias}"."tenantId" = :tenantId AND "${subQb.alias}"."organizationId" = :organizationId`,
				{ tenantId, organizationId }
			);

			// Filter by customActivity containing trackingSessions
			subQb.andWhere(`"${subQb.alias}"."customActivity" IS NOT NULL`);

			// Sort by createdAt
			subQb.addOrderBy(`"${subQb.alias}"."createdAt"`, 'ASC');
		});

		return await qb.getMany();
	}

	/**
	 * Extract and decode tracking sessions from TimeSlots
	 */
	private async extractTrackingSessionsFromTimeSlots(
		timeSlots: TimeSlot[],
		includeDecodedData: boolean = false
	): Promise<ITrackingSessionResponse[]> {
		const sessions: ITrackingSessionResponse[] = [];

		for (const timeSlot of timeSlots) {
			const customActivity = timeSlot.customActivity as ICustomActivity;

			if (!customActivity?.trackingSessions) {
				continue;
			}

			for (const session of customActivity.trackingSessions) {
				// Process payloads based on includeDecodedData flag
				const processedPayloads = session.payloads.map((payload: ITrackingPayload) => {
					if (includeDecodedData) {
						// Return both encoded and decoded data
						return {
							timestamp: payload.timestamp,
							encodedData: payload.encodedData,
							decodedData: payload.decodedData
						};
					} else {
						// Return only encoded data (default behavior)
						return {
							timestamp: payload.timestamp,
							encodedData: payload.encodedData
						};
					}
				});

				const sessionData: ITrackingSessionResponse = {
					sessionId: session.sessionId,
					timeSlotId: timeSlot.id,
					timeSlot: {
						startedAt: timeSlot.startedAt,
						duration: timeSlot.duration
					},
					timeLogs: timeSlot.timeLogs || [],
					session: {
						sessionId: session.sessionId,
						startTime: session.startTime,
						lastActivity: session.lastActivity,
						createdAt: session.createdAt,
						updatedAt: session.updatedAt,
						payloads: processedPayloads
					}
				};

				sessions.push(sessionData);
			}
		}

		return sessions;
	}

	/**
	 * Group tracking sessions by sessionId across multiple TimeSlots
	 */
	private groupSessionsBySessionId(sessions: ITrackingSessionResponse[]): ITrackingSessionResponse[] {
		const sessionMap = new Map<string, ITrackingSessionResponse>();

		sessions.forEach((session) => {
			const sessionId = session.sessionId;

			if (sessionMap.has(sessionId)) {
				// Merge payloads from different TimeSlots
				const existingSession = sessionMap.get(sessionId)!;
				existingSession.session.payloads = [...existingSession.session.payloads, ...session.session.payloads];
				// Update timeSlots array
				if (!existingSession.timeSlots) {
					existingSession.timeSlots = [];
				}
				existingSession.timeSlots.push({
					timeSlotId: session.timeSlotId,
					timeSlot: session.timeSlot
				});
			} else {
				// First occurrence of this sessionId
				sessionMap.set(sessionId, {
					...session,
					timeSlots: [
						{
							timeSlotId: session.timeSlotId,
							timeSlot: session.timeSlot
						}
					]
				});
			}
		});

		return Array.from(sessionMap.values());
	}

	/**
	 * Calculate summary statistics for sessions
	 */
	private calculateSessionsSummary(sessions: ITrackingSessionResponse[]): {
		totalSessions: number;
		totalTimeSlots: number;
		dateRange: { start: Date; end: Date } | null;
	} {
		return {
			totalSessions: sessions.length,
			totalTimeSlots: sessions.length,
			dateRange:
				sessions.length > 0
					? {
							start: sessions[0]?.timeSlot?.startedAt,
							end: sessions[sessions.length - 1]?.timeSlot?.startedAt
					  }
					: null
		};
	}
}
