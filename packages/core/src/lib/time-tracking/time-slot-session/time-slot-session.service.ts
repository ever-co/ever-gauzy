import { Injectable } from '@nestjs/common';
import { Between } from 'typeorm';
import { ID, ITimeSlotSession } from '@gauzy/contracts';
import { TimeSlotSession } from './time-slot-session.entity';
import { MikroOrmTimeSlotSessionRepository, TypeOrmTimeSlotSessionRepository } from './repository';
import { TenantAwareCrudService } from '../../core';

@Injectable()
export class TimeSlotSessionService extends TenantAwareCrudService<TimeSlotSession> {
	constructor(
		readonly typeOrmTimeSlotSessionRepository: TypeOrmTimeSlotSessionRepository,
		readonly mikroOrmTimeSlotSessionRepository: MikroOrmTimeSlotSessionRepository
	) {
		super(typeOrmTimeSlotSessionRepository, mikroOrmTimeSlotSessionRepository);
	}

	/**
	 * Create a new TimeSlotSession entry
	 */
	async createSession(
		sessionId: string,
		timeSlotId: ID,
		employeeId: ID,
		tenantId: ID,
		organizationId: ID,
		startTime?: Date,
		lastActivity?: Date
	): Promise<ITimeSlotSession> {
		const session = super.create({
			sessionId,
			timeSlotId,
			employeeId,
			tenantId,
			organizationId,
			startTime,
			lastActivity
		});

		return await super.save(session);
	}

	/**
	 * Update session activity time
	 */
	async updateSessionActivity(sessionId: string, timeSlotId: ID, lastActivity: Date): Promise<void> {
		await super.update({ sessionId, timeSlotId }, { lastActivity, updatedAt: new Date() });
	}

	/**
	 * Delete sessions for a specific TimeSlot
	 */
	async deleteSessionsByTimeSlot(timeSlotId: ID): Promise<void> {
		await super.delete({ timeSlotId });
	}

	/**
	 * Find sessions by TimeSlot ID
	 */
	async findSessionsByTimeSlotId(timeSlotId: ID, tenantId: ID, organizationId: ID): Promise<ITimeSlotSession[]> {
		return await super.find({
			where: {
				timeSlotId,
				tenantId,
				organizationId
			},
			relations: ['timeSlot', 'employee']
		});
	}

	/**
	 * Find sessions by Employee ID with optional date range filter
	 */
	async findSessionsByEmployeeId(
		employeeId: ID,
		tenantId: ID,
		organizationId: ID,
		startDate?: Date,
		endDate?: Date
	): Promise<ITimeSlotSession[]> {
		// Default to last 24 hours if no date range provided
		const defaultStartDate = startDate || new Date(Date.now() - 24 * 60 * 60 * 1000);
		const defaultEndDate = endDate || new Date();

		return await super.find({
			where: {
				employeeId,
				tenantId,
				organizationId,
				createdAt: Between(defaultStartDate, defaultEndDate)
			},
			relations: ['timeSlot', 'employee'],
			order: { createdAt: 'DESC' }
		});
	}

	/**
	 * Private helper to find TimeSlots by sessionId with optional date range
	 */
	private async findTimeSlotsBySessionIdWithRange(
		sessionId: string,
		tenantId: ID,
		organizationId: ID,
		startDate?: Date,
		endDate?: Date
	): Promise<ITimeSlotSession[]> {
		// Default to last 24 hours if no date range provided
		const defaultStartDate = startDate || new Date(Date.now() - 24 * 60 * 60 * 1000);
		const defaultEndDate = endDate || new Date();

		return await super.find({
			where: {
				sessionId,
				tenantId,
				organizationId,
				createdAt: Between(defaultStartDate, defaultEndDate)
			},
			relations: ['timeSlot', 'employee'],
			order: { createdAt: 'ASC' }
		});
	}

	/**
	 * Find TimeSlots by sessionId with time range filter for performance
	 */
	async findTimeSlotsBySessionId(sessionId: string, tenantId: ID, organizationId: ID): Promise<ITimeSlotSession[]> {
		return this.findTimeSlotsBySessionIdWithRange(sessionId, tenantId, organizationId);
	}

	/**
	 * Find TimeSlots by sessionId with custom date range
	 */
	async findTimeSlotsBySessionIdWithDateRange(
		sessionId: string,
		tenantId: ID,
		organizationId: ID,
		startDate?: Date,
		endDate?: Date
	): Promise<ITimeSlotSession[]> {
		return this.findTimeSlotsBySessionIdWithRange(sessionId, tenantId, organizationId, startDate, endDate);
	}

	/**
	 * Find active sessions (sessions with recent activity)
	 */
	async findActiveSessions(
		tenantId: ID,
		organizationId: ID,
		employeeId?: ID,
		activityThresholdMinutes: number = 30
	): Promise<ITimeSlotSession[]> {
		const thresholdDate = new Date(Date.now() - activityThresholdMinutes * 60 * 1000);

		const whereCondition: any = {
			tenantId,
			organizationId,
			lastActivity: Between(thresholdDate, new Date())
		};

		if (employeeId) {
			whereCondition.employeeId = employeeId;
		}

		return await super.find({
			where: whereCondition,
			relations: ['timeSlot', 'employee'],
			order: { lastActivity: 'DESC' }
		});
	}

	/**
	 * Count sessions by sessionId
	 */
	async countSessionsBySessionId(sessionId: string, tenantId: ID, organizationId: ID): Promise<number> {
		return await super.count({
			where: {
				sessionId,
				tenantId,
				organizationId
			}
		});
	}
}
