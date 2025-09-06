import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Between } from 'typeorm';
import {
	ICustomActivity,
	ITrackingSession,
	ITrackingPayload,
	ITrackingSessionResponse,
	ITimeLog
} from '@gauzy/contracts';
import { isNotEmpty } from '@gauzy/utils';
import { RequestContext } from '../../core/context';
import { TenantAwareCrudService } from '../../core/crud';
import { getDateRangeFormat } from '../../core/utils';
import { moment } from '../../core/moment-extend';
import { prepareSQLQuery as p } from '../../database/database.helper';
import { TimeSlot } from '../time-slot/time-slot.entity';
import { TimeSlotSession } from '../time-slot-session/time-slot-session.entity';
import { CustomTrackingDataDTO, CustomTrackingSessionsQueryDTO } from './dto';
import { ProcessTrackingDataCommand } from './commands';
import { TypeOrmTimeSlotRepository } from '../time-slot/repository/type-orm-time-slot.repository';
import { MikroOrmTimeSlotRepository } from '../time-slot/repository/mikro-orm-time-slot.repository';
import { TypeOrmTimeSlotSessionRepository } from '../time-slot-session/repository/type-orm-time-slot-session.repository';
import { MikroOrmTimeSlotSessionRepository } from '../time-slot-session/repository/mikro-orm-time-slot-session.repository';

@Injectable()
export class CustomTrackingService extends TenantAwareCrudService<TimeSlot> {
	constructor(
		readonly typeOrmTimeSlotRepository: TypeOrmTimeSlotRepository,
		readonly mikroOrmTimeSlotRepository: MikroOrmTimeSlotRepository,
		readonly typeOrmTimeSlotSessionRepository: TypeOrmTimeSlotSessionRepository,
		readonly mikroOrmTimeSlotSessionRepository: MikroOrmTimeSlotSessionRepository,
		private readonly commandBus: CommandBus
	) {
		super(typeOrmTimeSlotRepository, mikroOrmTimeSlotRepository);
	}

	/**
	 * Submit custom tracking data
	 */
	async submitTrackingData(dto: CustomTrackingDataDTO): Promise<{
		success: boolean;
		sessionId: string;
		timeSlotId: string;
		message: string;
		session: ITrackingSession | null;
	}> {
		const { trackingData, timestamp } = dto;
		const startTime = new Date(timestamp);
		if (isNaN(startTime.getTime())) {
			throw new BadRequestException('Invalid timestamp');
		}

		return await this.commandBus.execute(
			new ProcessTrackingDataCommand({
				payload: trackingData,
				startTime
			})
		);
	}

