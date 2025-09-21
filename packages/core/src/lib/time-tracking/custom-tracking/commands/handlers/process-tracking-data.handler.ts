import { CommandHandler, ICommandHandler, CommandBus } from '@nestjs/cqrs';
import { BadRequestException, Logger } from '@nestjs/common';
import { Raw } from 'typeorm';
import { moment } from '../../../../core/moment-extend';
import { getStartEndIntervals } from '../../../time-slot/utils';
import { decode, Data } from 'clarity-decode';
import { RequestContext } from '../../../../core/context';
import { ICustomActivity, ITrackingSession, ITrackingPayload, ITimeSlot } from '@gauzy/contracts';
import { TimeSlot } from '../../../time-slot/time-slot.entity';
import { TimeSlotService } from '../../../time-slot/time-slot.service';
import { CreateTimeSlotCommand } from '../../../time-slot/commands';
import { ProcessTrackingDataCommand } from '../process-tracking-data.command';
import { TypeOrmTimeSlotRepository } from '../../../time-slot/repository/type-orm-time-slot.repository';
import { TypeOrmTimeSlotSessionRepository } from '../../../time-slot-session/repository/type-orm-time-slot-session.repository';
import { parseFromDatabase, stringifyForDatabase } from '../../../../core/util/db-serialization-util';

@CommandHandler(ProcessTrackingDataCommand)
export class ProcessTrackingDataHandler implements ICommandHandler<ProcessTrackingDataCommand> {
	private readonly logger = new Logger(ProcessTrackingDataHandler.name);

	constructor(
		private readonly typeOrmTimeSlotRepository: TypeOrmTimeSlotRepository,
		private readonly typeOrmTimeSlotSessionRepository: TypeOrmTimeSlotSessionRepository,
		private readonly timeSlotService: TimeSlotService,
		private readonly commandBus: CommandBus
	) {}

