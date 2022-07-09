import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository, SelectQueryBuilder, WhereExpressionBuilder } from 'typeorm';
import * as moment from 'moment';
import { omit } from 'underscore';
import { ITimeSlot, PermissionsEnum, TimeLogSourceEnum, TimeLogType } from '@gauzy/contracts';
import { isNotEmpty } from '@gauzy/common';
import { RequestContext } from '../../../../core/context';
import {
	Employee,
	TimeLog
} from './../../../../core/entities/internal';
import { TimeSlot } from './../../time-slot.entity';
import { CreateTimeSlotCommand } from '../create-time-slot.command';
import { BulkActivitiesSaveCommand } from '../../../activity/commands';
import { TimeSlotMergeCommand } from './../time-slot-merge.command';
import { getStartEndIntervals } from './../../utils';
import { getDateRangeFormat } from './../../../../core/utils';

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
		let { organizationId, activities = [] } = input;

		console.log('Time Slot Interval Request', {
			input
		});

		const user = RequestContext.currentUser();
		const tenantId = RequestContext.currentTenantId();

		/**
		 * Check logged user has employee permission
		 */
		if (
			!RequestContext.hasPermission(
				PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
			)
		) {
			input.employeeId = user.employeeId;
		}

		/*
		 * If employeeId not send from desktop timer request payload
		 */
		if (!input.employeeId && user.employeeId) {
			input.employeeId = user.employeeId;
		}

		/*
		 * If organization not found in request then assign current logged user organization
		 */
		const { employeeId } = input;
		if (!organizationId) {
			const employee = await this.employeeRepository.findOneBy({
				id: employeeId
			});
			organizationId = employee ? employee.organizationId : null;
		}

		const minDate = input.startedAt;
		const maxDate = input.startedAt;

		let timeSlot: ITimeSlot;
		try {
			timeSlot = await this.timeSlotRepository.findOneOrFail({
				where: (query: SelectQueryBuilder<TimeSlot>) => {
					const { start, end } = getStartEndIntervals(
						moment(minDate),
						moment(maxDate)
					);
					const { start: startDate, end: endDate } = getDateRangeFormat(
						moment.utc(start),
						moment.utc(end)
					);
					query.andWhere(`"${query.alias}"."tenantId" = :tenantId`, { tenantId });
					query.andWhere(`"${query.alias}"."organizationId" = :organizationId`, { organizationId });
					query.andWhere(`"${query.alias}"."employeeId" = :employeeId`, { employeeId });
					query.andWhere(`"${query.alias}"."startedAt" BETWEEN :startDate AND :endDate`, {
						startDate,
						endDate
					});
					query.addOrderBy(`"${query.alias}"."createdAt"`, 'ASC');
					console.log('Get Time Slot Query & Parameters', query.getQueryAndParameters());
				},
				relations: ['timeLogs']
			});
		} catch (error) {
			if (!timeSlot) {
				timeSlot = new TimeSlot(omit(input, ['timeLogId']));
				timeSlot.tenantId = tenantId;
				timeSlot.organizationId = organizationId;
				timeSlot.timeLogs = [];
			}
		}
		console.log({ timeSlot }, `Find Time Slot For Time: ${input.startedAt}`);
		try {
			/**
			 * Find TimeLog for TimeSlot Range
			 */
			const timeLog = await this.timeLogRepository.findOneOrFail({
				where: (query: SelectQueryBuilder<TimeLog>) => {
					console.log({ input });
					query.andWhere(
						new Brackets((qb: WhereExpressionBuilder) => {
							qb.andWhere(`"${query.alias}"."tenantId" = :tenantId`, { tenantId });
							qb.andWhere(`"${query.alias}"."organizationId" = :organizationId`, { organizationId });
							qb.andWhere(`"${query.alias}"."employeeId" = :employeeId`, { employeeId });
							qb.andWhere(`"${query.alias}"."source" = :source`, { source: TimeLogSourceEnum.DESKTOP });
							qb.andWhere(`"${query.alias}"."logType" = :logType`, { logType: TimeLogType.TRACKED });
							qb.andWhere(`"${query.alias}"."stoppedAt" IS NOT NULL`);
							qb.andWhere(`"${query.alias}"."deletedAt" IS NULL`);
						})
					);
					query.addOrderBy(`"${query.alias}"."createdAt"`, 'DESC');
					console.log(query.getQueryAndParameters());
				}
			});
			console.log(timeLog, 'Found latest Worked Time Log!');
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
				const timeLogs = await this.timeLogRepository.find({
					where: (query: SelectQueryBuilder<TimeLog>) => {
						query.andWhere(
							new Brackets((qb: WhereExpressionBuilder) => {
								qb.andWhere(`"${query.alias}"."tenantId" = :tenantId`, { tenantId });
								qb.andWhere(`"${query.alias}"."organizationId" = :organizationId`, { organizationId });
								qb.andWhere(`"${query.alias}"."source" = :source`, { source: TimeLogSourceEnum.DESKTOP });
								qb.andWhere(`"${query.alias}"."logType" = :logType`, { logType: TimeLogType.TRACKED });
								qb.andWhere(`"${query.alias}"."employeeId" = :employeeId`, { employeeId });
								qb.andWhere(`"${query.alias}"."stoppedAt" IS NOT NULL`);
								qb.andWhere(`"${query.alias}"."deletedAt" IS NULL`);
							})
						);
						query.andWhere(`"${query.alias}"."id" IN (:...timeLogIds)`, {
							timeLogIds
						});
						console.log(query.getQueryAndParameters(), 'Time Log Query For TimeLog IDs');
					}
				});
				console.log(timeLogs, 'Found recent time logs using timelog ids');
				timeSlot.timeLogs.push(...timeLogs);
			}
		}

		console.log('Found TimeLogs for TimeSlots Range', { timeLogs: timeSlot.timeLogs });
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
			const bulkActivities = await this.commandBus.execute(
				new BulkActivitiesSaveCommand({
					employeeId: timeSlot.employeeId,
					projectId: input.projectId,
					activities: activities
				})
			);
			timeSlot.activities = bulkActivities;
		}

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

		console.log({ timeSlot }, 'Final Merged TimeSlot');

		const [slot] = await this.timeSlotRepository.find({
			where : {
				id: timeSlot.id
			},
			relations: {
				timeLogs: true,
				screenshots: true
			}
		});
		return slot;
	}
}
