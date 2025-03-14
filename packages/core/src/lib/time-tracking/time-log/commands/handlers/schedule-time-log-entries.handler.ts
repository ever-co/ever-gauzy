import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { Brackets, SelectQueryBuilder, WhereExpressionBuilder } from 'typeorm';
import * as moment from 'moment';
import { isEmpty } from '@gauzy/common';
import { ID, ITimeLog, ITimeSlot } from '@gauzy/contracts';
import { prepareSQLQuery as p } from './../../../../database/database.helper';
import { TimeLog } from './../../time-log.entity';
import { ScheduleTimeLogEntriesCommand } from '../schedule-time-log-entries.command';
import { TypeOrmTimeLogRepository } from '../../repository/type-orm-time-log.repository';

@CommandHandler(ScheduleTimeLogEntriesCommand)
export class ScheduleTimeLogEntriesHandler implements ICommandHandler<ScheduleTimeLogEntriesCommand> {
	private readonly logger = new Logger(`GZY - ${ScheduleTimeLogEntriesHandler.name}`);
	constructor(readonly typeOrmTimeLogRepository: TypeOrmTimeLogRepository) { }

	/**
	 * Executes the scheduling of TimeLog entries based on the given command parameters.
	 * This function is responsible for identifying any pending time logs for a specific tenant, organization,
	 * and optionally an employee, and then processing each entry to ensure they are accurately tracked and updated.
	 *
	 * The function first retrieves all pending TimeLog entries that match the given criteria,
	 * then iterates through each of them to perform necessary adjustments such as stopping timers,
	 * updating durations, and correcting the 'stoppedAt' timestamps based on the employee's activities.
	 *
	 * @param command The command containing the details needed to identify the pending TimeLog entries,
	 *                including `tenantId`, `organizationId`, and optionally `employeeId`.
	 *
	 * @returns A Promise that resolves when all pending TimeLog entries have been processed and updated.
	 */
	public async execute(command: ScheduleTimeLogEntriesCommand): Promise<void> {
		const { tenantId, organizationId, employeeId } = command;

		// Retrieve all pending TimeLog entries based on the provided tenantId, organizationId, and employeeId (if available)
		const logs = await this.getPendingTimeLogs(tenantId, organizationId, employeeId);

		// Iterate through each pending time log entry to process and update them as necessary
		for await (const log of logs) {
			await this.processTimeLogEntry(log);
		}
	}

	/**
	 * Retrieve pending TimeLog entries based on the given criteria.
	 *
	 * @param tenantId
	 * @param organizationId
	 * @param employeeId
	 *
	 * @returns A list of pending time logs
	 */
	private async getPendingTimeLogs(tenantId: ID, organizationId: ID, employeeId?: ID): Promise<ITimeLog[]> {
		// Construct the query with find options
		const query = this.typeOrmTimeLogRepository.createQueryBuilder('time_log').setFindOptions({
			relations: { timeSlots: true }
		});

		// Define the main query structure
		query.where((qb: SelectQueryBuilder<TimeLog>) => {
			const andWhere = new Brackets((web: WhereExpressionBuilder) => {
				web.andWhere(p(`"${qb.alias}"."stoppedAt" IS NOT NULL`));
				web.andWhere(p(`"${qb.alias}"."isRunning" = :isRunning`), { isRunning: true });
			});

			const orWhere = new Brackets((web: WhereExpressionBuilder) => {
				web.andWhere(p(`"${qb.alias}"."stoppedAt" IS NULL`));
			});

			// Apply filtering based on employeeId and organizationId
			if (!!employeeId && !!organizationId) {
				qb.andWhere(
					new Brackets((web: WhereExpressionBuilder) => {
						web.andWhere(p(`"${qb.alias}"."employeeId" = :employeeId`), { employeeId });
						web.andWhere(p(`"${qb.alias}"."organizationId" = :organizationId`), { organizationId });
						web.andWhere(p(`"${qb.alias}"."tenantId" = :tenantId`), { tenantId });
					})
				);
			}

			qb.andWhere(
				new Brackets((web: WhereExpressionBuilder) => {
					web.andWhere(andWhere);
					web.orWhere(orWhere);
				})
			);
		});

		this.logger.verbose(
			`Schedule Time Log Query For ${employeeId ? 'Tenant Organization' : 'All'} Entries`,
			query.getQueryAndParameters()
		);

		return await query.getMany();
	}

