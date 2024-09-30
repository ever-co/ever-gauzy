import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Brackets, SelectQueryBuilder, WhereExpressionBuilder } from 'typeorm';
import * as moment from 'moment';
import { omit } from 'underscore';
import * as chalk from 'chalk';
import { ITimeSlot, PermissionsEnum, TimeLogSourceEnum, TimeLogType } from '@gauzy/contracts';
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

@CommandHandler(CreateTimeSlotCommand)
export class CreateTimeSlotHandler implements ICommandHandler<CreateTimeSlotCommand> {
	private logging: boolean = true;

	constructor(
		readonly typeOrmTimeSlotRepository: TypeOrmTimeSlotRepository,
		readonly typeOrmTimeLogRepository: TypeOrmTimeLogRepository,
		private readonly commandBus: CommandBus
	) {}

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
			const query = this.typeOrmTimeSlotRepository.createQueryBuilder();
			query.leftJoinAndSelect(`${query.alias}.timeLogs`, 'timeLogs');
			query.where((qb: SelectQueryBuilder<TimeSlot>) => {
				qb.andWhere(p(`"${qb.alias}"."tenantId" = :tenantId`), { tenantId });
				qb.andWhere(p(`"${qb.alias}"."organizationId" = :organizationId`), { organizationId });
				qb.andWhere(p(`"${qb.alias}"."employeeId" = :employeeId`), { employeeId });
				qb.andWhere(p(`"${qb.alias}"."startedAt" = :startedAt`), { startedAt: input.startedAt });
			});
			timeSlot = await query.getOneOrFail();
		} catch (error) {
			if (!timeSlot) {
				timeSlot = new TimeSlot(omit(input, ['timeLogId']));
				timeSlot.tenantId = tenantId;
				timeSlot.organizationId = organizationId;
				timeSlot.employeeId = employeeId;
				timeSlot.timeLogs = [];
			}
		}

		try {
			/**
			 * Find TimeLog for TimeSlot Range
			 */
			const query = this.typeOrmTimeLogRepository.createQueryBuilder();
			query.andWhere(
				new Brackets((web: WhereExpressionBuilder) => {
					web.andWhere(p(`"${query.alias}"."tenantId" = :tenantId`), { tenantId });
					web.andWhere(p(`"${query.alias}"."organizationId" = :organizationId`), { organizationId });
					web.andWhere(p(`"${query.alias}"."employeeId" = :employeeId`), { employeeId });
					web.andWhere(p(`"${query.alias}"."source" = :source`), { source });
					web.andWhere(p(`"${query.alias}"."logType" = :logType`), { logType });
					web.andWhere(p(`"${query.alias}"."stoppedAt" IS NOT NULL`));
				})
			);
			query.addOrderBy(p(`"${query.alias}"."createdAt"`), 'DESC');
			const timeLog = await query.getOneOrFail();
			timeSlot.timeLogs.push(timeLog);
		} catch (error) {
			if (input.timeLogId) {
				let timeLogIds: string[] = Array.isArray(input.timeLogId) ? input.timeLogId : [input.timeLogId];
				/**
				 * Find TimeLog for TimeSlot Range
				 */
				const query = this.typeOrmTimeLogRepository.createQueryBuilder();
				query.where((qb: SelectQueryBuilder<TimeLog>) => {
					qb.andWhere(
						new Brackets((web: WhereExpressionBuilder) => {
							web.andWhere(p(`"${qb.alias}"."tenantId" = :tenantId`), { tenantId });
							web.andWhere(p(`"${qb.alias}"."organizationId" = :organizationId`), { organizationId });
							web.andWhere(p(`"${qb.alias}"."source" = :source`), { source });
							web.andWhere(p(`"${qb.alias}"."logType" = :logType`), { logType });
							web.andWhere(p(`"${qb.alias}"."employeeId" = :employeeId`), { employeeId });
							web.andWhere(p(`"${qb.alias}"."stoppedAt" IS NOT NULL`));
						})
					);
					qb.andWhere(p(`"${qb.alias}"."id" IN (:...timeLogIds)`), { timeLogIds });
				});
				const timeLogs = await query.getMany();
				timeSlot.timeLogs.push(...timeLogs);
			}
		}

		/**
		 * Update TimeLog Entry Every TimeSlot Request From Desktop Timer
		 */
		for await (const timeLog of timeSlot.timeLogs) {
			if (timeLog.isRunning) {
				await this.typeOrmTimeLogRepository.update(timeLog.id, {
					stoppedAt: moment.utc().toDate()
				});
			}
		}

		timeSlot.activities = await this.commandBus.execute(
			new BulkActivitiesSaveCommand({
				organizationId,
				employeeId,
				activities,
				projectId
			})
		);

		await this.typeOrmTimeSlotRepository.save(timeSlot);

		// Merge timeSlots into 10 minutes slots
		let [slot] = await this.commandBus.execute(
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
