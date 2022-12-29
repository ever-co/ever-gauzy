import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository, SelectQueryBuilder, WhereExpressionBuilder } from 'typeorm';
import * as moment from 'moment';
import { omit } from 'underscore';
import { ITimeSlot, PermissionsEnum, TimeLogSourceEnum, TimeLogType } from '@gauzy/contracts';
import { isEmpty, isNotEmpty } from '@gauzy/common';
import { RequestContext } from '../../../../core/context';
import {
	Employee,
	TimeLog
} from './../../../../core/entities/internal';
import { TimeSlot } from './../../time-slot.entity';
import { CreateTimeSlotCommand } from '../create-time-slot.command';
import { BulkActivitiesSaveCommand } from '../../../activity/commands';
import { TimeSlotMergeCommand } from './../time-slot-merge.command';

@CommandHandler(CreateTimeSlotCommand)
export class CreateTimeSlotHandler
	implements ICommandHandler<CreateTimeSlotCommand> {
	constructor(
		@InjectRepository(TimeSlot)
		private readonly timeSlotRepository: Repository<TimeSlot>,

		@InjectRepository(TimeLog)
		private readonly timeLogRepository: Repository<TimeLog>,

		@InjectRepository(Employee)
		private readonly employeeRepository: Repository<Employee>,

		private readonly commandBus: CommandBus
	) {}

	public async execute(command: CreateTimeSlotCommand): Promise<TimeSlot> {
		const { input } = command;
		let { organizationId, employeeId, activities = [] } = input;

		console.log('Time Slot Interval Request', {
			input
		});

		const user = RequestContext.currentUser();
		const tenantId = RequestContext.currentTenantId();

		/**
		 * Check logged user does not have employee selection permission
		 */
		if (!RequestContext.hasPermission(
			PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
		)) {
			try {
				let employee = await this.employeeRepository.findOneByOrFail({
					userId: user.id,
					tenantId
				});
				employeeId = employee.id;
				organizationId = employee.organizationId;
			} catch (error) {
				console.log(`Error while finding logged in employee (${user.name}) for create timeslot`, error);
			}
		} else {
			/*
			* If employeeId not send from desktop timer request payload
			*/
			if (isEmpty(employeeId) && RequestContext.currentEmployeeId()) {
				employeeId = RequestContext.currentEmployeeId();
			}
		}

		/*
		 * If organization not found in request then assign current logged user organization
		 */
		if (isEmpty(organizationId)) {
			let employee = await this.employeeRepository.findOneBy({
				id: employeeId
			});
			organizationId = employee ? employee.organizationId : null;
		}

		input.startedAt = moment(input.startedAt)
			.utc()
			.set('millisecond', 0)
			.toDate();

		const minDate = input.startedAt;
		const maxDate = input.startedAt;

		console.log({ organizationId, employeeId });
		let timeSlot: ITimeSlot;
		try {
			const query = this.timeSlotRepository.createQueryBuilder('time_slot');
			query.setFindOptions({
				relations: {
					timeLogs: true
				}
			});
			query.where((qb: SelectQueryBuilder<TimeSlot>) => {
				qb.andWhere(`"${qb.alias}"."tenantId" = :tenantId`, { tenantId });
				qb.andWhere(`"${qb.alias}"."organizationId" = :organizationId`, { organizationId });
				qb.andWhere(`"${qb.alias}"."employeeId" = :employeeId`, { employeeId });
				qb.andWhere(`"${qb.alias}"."startedAt" = :startedAt`, { startedAt: input.startedAt });
				console.log(`Get Time Slot Query & Parameters For employee (${user.name})`, qb.getQueryAndParameters());
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
		console.log({ timeSlot }, `Find Time Slot For Time: ${input.startedAt} for employee (${user.name})`);
		try {
			/**
			 * Find TimeLog for TimeSlot Range
			 */
			const query = this.timeLogRepository.createQueryBuilder('time_log');
			query.where((qb: SelectQueryBuilder<TimeLog>) => {
				console.log({ input });
				qb.andWhere(
					new Brackets((web: WhereExpressionBuilder) => {
						web.andWhere(`"${qb.alias}"."tenantId" = :tenantId`, { tenantId });
						web.andWhere(`"${qb.alias}"."organizationId" = :organizationId`, { organizationId });
						web.andWhere(`"${qb.alias}"."employeeId" = :employeeId`, { employeeId });
						web.andWhere(`"${qb.alias}"."source" = :source`, { source: TimeLogSourceEnum.DESKTOP });
						web.andWhere(`"${qb.alias}"."logType" = :logType`, { logType: TimeLogType.TRACKED });
						web.andWhere(`"${qb.alias}"."stoppedAt" IS NOT NULL`);
						web.andWhere(`"${qb.alias}"."deletedAt" IS NULL`);
					})
				);
				qb.addOrderBy(`"${qb.alias}"."createdAt"`, 'DESC');
			});
			const timeLog = await query.getOneOrFail();
			console.log(timeLog, `Found latest worked timelog for employee (${user.name})!`);
			timeSlot.timeLogs.push(timeLog);
		} catch (error) {
			if (input.timeLogId) {
				let timeLogIds = [];
				if (input.timeLogId instanceof Array) {
					timeLogIds = input.timeLogId;
				} else {
					timeLogIds.push(input.timeLogId);
				}

				/**
				 * Find TimeLog for TimeSlot Range
				 */
				const query = this.timeLogRepository.createQueryBuilder('time_log');
				query.where((qb: SelectQueryBuilder<TimeLog>) => {
					qb.andWhere(
						new Brackets((web: WhereExpressionBuilder) => {
							web.andWhere(`"${qb.alias}"."tenantId" = :tenantId`, { tenantId });
							web.andWhere(`"${qb.alias}"."organizationId" = :organizationId`, { organizationId });
							web.andWhere(`"${qb.alias}"."source" = :source`, { source: TimeLogSourceEnum.DESKTOP });
							web.andWhere(`"${qb.alias}"."logType" = :logType`, { logType: TimeLogType.TRACKED });
							web.andWhere(`"${qb.alias}"."employeeId" = :employeeId`, { employeeId });
							web.andWhere(`"${qb.alias}"."stoppedAt" IS NOT NULL`);
							web.andWhere(`"${qb.alias}"."deletedAt" IS NULL`);
						})
					);
					qb.andWhere(`"${qb.alias}"."id" IN (:...timeLogIds)`, {
						timeLogIds
					});
					console.log(qb.getQueryAndParameters(), `Timelog query for timeLog IDs for employee (${user.name})`);
				});
				const timeLogs = await query.getMany();
				console.log(timeLogs, `Found recent time logs using timelog ids for employee (${user.name})`);
				timeSlot.timeLogs.push(...timeLogs);
			}
		}

		console.log(`Found timelogs for timeslots range employee (${user.name})`, { timeLogs: timeSlot.timeLogs });
		/**
		 * Update TimeLog Entry Every TimeSlot Request From Desktop Timer
		 */
		for await (const timeLog of timeSlot.timeLogs) {
			if (timeLog.isRunning) {
				await this.timeLogRepository.update(timeLog.id, {
					stoppedAt: moment.utc().toDate()
				});
			}
		}

		if (isNotEmpty(activities)) {
			console.log(`Bulk activities save parameters employee (${user.name})`, {
				organizationId,
				employeeId,
				projectId: input.projectId,
				activities: activities
			});
			timeSlot.activities = await this.commandBus.execute(
				new BulkActivitiesSaveCommand({
					organizationId,
					employeeId,
					projectId: input.projectId,
					activities: activities
				})
			);
		}

		console.log(`Timeslot save first time before bulk activities save for employee (${user.name})`, { timeSlot });
		await this.timeSlotRepository.save(timeSlot);
		/*
		* Merge timeSlots into 10 minutes slots
		*/
		let [mergedTimeSlot] = await this.commandBus.execute(
			new TimeSlotMergeCommand(
				employeeId,
				minDate,
				maxDate
			)
		);
		if (mergedTimeSlot) {
			timeSlot = mergedTimeSlot;
		}

		console.log(`Final merged timeSlot for employee (${user.name})`, { timeSlot });
		return await this.timeSlotRepository.findOne({
			where : {
				id: timeSlot.id
			},
			relations: {
				timeLogs: true,
				screenshots: true
			}
		});
	}
}