	/**
	 * Process a single TimeLog entry, adjusting its duration and stopping it if necessary.
	 *
	 * @param timeLog The time log entry to process
	 */
	private async processTimeLogEntry(timeLog: ITimeLog): Promise<void> {
		const { timeSlots } = timeLog;

		// Handle cases where there are no time slots
		if (isEmpty(timeSlots)) {
			// Retrieve the last log's startedAt date
			const startedAt = moment.utc(timeLog.startedAt);

			// Example:
			// If timeLog.startedAt = "2024-09-24 20:00:00"
			// then startedAt will be "2024-09-24 20:00:00"

			// If the minutes difference is greater than 10, update the stoppedAt date
			// Example:
			// If the current time is "2024-09-24 20:15:00", the difference is 15 minutes, which is greater than 10

			const difference = moment.utc().diff(startedAt, 'minutes');
			this.logger.verbose(`This log was created more than ${difference} minutes ago at ${startedAt.toISOString()}`);

			if (difference > 10) {
				await this.updateStoppedAtUsingStartedAt(timeLog);
			}
		} else {
			// Handle cases where there are time slots
			await this.updateStoppedAtUsingTimeSlots(timeLog, timeSlots);
			// Example: If timeSlots = [{ startedAt: "2024-09-24 20:05:00", duration: 300 }]
		}

		// Stop the pending time log entry
		await this.stopTimeLog(timeLog);
	}

	/**
	 * Updates the stoppedAt field using the startedAt value for a time log.
	 *
	 * @param timeLog - The time log entry to update
	 */
	private async updateStoppedAtUsingStartedAt(timeLog: ITimeLog): Promise<void> {
		// Calculate the stoppedAt date by adding 10 seconds to the startedAt value
		const stoppedAt = moment.utc(timeLog.startedAt).add(10, 'seconds').toDate();

		// Example:
		// If timeLog.startedAt = "2024-09-24 21:00:00",
		// then stoppedAt will be calculated as "2024-09-24 21:00:10" (10 seconds later).

		// Update the stoppedAt field in the database
		await this.typeOrmTimeLogRepository.save({
			id: timeLog.id,
			stoppedAt
		});

		this.logger.verbose(`Schedule Time Log Entry Updated StoppedAt Using StartedAt ${timeLog.startedAt}`);
		// Example log output: "Schedule Time Log Entry Updated StoppedAt Using StartedAt 2024-09-24 21:00:00"
	}

	/**
	 * Update the stoppedAt field using the total duration from the time slots for a time log.
	 *
	 * @param timeLog The time log entry to update
	 * @param timeSlots The time slots associated with the time log
	 */
	private async updateStoppedAtUsingTimeSlots(timeLog: ITimeLog, timeSlots: ITimeSlot[]): Promise<void> {
		// Calculate the total duration in seconds from all time slots
		const totalDurationInSeconds = timeSlots.reduce<number>((sum, { duration }) => sum + duration, 0);

		// Example:
		// If timeSlots = [{ duration: 300 }, { duration: 600 }]
		// Then totalDurationInSeconds = 300 + 600 = 900 seconds (i.e., 15 minutes)

		// Calculate the stoppedAt date by adding the total duration to the startedAt date of the time log
		let stoppedAt = moment.utc(timeLog.startedAt).add(totalDurationInSeconds, 'seconds').toDate();

		// Example:
		// If timeLog.startedAt = "2024-09-24 10:00:00" and totalDurationInSeconds = 900,
		// then stoppedAt = "2024-09-24 10:15:00"

		// Retrieve the most recent time slot from the last log
		timeSlots.sort((a: ITimeSlot, b: ITimeSlot) =>
			moment(b.startedAt).diff(a.startedAt)
		)
		const lastTimeSlot: ITimeSlot | undefined = timeSlots[0];
		// Example:
		// If timeSlots = [{ startedAt: "2024-09-24 10:05:00" }, { startedAt: "2024-09-24 10:10:00" }]
		// The sorted result will be [{ startedAt: "2024-09-24 10:10:00" }, { startedAt: "2024-09-24 10:05:00" }]
		// Thus, lastTimeSlot = { startedAt: "2024-09-24 10:10:00" }

		// Check if the last time slot was created more than 10 minutes ago
		if (lastTimeSlot) {
			// Retrieve the last time slot's startedAt date
			const lastTimeSlotStartedAt = moment.utc(lastTimeSlot.startedAt);
			// Retrieve the last time slot's duration
			const duration = lastTimeSlot.duration;

			// Retrieve the request stopped moment
			const requestStoppedAt = moment.utc(stoppedAt);

			// Example:
			// If lastTimeSlot.startedAt = "2024-09-24 10:00:00" and duration = 300 (i.e., 5 minutes)
			// then lastTimeSlotStartedAt would be "2024-09-24 10:00:00"
			// and the stoppedAt time will be calculated as "2024-09-24 10:05:00".

			// Check if the last time slot was created more than 10 minutes ago
			if (requestStoppedAt.diff(lastTimeSlotStartedAt, 'minutes') > 10) {
				// Calculate the potential stoppedAt time using the total duration
				// Example: If the last time slot started at "2024-09-24 10:00:00" and ran for 300 seconds (5 minutes),
				// then the calculated stoppedAt time would be "2024-09-24 10:05:00".
				stoppedAt = lastTimeSlotStartedAt.add(duration, 'seconds').toDate();
			}
		}

		// Update the stoppedAt field in the database
		if (moment.utc().diff(stoppedAt, 'minutes') > 10) {
			// Example:
			// If the current time is "2024-09-24 21:30:00" and stoppedAt is "2024-09-24 21:15:00",
			// the difference would be 15 minutes, which is greater than 10.
			// In this case, the stoppedAt field will be updated in the database.

			// Calculate the potential stoppedAt time using the total duration
			await this.typeOrmTimeLogRepository.save({
				id: timeLog.id,
				stoppedAt
			});

			// Example log output: "Schedule Time Log Entry Updated StoppedAt Using StoppedAt 2024-09-24 21:15:00"
			this.logger.verbose(`Schedule Time Log Entry Updated StoppedAt Using StoppedAt ${stoppedAt.toISOString()}`);
		}
	}

