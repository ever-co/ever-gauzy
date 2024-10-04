import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { In } from 'typeorm';
import * as moment from 'moment';
import { omit } from 'underscore';
import * as chalk from 'chalk';
import { ID, ITimeLog, ITimeSlot, PermissionsEnum, TimeLogSourceEnum, TimeLogType } from '@gauzy/contracts';
import { isEmpty, isNotEmpty } from '@gauzy/common';
import { RequestContext } from '../../../../core/context';
import { CreateTimeSlotCommand } from '../create-time-slot.command';
import { BulkActivitiesSaveCommand } from '../../../activity/commands';
import { TimeSlotMergeCommand } from './../time-slot-merge.command';
import { TypeOrmEmployeeRepository } from '../../../../employee/repository';
import { TypeOrmTimeLogRepository } from '../../../time-log/repository/type-orm-time-log.repository';
import { TypeOrmTimeSlotRepository } from '../../repository/type-orm-time-slot.repository';
import { TimeSlot } from './../../time-slot.entity';

@CommandHandler(CreateTimeSlotCommand)
export class CreateTimeSlotHandler implements ICommandHandler<CreateTimeSlotCommand> {
	private logging: boolean = true;

	constructor(
		readonly typeOrmTimeSlotRepository: TypeOrmTimeSlotRepository,
		readonly typeOrmTimeLogRepository: TypeOrmTimeLogRepository,
		readonly typeOrmEmployeeRepository: TypeOrmEmployeeRepository,
		private readonly _commandBus: CommandBus
	) {}

	/**
	 * Executes the creation or retrieval of a time slot for the given command.
	 * It manages the retrieval of existing time slots, time logs, and activities,
	 * handles permissions, and ensures the time slot is created or updated appropriately.
	 * Also, it merges the time slot into a 10-minute interval if applicable.
	 *
	 * @param {CreateTimeSlotCommand} command - The command containing the input parameters for the time slot creation.
	 * @returns {Promise<TimeSlot>} - A promise that resolves to the created or updated TimeSlot instance.
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

		const tenantId = RequestContext.currentTenantId() || input.tenantId; // Retrieve the current tenant ID
		const user = RequestContext.currentUser(); // Retrieve the current user
		const hasChangeEmployeePermission = RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE);

		// Check if the logged user does not have employee selection permission
		if (!hasChangeEmployeePermission || (isEmpty(employeeId) && RequestContext.currentEmployeeId())) {
			// Assign current employeeId if not provided in the request payload
			employeeId = RequestContext.currentEmployeeId();
		}

		/*
		 * If organization not found in request then assign current logged user organization
		 */
		if (isEmpty(organizationId)) {
			let employee = await this.typeOrmEmployeeRepository.findOneBy({ id: employeeId });
			organizationId = employee ? employee.organizationId : null;
		}

		// Input.startedAt is a string, so convert it to a Date object
		input.startedAt = moment(input.startedAt).utc().set('millisecond', 0).toDate();

		// Define the minimum and maximum dates for the time slot
		const minDate = input.startedAt;
		const maxDate = input.startedAt;

		let timeSlot: ITimeSlot;
		try {
			// Find TimeLog for TimeSlot Range
			const baseQuery = this.typeOrmTimeSlotRepository
				.createQueryBuilder('time_slot')
				.leftJoinAndSelect('time_slot.timeLogs', 'timeLogs')
				.where('time_slot.tenantId = :tenantId', { tenantId })
				.andWhere('time_slot.organizationId = :organizationId', { organizationId })
				.andWhere('time_slot.employeeId = :employeeId', { employeeId })
				.andWhere('time_slot.startedAt = :startedAt', { startedAt: input.startedAt });

			// Get the last time slot
			timeSlot = await baseQuery.getOneOrFail();
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
			// Find TimeLog for TimeSlot Range
			const baseQuery = this.typeOrmTimeLogRepository
				.createQueryBuilder('time_log')
				.where('time_log.tenantId = :tenantId', { tenantId })
				.andWhere('time_log.organizationId = :organizationId', { organizationId })
				.andWhere('time_log.employeeId = :employeeId', { employeeId })
				.andWhere('time_log.source = :source', { source })
				.andWhere('time_log.logType = :logType', { logType })
				.andWhere('time_log.stoppedAt IS NOT NULL')
				.orderBy('time_log.createdAt', 'DESC');

			// Get the last time log
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

		// Map only running time logs to an array of IDs
		const ids: ID[] = timeSlot.timeLogs.filter((log: ITimeLog) => log.isRunning).map((log) => log.id);
		// Set stoppedAt to current time
		const stoppedAt = moment.utc().toDate();

		// Only update running timer
		if (isNotEmpty(ids)) {
			await this.typeOrmTimeLogRepository.update(
				{
					id: In(ids),
					isRunning: true
				},
				{ stoppedAt }
			);
		}

		this.log(`Bulk activities save parameters employee (${user.name}): ${JSON.stringify({ activities })}`);

		// Save bulk activities
		const bulkActivities = await this._commandBus.execute(
			new BulkActivitiesSaveCommand({
				organizationId,
				employeeId,
				activities,
				projectId
			})
		);

		// Update the time slot's activities
		timeSlot.activities = bulkActivities || [];

		// Save the time slot
		await this.typeOrmTimeSlotRepository.save(timeSlot);

		// Merge timeSlots into 10 minutes slots
		let [slot] = await this._commandBus.execute(
			new TimeSlotMergeCommand(organizationId, employeeId, minDate, maxDate)
		);
		if (slot) {
			timeSlot = slot;
		}

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