	async execute(command: ProcessTrackingDataCommand): Promise<{
		success: boolean;
		sessionId: string;
		timeSlotId: string;
		message: string;
		session: ITrackingSession | null;
	}> {
		const { input } = command;
		const { payload, startTime } = input;

		if (typeof payload !== 'string' || payload.trim().length === 0) {
			throw new BadRequestException('Payload must be a non-empty string');
		}

		try {
			const tenantId = RequestContext.currentTenantId() || input.tenantId;

			const currentUser = RequestContext.currentUser();
			const organizationId = input.organizationId || currentUser?.employee?.organizationId;

			if (!tenantId || !organizationId) {
				throw new BadRequestException('Tenant and Organization contexts are required');
			}

			let employeeId = input.employeeId;
			if (!employeeId) {
				const currentUser = RequestContext.currentUser();
				if (currentUser?.employee?.id) {
					employeeId = currentUser.employee.id;
				} else {
					const ctxEmpId = RequestContext.currentEmployeeId();
					if (ctxEmpId) employeeId = ctxEmpId;
				}
			}

			if (!employeeId) {
				throw new BadRequestException('Employee context is required for tracking data');
			}

			const { sessionId, timestampMs, decodedData } = await this.decodeTrackingPayload(payload);

			const trackingTime = startTime ? new Date(startTime) : new Date(timestampMs);

			const timeSlot = await this.findOrCreateTimeSlot(employeeId, organizationId, tenantId, trackingTime);

			const sessionData = await this.updateTimeSlotWithTrackingData(
				timeSlot,
				sessionId,
				payload,
				decodedData,
				trackingTime,
				employeeId,
				tenantId,
				organizationId
			);

			return {
				success: true,
				sessionId,
				timeSlotId: timeSlot.id,
				message: 'Tracking data processed successfully',
				session: sessionData
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
	): Promise<{ sessionId: string; timestampMs: number; decodedData: Data.DecodedPayload | null }> {
		try {
			const decodedData: Data.DecodedPayload = decode(payload);

			const sessionId = decodedData.envelope.sessionId;
			const ts = (decodedData as any).timestamp;
			const timestampMs = ts > 1e12 ? ts : ts * 1000;
			return { sessionId, timestampMs, decodedData };
		} catch (error) {
			return {
				sessionId: `fallback-session-${Date.now()}`,
				timestampMs: Date.now(),
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
		const { start, end } = getStartEndIntervals(
			moment.utc(trackingTime),
			moment.utc(trackingTime).add(10, 'minutes')
		);

		let timeSlot: ITimeSlot;
		try {
			const timeSlots = await this.timeSlotService.find({
				where: {
					employeeId,
					organizationId,
					tenantId,
					startedAt: Raw((alias) => `${alias} >= :start AND ${alias} < :end`, {
						start: moment(start).toDate(),
						end: moment(end).toDate()
					})
				}
			});

			if (timeSlots.length > 0) {
				timeSlot = timeSlots.reduce((closest, current) => {
					const target = moment.utc(trackingTime);
					const closestDiff = Math.abs(moment.utc(closest.startedAt).diff(target));
					const currentDiff = Math.abs(moment.utc(current.startedAt).diff(target));
					return currentDiff < closestDiff ? current : closest;
				});
			} else {
				throw new Error('No time slot found in interval');
			}
		} catch (error) {
			this.logger.warn(`TimeSlot not found, creating new one: ${error.message}`);
			timeSlot = await this.commandBus.execute(
				new CreateTimeSlotCommand({
					tenantId,
					organizationId,
					employeeId,
					duration: 0,
					keyboard: 0,
					mouse: 0,
					overall: 0,
					startedAt: moment.utc(start).toDate()
				})
			);
		}

		return timeSlot as TimeSlot;
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
		const defaultStartDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
		const defaultEndDate = new Date();

		const timeSlotSessions = await this.typeOrmTimeSlotSessionRepository
			.createQueryBuilder('tss')
			.leftJoinAndSelect('tss.timeSlot', 'timeSlot')
			.where('tss.sessionId = :sessionId', { sessionId })
			.andWhere('tss.employeeId = :employeeId', { employeeId })
			.andWhere('tss.organizationId = :organizationId', { organizationId })
			.andWhere('tss.tenantId = :tenantId', { tenantId })
			.andWhere('tss.createdAt BETWEEN :startDate AND :endDate', {
				startDate: defaultStartDate,
				endDate: defaultEndDate
			})
			.orderBy('tss.createdAt', 'ASC')
			.getMany();

		if (timeSlotSessions.length === 0) {
			return null;
		}

		let allPayloads: ITrackingPayload[] = [];
		let sessionInfo: Omit<ITrackingSession, 'payloads'> | null = null;

		for (const timeSlotSession of timeSlotSessions) {
			const timeSlot = timeSlotSession.timeSlot;
			const customActivity = parseFromDatabase(timeSlot.customActivity) as ICustomActivity;
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

				allPayloads = [...allPayloads, ...session.payloads];
			}
		}

		if (!sessionInfo) {
			return null;
		}

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
		timestamp: Date,
		employeeId: string,
		tenantId: string,
		organizationId: string
	): Promise<ITrackingSession | null> {
		const customActivity: ICustomActivity = {
			trackingSessions: []
		};

		if (timeSlot.customActivity) {
			const existingActivity = parseFromDatabase(timeSlot.customActivity) as ICustomActivity;
			if (existingActivity.trackingSessions && Array.isArray(existingActivity.trackingSessions)) {
				customActivity.trackingSessions = existingActivity.trackingSessions;
			}
		}

		let existingSession = customActivity.trackingSessions.find(
			(session: ITrackingSession) => session.sessionId === sessionId
		);

		const payload: ITrackingPayload = {
			timestamp: timestamp.toISOString(),
			encodedData: encodedPayload,
			decodedData: decodedData || undefined
		};

		if (existingSession) {
			existingSession.payloads.push(payload);
			existingSession.updatedAt = new Date().toISOString();
			existingSession.lastActivity = timestamp.toISOString();
		} else {
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

		await this.typeOrmTimeSlotRepository.update(timeSlot.id, {
			customActivity: stringifyForDatabase(customActivity)
		});

		await this.createOrUpdateTimeSlotSession(
			sessionId,
			timeSlot.id,
			employeeId,
			tenantId,
			organizationId,
			timestamp
		);

		return await this.getCompleteSessionData(sessionId, employeeId, organizationId, tenantId);
	}

	/**
	 * Create or update TimeSlotSession mapping entry
	 */
	private async createOrUpdateTimeSlotSession(
		sessionId: string,
		timeSlotId: string,
		employeeId: string,
		tenantId: string,
		organizationId: string,
		timestamp: Date
	): Promise<void> {
		const existingMapping = await this.typeOrmTimeSlotSessionRepository.findOne({
			where: {
				sessionId,
				timeSlotId,
				tenantId,
				organizationId
			}
		});

		if (!existingMapping) {
			const timeSlotSession = this.typeOrmTimeSlotSessionRepository.create({
				sessionId,
				timeSlotId,
				employeeId,
				tenantId,
				organizationId,
				startTime: timestamp,
				lastActivity: timestamp
			});

			await this.typeOrmTimeSlotSessionRepository.save(timeSlotSession);
		} else {
			await this.typeOrmTimeSlotSessionRepository.update(existingMapping.id, {
				lastActivity: timestamp
			});
		}
	}
}