	/**
	 * Update the stoppedAt field using the total duration from the time slots for a time log.
	 *
	 * @param timeLog The time log entry to update
	 * @param timeSlots The time slots associated with the time log
	 */
	private async updateStoppedAtUsingTimeSlots2(timeLog: ITimeLog, timeSlots: ITimeSlot[]): Promise<void> {
		// Get the stoppedAt date from the time log
		let stoppedAt = moment.utc(timeLog.stoppedAt).toDate();

		// Retrieve the most recent time slot from the last log
		timeSlots.sort((a: ITimeSlot, b: ITimeSlot) =>
			moment(b.startedAt).diff(a.startedAt)
		)
		const lastTimeSlot: ITimeSlot | undefined = timeSlots[0];

		// Example:
		// If timeSlots = [{ startedAt: "2024-09-24 10:05:00" }, { startedAt: "2024-09-24 10:10:00" }]
		// The sorted result will be [{ startedAt: "2024-09-24 10:10:00" }, { startedAt: "2024-09-24 10:05:00" }]
		// Thus, lastTimeSlot = { startedAt: "2024-09-24 10:10:00" }

		// Check if the last time slot was created more than 10 minutes ago
		if (lastTimeSlot) {
			const duration = lastTimeSlot.duration; // Retrieve the last time slot's duration
			const startedAt = moment.utc(lastTimeSlot.startedAt); // Retrieve the last time slot's startedAt date

			// Example:
			// If lastTimeSlot.startedAt = "2024-09-24 10:00:00" and duration = 300 (i.e., 5 minutes)
			// then startedAt would be "2024-09-24 10:00:00"
			// and the stoppedAt time will be calculated as "2024-09-24 10:05:00".

			// Calculate the potential stoppedAt time using the total duration
			const difference = moment.utc().diff(stoppedAt, 'minutes');
			this.logger.verbose(`Last time slot (${duration}) created ${difference} mins ago at ${startedAt.toISOString()}`);

			// Check if the last time slot was created more than 10 minutes ago
			if (difference > 10) {
				// Example: If the last time slot started at "2024-09-24 10:00:00" and ran for 300 seconds (5 minutes),
				// then the calculated stoppedAt time would be "2024-09-24 10:05:00".
				stoppedAt = startedAt.add(duration, 'seconds').toDate();

				// Update the stoppedAt field in the database
				await this.typeOrmTimeLogRepository.save({
					id: timeLog.id,
					stoppedAt
				});
			}
		}

		this.logger.verbose(`Time log entry stoppedAt updated to ${stoppedAt.toISOString()}`);
	}

	/**
	 * Marks the time log as not running (stopped) in the database.
	 *
	 * @param timeLog - The time log entry to stop
	 */
	private async stopTimeLog(log: ITimeLog): Promise<ITimeLog> {
		// Update the isRunning field to false in the database for the given time log
		return await this.typeOrmTimeLogRepository.save({
			id: log.id,
			isRunning: false
		});
	}
}
