import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { Brackets, SelectQueryBuilder, WhereExpressionBuilder } from 'typeorm';
import * as moment from 'moment';
import { isEmpty } from '@gauzy/common';
import { ID, ITimeLog } from '@gauzy/contracts';
import { prepareSQLQuery as p } from './../../../../database/database.helper';
import { TimeLog } from './../../time-log.entity';
import { ScheduleTimeLogEntriesCommand } from '../schedule-time-log-entries.command';
import { TypeOrmTimeLogRepository } from '../../repository/type-orm-time-log.repository';

@CommandHandler(ScheduleTimeLogEntriesCommand)
export class ScheduleTimeLogEntriesHandler implements ICommandHandler<ScheduleTimeLogEntriesCommand> {
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
		const timeLogs = await this.getPendingTimeLogs(
			tenantId,
			organizationId,
			employeeId
		);

		// Iterate through each pending time log entry to process and update them as necessary
		for await (const timeLog of timeLogs) {
			await this.processTimeLogEntry(timeLog);
		}
	}

	/**
	 * Retrieve pending TimeLog entries based on the given criteria.
	 *
	 * @param tenantId
	 * @param organizationId
	 * @param employeeId
	 * @returns A list of pending time logs
	 */
	private async getPendingTimeLogs(
		tenantId: ID,
		organizationId: ID,
		employeeId?: ID
	): Promise<ITimeLog[]> {
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

			qb.andWhere(new Brackets((web: WhereExpressionBuilder) => {
				web.andWhere(andWhere);
				web.orWhere(orWhere);
			}));
		});

		console.log(
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

		// Calculate the minutes difference since the time log started
		const minutes = moment().diff(moment.utc(timeLog.startedAt), 'minutes');

		// Handle cases where there are no time slots
		if (isEmpty(timeSlots)) {
			// If the minutes difference is greater than 10, update the stoppedAt date
			if (minutes > 10) {
				await this.updateStoppedAtUsingStartedAt(timeLog);
			}
		} else {
			// Handle cases where there are time slots
			await this.updateStoppedAtUsingTimeSlots(timeLog, timeSlots);
		}

		// Stop the pending time log entry
		await this.stopTimeLog(timeLog);
	}


	/**
	 * Update the stoppedAt field using the startedAt value for a time log.
	 *
	 * @param timeLog The time log entry to update
	 */
	private async updateStoppedAtUsingStartedAt(timeLog: ITimeLog): Promise<void> {
		// Calculate the stoppedAt date
		const stoppedAt = moment.utc(timeLog.startedAt).add(10, 'seconds').toDate();

		// Update the stoppedAt field in the database
		await this.typeOrmTimeLogRepository.save({
			id: timeLog.id,
			stoppedAt
		});
		console.log('Schedule Time Log Entry Updated StoppedAt Using StartedAt', timeLog.startedAt);
	}

	/**
	 * Update the stoppedAt field using the total duration from the time slots for a time log.
	 *
	 * @param timeLog The time log entry to update
	 * @param timeSlots The time slots associated with the time log
	 */
	private async updateStoppedAtUsingTimeSlots(timeLog: ITimeLog, timeSlots: any[]): Promise<void> {
		// Calculate the duration
		const duration = timeSlots.reduce<number>((sum, { duration }) => sum + duration, 0);

		// Calculate the stoppedAt date
		const stoppedAt = moment.utc(timeLog.startedAt).add(duration, 'seconds').toDate();

		// Calculate the minutes difference
		const minutes = moment.utc().diff(moment.utc(stoppedAt), 'minutes');

		// Update the stoppedAt field in the database
		if (minutes > 10) {
			await this.typeOrmTimeLogRepository.save({
				id: timeLog.id,
				stoppedAt
			});
			console.log('Schedule Time Log Entry Updated StoppedAt Using StoppedAt', stoppedAt);
		}
	}

	/**
	 * Mark the time log as not running (stopped) in the database.
	 *
	 * @param timeLog The time log entry to stop
	 */
	private async stopTimeLog(timeLog: ITimeLog): Promise<void> {
		await this.typeOrmTimeLogRepository.save({
			id: timeLog.id,
			isRunning: false
		});
	}
}
