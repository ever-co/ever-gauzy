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
import { CustomTrackingSessionsQueryDTO, ProcessTrackingDataDTO } from './dto';
import { ProcessTrackingDataCommand, CustomTrackingBulkCreateCommand } from './commands';
import { TypeOrmTimeSlotRepository } from '../time-slot/repository/type-orm-time-slot.repository';
import { MikroOrmTimeSlotRepository } from '../time-slot/repository/mikro-orm-time-slot.repository';
import { TypeOrmTimeSlotSessionRepository } from '../time-slot-session/repository/type-orm-time-slot-session.repository';
import { MikroOrmTimeSlotSessionRepository } from '../time-slot-session/repository/mikro-orm-time-slot-session.repository';
import { parseFromDatabase } from '../../core/util/db-serialization-util';

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
	async submitTrackingData(input: ProcessTrackingDataDTO): Promise<{
		success: boolean;
		sessionId: string;
		timeSlotId: string;
		message: string;
		session: ITrackingSession | null;
	}> {
		const { startTime } = input;

		if (isNaN(new Date(startTime).getTime())) {
			throw new BadRequestException('Invalid start Time');
		}

		return await this.commandBus.execute(
			new ProcessTrackingDataCommand({
				...input,
				startTime: new Date(startTime)
			})
		);
	}

	/**
	 * Submit bulk custom tracking data
	 */
	async submitBulkTrackingData(input: ProcessTrackingDataDTO[]): Promise<{
		results: Array<{
			success: boolean;
			sessionId: string;
			timeSlotId: string;
			message: string;
			session: ITrackingSession | null;
			index: number;
			error?: string;
		}>;
		summary: {
			total: number;
			successful: number;
			failed: number;
		};
	}> {
		if (!input || !Array.isArray(input) || input.length === 0) {
			throw new BadRequestException('Invalid bulk input: array of tracking data is required');
		}

		// Execute bulk creation command
		const results = await this.commandBus.execute(new CustomTrackingBulkCreateCommand(input));

		// Calculate summary statistics
		const total = results.length;
		const successful = results.filter((r) => r.success).length;
		const failed = total - successful;

		return {
			results,
			summary: {
				total,
				successful,
				failed
			}
		};
	}

	/**
	 * Get custom tracking sessions with optional filtering and grouping
	 */
	async getTrackingSessions(query: CustomTrackingSessionsQueryDTO): Promise<{
		sessions: ITrackingSessionResponse[];
		summary: {
			totalSessions: number;
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
			throw new BadRequestException('Tenant and Organization contexts are required');
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

		const sessions = this.extractTrackingSessionsFromTimeSlotSessions(timeSlotSessions, query.includeDecodedData);

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
		const currentUser = RequestContext.currentUser();
		const organizationId = currentUser?.employee?.organizationId;

		if (!tenantId || !organizationId) {
			throw new BadRequestException('Tenant and organization contexts are required');
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

		const customActivity = parseFromDatabase<ICustomActivity>(timeSlot.customActivity);
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
	private extractTrackingSessionsFromTimeSlotSessions(
		timeSlotSessions: TimeSlotSession[],
		includeDecodedData: boolean = false
	): ITrackingSessionResponse[] {
		const sessions: ITrackingSessionResponse[] = [];

		for (const timeSlotSession of timeSlotSessions) {
			const timeSlot = timeSlotSession.timeSlot;
			if (!timeSlot) continue;

			const customActivity = parseFromDatabase<ICustomActivity>(timeSlot.customActivity);
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
		totalTimeSlots: number;
		dateRange: { start: Date; end: Date } | null;
	} {
		const allTimeSlotIds = new Set<string>();
		sessions.forEach((session) => {
			if (session.timeSlots) {
				session.timeSlots.forEach((ts) => allTimeSlotIds.add(ts.timeSlotId));
			}
		});
		let minStart: Date | null = null;
		let maxStart: Date | null = null;
		for (const s of sessions) {
			for (const ts of s.timeSlots || []) {
				const t = ts.timeSlot?.startedAt ? new Date(ts.timeSlot.startedAt) : null;
				if (!t || isNaN(t.getTime())) continue;
				minStart = !minStart || t < minStart ? t : minStart;
				maxStart = !maxStart || t > maxStart ? t : maxStart;
			}
		}
		return {
			totalSessions: new Set(sessions.map((s) => s.sessionId)).size,
			totalTimeSlots: allTimeSlotIds.size,
			dateRange: minStart && maxStart ? { start: minStart, end: maxStart } : null
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
			throw new BadRequestException('Tenant and Organization contexts are required');
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

		return this.extractTrackingSessionsFromTimeSlotSessions(timeSlotSessions, false);
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

		return this.extractTrackingSessionsFromTimeSlotSessions(timeSlotSessions, false);
	}
}
