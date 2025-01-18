import { ICommandHandler, CommandBus, CommandHandler } from '@nestjs/cqrs';
import * as moment from 'moment';
import { TimeLogType, TimeLogSourceEnum, ID, ITimeSlot, ITimesheet } from '@gauzy/contracts';
import { TimeSlotService } from '../../../time-slot/time-slot.service';
import { TimesheetFirstOrCreateCommand, TimesheetRecalculateCommand } from '../../../timesheet/commands';
import { UpdateEmployeeTotalWorkedHoursCommand } from '../../../../employee/commands';
import { RequestContext } from '../../../../core/context';
import { TimeLogService } from '../../time-log.service';
import { TimeLog } from '../../time-log.entity';
import { TimeLogCreateCommand } from '../time-log-create.command';
import { MikroOrmTimeLogRepository } from '../../repository/mikro-orm-time-log.repository';
import { TypeOrmTimeLogRepository } from '../../repository/type-orm-time-log.repository';

@CommandHandler(TimeLogCreateCommand)
export class TimeLogCreateHandler implements ICommandHandler<TimeLogCreateCommand> {
	constructor(
		readonly typeOrmTimeLogRepository: TypeOrmTimeLogRepository,
		readonly mikroOrmTimeLogRepository: MikroOrmTimeLogRepository,
		private readonly _commandBus: CommandBus,
		private readonly _timeSlotService: TimeSlotService,
		private readonly _timeLogService: TimeLogService
	) {}

	/**
	 * Handles the execution of the TimeLogCreateCommand
	 *
	 * @param command TimeLogCreateCommand
	 * @returns Promise<TimeLog>
	 */
	public async execute(command: TimeLogCreateCommand): Promise<TimeLog> {
		const { input } = command;
		const { startedAt, employeeId, organizationId, stoppedAt, timeSlots: inputTimeSlots } = input;

		// Retrieve the tenant ID from the current context or the provided one in the input
		const tenantId = RequestContext.currentTenantId() || input.tenantId;

		// Create timesheet if it doesn't exist
		const timesheet = await this._commandBus.execute(
			new TimesheetFirstOrCreateCommand(startedAt, employeeId, organizationId)
		);

		// Create time log entity
		const timeLog = this.createTimeLogEntity(input, tenantId, timesheet);

		// Generate blank time slots if stoppedAt is provided
		let generatedTimeSlots: ITimeSlot[] = stoppedAt ? this.generateBlankTimeSlots(input, tenantId) : [];

		// Merge input time slots with generated blank slots
		const mergeTimeSlots = this.mergeTimeSlots(
			generatedTimeSlots,
			inputTimeSlots,
			employeeId,
			organizationId,
			tenantId
		);

		// Bulk create time slots
		timeLog.timeSlots = await this._timeSlotService.bulkCreate(mergeTimeSlots, employeeId, organizationId);

		await this.typeOrmTimeLogRepository.save(timeLog);

		// Recalculate timesheet activity
		await this.recalculateTimesheet(timesheet);

		// Update total worked hours for the employee
		await this.updateEmployeeTotalWorkedHours(employeeId);

		// Return the newly created time log
		return await this._timeLogService.findOneByIdString(timeLog.id);
	}

	/**
	 * Creates a new TimeLog entity based on the provided input
	 *
	 * @param input Partial<TimeLog>
	 * @param tenantId ID
	 * @param timesheet ITimesheet
	 * @returns TimeLog
	 */
	private createTimeLogEntity(input: Partial<TimeLog>, tenantId: ID, timesheet: ITimesheet): TimeLog {
		const {
			startedAt,
			stoppedAt,
			employeeId,
			organizationId,
			projectId,
			taskId,
			organizationContactId,
			organizationTeamId,
			logType = TimeLogType.MANUAL,
			description = null,
			reason = null,
			isBillable = false,
			source = TimeLogSourceEnum.WEB_TIMER,
			version = null,
			isRunning = source === TimeLogSourceEnum.DESKTOP
		} = input;

		console.log('create new time log with', { input, tenantId, timesheet });

		return new TimeLog({
			startedAt: moment.utc(startedAt).toDate(),
			stoppedAt: stoppedAt ? moment.utc(stoppedAt).toDate() : undefined,
			timesheet,
			organizationId,
			tenantId,
			employeeId,
			projectId,
			taskId,
			organizationContactId,
			organizationTeamId,
			logType,
			description,
			reason,
			isBillable,
			source,
			version,
			isRunning
		});
	}

	/**
	 * Generates blank time slots between startedAt and stoppedAt
	 * @param input Partial<TimeLog>
	 * @param tenantId string
	 * @returns ITimeSlot[]
	 */
	private generateBlankTimeSlots(input: Partial<TimeLog>, tenantId: ID): ITimeSlot[] {
		const { startedAt, stoppedAt, employeeId, organizationId } = input;

		// Generate time slots between startedAt and stoppedAt
		return this._timeSlotService.generateTimeSlots(startedAt, stoppedAt).map((slot) => ({
			...slot,
			employeeId,
			organizationId,
			tenantId,
			keyboard: 0,
			mouse: 0,
			overall: 0
		}));
	}

	/**
	 * Merges input time slots with generated blank slots
	 * @param generatedSlots ITimeSlot[]
	 * @param inputSlots ITimeSlot[]
	 * @param employeeId ID
	 * @param organizationId ID
	 * @param tenantId ID
	 * @returns ITimeSlot[]
	 */
	private mergeTimeSlots(
		generatedSlots: ITimeSlot[],
		inputSlots: ITimeSlot[] = [],
		employeeId: ID,
		organizationId: ID,
		tenantId: ID
	): ITimeSlot[] {
		const standardizedInputSlots = inputSlots.map((slot) => ({
			...slot,
			employeeId,
			organizationId,
			tenantId
		}));

		return generatedSlots.map((blankSlot) => {
			const matchingSlot = standardizedInputSlots.find((slot) =>
				moment(slot.startedAt).isSame(blankSlot.startedAt)
			);
			return matchingSlot ? { ...matchingSlot } : blankSlot;
		});
	}

	/**
	 * Recalculates the timesheet activity
	 * @param timesheet ITimesheet
	 */
	private async recalculateTimesheet(timesheet: ITimesheet): Promise<void> {
		if (timesheet?.id) {
			await this._commandBus.execute(new TimesheetRecalculateCommand(timesheet.id));
		}
	}

	/**
	 * Updates total worked hours for the employee
	 *
	 * @param employeeId ID
	 */
	private async updateEmployeeTotalWorkedHours(employeeId: ID): Promise<void> {
		await this._commandBus.execute(new UpdateEmployeeTotalWorkedHoursCommand(employeeId));
	}
}
