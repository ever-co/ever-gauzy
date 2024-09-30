import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Brackets, In, SelectQueryBuilder, WhereExpressionBuilder } from 'typeorm';
import * as moment from 'moment';
import { omit } from 'underscore';
import * as chalk from 'chalk';
import { ID, ITimeSlot, PermissionsEnum, TimeLogSourceEnum, TimeLogType } from '@gauzy/contracts';
import { isEmpty } from '@gauzy/common';
import { RequestContext } from '../../../../core/context';
import { TimeLog } from './../../../../core/entities/internal';
import { TimeSlot } from './../../time-slot.entity';
import { CreateTimeSlotCommand } from '../create-time-slot.command';
import { BulkActivitiesSaveCommand } from '../../../activity/commands';
import { TimeSlotMergeCommand } from './../time-slot-merge.command';
import { prepareSQLQuery as p } from './../../../../database/database.helper';
import { TypeOrmTimeSlotRepository } from '../../repository/type-orm-time-slot.repository';
import { TypeOrmTimeLogRepository } from '../../../time-log/repository/type-orm-time-log.repository';
import { TypeOrmEmployeeRepository } from '../../../../employee/repository/type-orm-employee.repository';

@CommandHandler(CreateTimeSlotCommand)
export class CreateTimeSlotHandler implements ICommandHandler<CreateTimeSlotCommand> {
	private logging: boolean = false;

	constructor(
		private readonly typeOrmTimeSlotRepository: TypeOrmTimeSlotRepository,
		private readonly typeOrmTimeLogRepository: TypeOrmTimeLogRepository,
		private readonly typeOrmEmployeeRepository: TypeOrmEmployeeRepository,
		private readonly commandBus: CommandBus
	) {}

	/**
	 * Execute the command.
	 * @param command The command to execute.
	 */
	public async execute(command: CreateTimeSlotCommand): Promise<TimeSlot> {
		const { input } = command;
		let {
			organizationId,
			employeeId,
			projectId,
			activities = [],
			source = TimeLogSourceEnum.DESKTOP,
			logType = TimeLogType.TRACKED
		} = input;

		this.log(`Time Slot Request - Input: ${JSON.stringify(input)}`);

		// Retrieve the current tenant ID
		const tenantId = RequestContext.currentTenantId() || input.tenantId;
		const hasChangeEmployeePermission = RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE);

		// Check if the logged user does not have employee selection permission
		if (!hasChangeEmployeePermission || isEmpty(employeeId)) {
			// Assign current employeeId if not provided in the request payload
			employeeId = RequestContext.currentEmployeeId();
		}

		// Input.startedAt is a string, so convert it to a Date object
		input.startedAt = moment(input.startedAt).utc().set('millisecond', 0).toDate();

		// Define the minimum and maximum dates for the time slot
		const minDate = input.startedAt;
		const maxDate = input.startedAt;

		let timeSlot: ITimeSlot;
		try {
			timeSlot = await this.typeOrmTimeSlotRepository
				.createQueryBuilder('timeSlot')
				.leftJoinAndSelect('timeSlot.timeLogs', 'timeLogs')
				.where('timeSlot.tenantId = :tenantId', { tenantId })
				.andWhere('timeSlot.organizationId = :organizationId', { organizationId })
				.andWhere('timeSlot.employeeId = :employeeId', { employeeId })
				.andWhere('timeSlot.startedAt = :startedAt', { startedAt: input.startedAt })
				.getOneOrFail();
		} catch (error) {
			// Create a new TimeSlot instance if not found
			timeSlot = new TimeSlot({
				...omit(input, ['timeLogId']),
				tenantId,
				organizationId,
				employeeId,
				timeLogs: []
			});
		}

		try {
			const baseQuery = this.typeOrmTimeLogRepository
				.createQueryBuilder('timeLog')
				.where('timeLog.tenantId = :tenantId', { tenantId })
				.andWhere('timeLog.organizationId = :organizationId', { organizationId })
				.andWhere('timeLog.employeeId = :employeeId', { employeeId })
				.andWhere('timeLog.source = :source', { source })
				.andWhere('timeLog.logType = :logType', { logType })
				.andWhere('timeLog.stoppedAt IS NOT NULL')
				.orderBy('timeLog.createdAt', 'DESC');

			const timeLog = await baseQuery.getOneOrFail();
			timeSlot.timeLogs.push(timeLog);
		} catch (error) {
			if (input.timeLogId) {
				// Convert input.timeLogId to an array if it's not already
				const timeLogIds: ID[] = [].concat(input.timeLogId);

				// Reuse the base query and add the condition for timeLogIds
				const timeLogs = await this.typeOrmTimeLogRepository
					.createQueryBuilder('timeLog')
					.where('timeLog.tenantId = :tenantId', { tenantId })
					.andWhere('timeLog.organizationId = :organizationId', { organizationId })
					.andWhere('timeLog.source = :source', { source })
					.andWhere('timeLog.logType = :logType', { logType })
					.andWhere('timeLog.employeeId = :employeeId', { employeeId })
					.andWhere('timeLog.stoppedAt IS NOT NULL')
					.andWhere('timeLog.id IN (:...timeLogIds)', { timeLogIds })
					.getMany();

				timeSlot.timeLogs.push(...timeLogs);
			}
		}

		// Set stoppedAt to current time
		const stoppedAt = moment.utc().toDate();
		console.log('time log stoppedAt inside create-time-slot.handler at line 169', stoppedAt);

		// Map only running time logs to an array of IDs
		const ids: ID[] = timeSlot.timeLogs.filter((log) => log.isRunning).map((log) => log.id);
		console.log('ids inside create-time-slot.handler at line 173', ids);

		// Update the stoppedAt field for the running time logs
		await this.typeOrmTimeLogRepository.update({ id: In(ids) }, { stoppedAt });

		// Save bulk activities
		const bulkActivities = await this.commandBus.execute(
			new BulkActivitiesSaveCommand({
				organizationId,
				employeeId,
				projectId,
				activities
			})
		);
		timeSlot.activities = bulkActivities || [];

		await this.typeOrmTimeSlotRepository.save(timeSlot);

		// Merge timeSlots into 10 minutes slots
		let [slot] = await this.commandBus.execute(
			new TimeSlotMergeCommand(organizationId, employeeId, minDate, maxDate)
		);

		// Update the time slot if a merge occurred
		if (slot) {
			timeSlot = slot;
		}

		// Return the merged time slot
		return await this.typeOrmTimeSlotRepository.findOne({
			where: { id: timeSlot.id },
			relations: { timeLogs: true, screenshots: true }
		});
	}

	/**
	 * Private method for logging messages.
	 * @param message - The message to be logged.
	 */
	private log(message: string): void {
		if (this.logging) {
			console.log(chalk.green(`${moment().format('DD.MM.YYYY HH:mm:ss')}`));
			console.log(chalk.green(message));
			console.log(chalk.white('--------------------------------------------------------'));
			console.log(); // Add an empty line as a divider
		}
	}
}