	/**
	 * Get custom tracking sessions with optional filtering and grouping
	 */
	async getTrackingSessions(query: CustomTrackingSessionsQueryDTO): Promise<{
		sessions: ITrackingSessionResponse[];
		summary: {
			totalSessions: number;
			uniqueSessionIds: number;
			totalTimeSlots: number;
			dateRange: { start: Date; end: Date } | null;
		};
	}> {
		const tenantId = RequestContext.currentTenantId();
		const { organizationId } = query;

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

		const { start, end } = this.getDateRangeWithDefaults(query);

		const timeSlotSessions = await this.getTimeSlotSessionsWithFilters(
			query,
			employeeIds,
			tenantId,
			organizationId,
			start,
			end
		);

		const sessions = await this.extractTrackingSessionsFromTimeSlotSessions(
			timeSlotSessions,
			query.includeDecodedData
		);

		let workSessions = [];
		if (query.groupBySession) {
			workSessions = this.groupSessionsBySessionId(sessions);
		} else {
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
			timeLogs: ITimeLog[];
		};
		trackingSessions?: ITrackingSession[];
	}> {
		const tenantId = RequestContext.currentTenantId();

		const req = RequestContext.currentRequest();
		let organizationId = req?.headers?.['organization-id'] as string;

		if (!organizationId) {
			const currentUser = RequestContext.currentUser();
			organizationId = currentUser?.employee?.organizationId;
		}

		if (!tenantId || !organizationId) {
			throw new BadRequestException('Tenant and Organization context is required');
		}

		const timeSlot = await this.typeOrmTimeSlotRepository.findOne({
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
	 * Get date range with defaults to prevent loading millions of records
	 * Default to last 48 hours if no dates provided
	 */
	private getDateRangeWithDefaults(query: CustomTrackingSessionsQueryDTO): { start: Date; end: Date } {
		const { start, end } = getDateRangeFormat(
			moment.utc(query.startDate || moment().subtract(48, 'hours')),
			moment.utc(query.endDate || moment())
		);

		return {
			start: start as Date,
			end: end as Date
		};
	}

	/**
	 * Get TimeSlotSessions
	 */
	private async getTimeSlotSessionsWithFilters(
		query: CustomTrackingSessionsQueryDTO,
		employeeIds: string[],
		tenantId: string,
		organizationId: string,
		startDate: Date,
		endDate: Date
	): Promise<TimeSlotSession[]> {
		const qb = this.typeOrmTimeSlotSessionRepository.createQueryBuilder('tss');

		qb.leftJoinAndSelect('tss.timeSlot', 'timeSlot');
		qb.leftJoinAndSelect('timeSlot.timeLogs', 'timeLogs');

		qb.where(p(`"${qb.alias}"."tenantId" = :tenantId`), { tenantId });
		qb.andWhere(p(`"${qb.alias}"."organizationId" = :organizationId`), { organizationId });

		qb.andWhere(p(`"${qb.alias}"."createdAt" BETWEEN :startDate AND :endDate`), { startDate, endDate });

		if (isNotEmpty(employeeIds)) {
			qb.andWhere(p(`"${qb.alias}"."employeeId" IN (:...employeeIds)`), { employeeIds });
		}

		if (query.sessionId) {
			qb.andWhere(p(`"${qb.alias}"."sessionId" = :sessionId`), { sessionId: query.sessionId });
		}

		if (isNotEmpty(query.projectIds)) {
			qb.andWhere(p(`"timeLogs"."projectId" IN (:...projectIds)`), { projectIds: query.projectIds });
		}

		qb.andWhere(p(`"timeSlot"."customActivity" IS NOT NULL`));

		qb.addOrderBy(p(`"${qb.alias}"."createdAt"`), 'ASC');

		return await qb.getMany();
	}

	/**
	 * Extract tracking sessions from TimeSlotSessions
	 */
	private async extractTrackingSessionsFromTimeSlotSessions(
		timeSlotSessions: TimeSlotSession[],
		includeDecodedData: boolean = false
	): Promise<ITrackingSessionResponse[]> {
		const sessions: ITrackingSessionResponse[] = [];

		for (const timeSlotSession of timeSlotSessions) {
			const timeSlot = timeSlotSession.timeSlot;
			if (!timeSlot) continue;

			const customActivity = timeSlot.customActivity as ICustomActivity;
			if (!customActivity?.trackingSessions) continue;

			const session = customActivity.trackingSessions.find(
				(s: ITrackingSession) => s.sessionId === timeSlotSession.sessionId
			);

			if (!session) continue;

			const processedPayloads = session.payloads.map((payload: ITrackingPayload) => {
				if (includeDecodedData) {
					return {
						timestamp: payload.timestamp,
						encodedData: payload.encodedData,
						decodedData: payload.decodedData
					};
				} else {
					return {
						timestamp: payload.timestamp,
						encodedData: payload.encodedData
					};
				}
			});

			const sessionData: ITrackingSessionResponse = {
				sessionId: session.sessionId,
				timeLogs: timeSlot.timeLogs || [],
				session: {
					sessionId: session.sessionId,
					startTime: session.startTime,
					lastActivity: session.lastActivity,
					createdAt: session.createdAt,
					updatedAt: session.updatedAt,
					payloads: processedPayloads
				},
				timeSlots: [
					{
						timeSlotId: timeSlot.id,
						timeSlot: {
							startedAt: timeSlot.startedAt,
							duration: timeSlot.duration
						}
					}
				]
			};

			sessions.push(sessionData);
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
				const existingSession = sessionMap.get(sessionId)!;

				existingSession.session.payloads = [...existingSession.session.payloads, ...session.session.payloads];

				if (session.session.startTime < existingSession.session.startTime) {
					existingSession.session.startTime = session.session.startTime;
				}
				if (session.session.lastActivity > existingSession.session.lastActivity) {
					existingSession.session.lastActivity = session.session.lastActivity;
				}

				if (!existingSession.timeSlots) {
					existingSession.timeSlots = [];
				}

				const timeSlotToAdd = session.timeSlots?.[0] || {
					timeSlotId: session.timeSlotId!,
					timeSlot: session.timeSlot!
				};

				const timeSlotExists = existingSession.timeSlots.some(
					(ts) => ts.timeSlotId === timeSlotToAdd.timeSlotId
				);
				if (!timeSlotExists) {
					existingSession.timeSlots.push(timeSlotToAdd);
				}
			} else {
				const newSession: ITrackingSessionResponse = {
					sessionId: session.sessionId,
					timeLogs: session.timeLogs,
					session: session.session,
					timeSlots: session.timeSlots || [
						{
							timeSlotId: session.timeSlotId!,
							timeSlot: session.timeSlot!
						}
					]
				};
				sessionMap.set(sessionId, newSession);
			}
		});

		return Array.from(sessionMap.values());
	}

	/**
	 * Calculate summary statistics for sessions
	 */
	private calculateSessionsSummary(sessions: ITrackingSessionResponse[]): {
		totalSessions: number;
		uniqueSessionIds: number;
		totalTimeSlots: number;
		dateRange: { start: Date; end: Date } | null;
	} {
		const allTimeSlotIds = new Set<string>();
		sessions.forEach((session) => {
			if (session.timeSlots) {
				session.timeSlots.forEach((ts) => allTimeSlotIds.add(ts.timeSlotId));
			}
		});

		return {
			totalSessions: sessions.length,
			uniqueSessionIds: new Set(sessions.map((s) => s.sessionId)).size,
			totalTimeSlots: allTimeSlotIds.size,
			dateRange:
				sessions.length > 0 && sessions[0]?.timeSlots?.[0]
					? {
							start: sessions[0].timeSlots[0].timeSlot.startedAt,
							end:
								sessions[sessions.length - 1]?.timeSlots?.[0]?.timeSlot.startedAt ||
								sessions[0].timeSlots[0].timeSlot.startedAt
					  }
					: null
		};
	}

	/**
	 * Get tracking sessions by sessionId
	 */
	async getSessionsBySessionId(
		sessionId: string,
		tenantId?: string,
		organizationId?: string,
		startDate?: Date,
		endDate?: Date
	): Promise<ITrackingSessionResponse[]> {
		const contextTenantId = tenantId || RequestContext.currentTenantId();
		const contextOrgId = organizationId || RequestContext.currentUser()?.employee?.organizationId;

		if (!contextTenantId || !contextOrgId) {
			throw new BadRequestException('Tenant and Organization context is required');
		}

		const defaultStart = startDate || new Date(Date.now() - 24 * 60 * 60 * 1000);
		const defaultEnd = endDate || new Date();

		const timeSlotSessions = await this.typeOrmTimeSlotSessionRepository.find({
			where: {
				sessionId,
				tenantId: contextTenantId,
				organizationId: contextOrgId,
				createdAt: Between(defaultStart, defaultEnd)
			},
			relations: ['timeSlot', 'timeSlot.timeLogs'],
			order: { createdAt: 'ASC' }
		});

		return await this.extractTrackingSessionsFromTimeSlotSessions(timeSlotSessions, false);
	}

	/**
	 * Get active sessions for an employee
	 * Sessions with activity in the last N minutes
	 */
	async getActiveSessions(
		employeeId?: string,
		activityThresholdMinutes: number = 30,
		tenantId?: string,
		organizationId?: string
	): Promise<ITrackingSessionResponse[]> {
		const contextTenantId = tenantId || RequestContext.currentTenantId();
		const contextOrgId = organizationId || RequestContext.currentUser()?.employee?.organizationId;
		const contextEmployeeId = employeeId || RequestContext.currentEmployeeId();

		if (!contextTenantId || !contextOrgId) {
			throw new BadRequestException('Tenant and Organization context is required');
		}

		const thresholdDate = new Date(Date.now() - activityThresholdMinutes * 60 * 1000);

		const whereCondition: {
			tenantId: string;
			organizationId: string;
			lastActivity: any;
			employeeId?: string;
		} = {
			tenantId: contextTenantId,
			organizationId: contextOrgId,
			lastActivity: Between(thresholdDate, new Date())
		};

		if (contextEmployeeId) {
			whereCondition.employeeId = contextEmployeeId;
		}

		const timeSlotSessions = await this.typeOrmTimeSlotSessionRepository.find({
			where: whereCondition,
			relations: ['timeSlot', 'timeSlot.timeLogs'],
			order: { lastActivity: 'DESC' }
		});

		return await this.extractTrackingSessionsFromTimeSlotSessions(timeSlotSessions, false);
	}

	/**
	 * Get session statistics for reporting
	 */
	async getSessionStatistics(
		employeeId?: string,
		startDate?: Date,
		endDate?: Date,
		tenantId?: string,
		organizationId?: string
	): Promise<{
		totalSessions: number;
		uniqueSessions: number;
		totalTimeSlots: number;
		averageSessionDuration: number;
		sessionsByDay: { date: string; count: number }[];
	}> {
		const contextTenantId = tenantId || RequestContext.currentTenantId();
		const contextOrgId = organizationId || RequestContext.currentUser()?.employee?.organizationId;
		const contextEmployeeId = employeeId || RequestContext.currentEmployeeId();

		if (!contextTenantId || !contextOrgId) {
			throw new BadRequestException('Tenant and Organization context is required');
		}

		const defaultStart = startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
		const defaultEnd = endDate || new Date();

		const whereCondition: {
			tenantId: string;
			organizationId: string;
			createdAt: any;
			employeeId?: string;
		} = {
			tenantId: contextTenantId,
			organizationId: contextOrgId,
			createdAt: Between(defaultStart, defaultEnd)
		};

		if (contextEmployeeId) {
			whereCondition.employeeId = contextEmployeeId;
		}

		const timeSlotSessions = await this.typeOrmTimeSlotSessionRepository.find({
			where: whereCondition,
			order: { createdAt: 'ASC' }
		});

		const uniqueSessionIds = new Set(timeSlotSessions.map((tss) => tss.sessionId));
		const sessionsByDay = this.groupSessionsByDay(timeSlotSessions);
		const averageDuration = this.calculateAverageSessionDuration(timeSlotSessions);

		return {
			totalSessions: timeSlotSessions.length,
			uniqueSessions: uniqueSessionIds.size,
			totalTimeSlots: new Set(timeSlotSessions.map((session) => session.timeSlotId)).size,
			averageSessionDuration: averageDuration,
			sessionsByDay
		};
	}

	/**
	 * Group sessions by day for statistics
	 */
	private groupSessionsByDay(timeSlotSessions: TimeSlotSession[]): { date: string; count: number }[] {
		const dayMap = new Map<string, number>();

		timeSlotSessions.forEach((tss) => {
			const date = moment(tss.createdAt).format('YYYY-MM-DD');
			dayMap.set(date, (dayMap.get(date) || 0) + 1);
		});

		return Array.from(dayMap.entries()).map(([date, count]) => ({ date, count }));
	}

	/**
	 * Calculate average session duration in minutes
	 */
	private calculateAverageSessionDuration(timeSlotSessions: TimeSlotSession[]): number {
		if (timeSlotSessions.length === 0) return 0;

		const sessionDurations = new Map<string, number>();

		timeSlotSessions.forEach((tss) => {
			if (tss.startTime && tss.lastActivity) {
				const duration = moment(tss.lastActivity).diff(moment(tss.startTime), 'minutes');
				sessionDurations.set(tss.sessionId, Math.max(sessionDurations.get(tss.sessionId) || 0, duration));
			}
		});

		const totalDuration = Array.from(sessionDurations.values()).reduce((sum, duration) => sum + duration, 0);
		return sessionDurations.size > 0 ? totalDuration / sessionDurations.size : 0;
	}
}
