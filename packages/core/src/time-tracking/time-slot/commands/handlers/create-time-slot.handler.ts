import { BadRequestException } from '@nestjs/common';
import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository, SelectQueryBuilder, WhereExpressionBuilder } from 'typeorm';
import * as moment from 'moment';
import * as _ from 'underscore';
import { PermissionsEnum } from '@gauzy/contracts';
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
		let { organizationId, activities = [] } = input;

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
			const employee = await this.employeeRepository.findOne(employeeId);
			organizationId = employee ? employee.organizationId : null;
		}

		input.startedAt = moment(input.startedAt)
			.utc()
			.set('millisecond', 0)
			.toDate();
		let timeSlot = await this.timeSlotRepository.findOne({
			where: {
				organizationId,
				tenantId,
				employeeId,
				startedAt: input.startedAt
			}
		});

		if (!timeSlot) {
			timeSlot = new TimeSlot(_.omit(input, ['timeLogId']));
			timeSlot.tenantId = tenantId;
			timeSlot.organizationId = organizationId;
		}

		if (input.timeLogId) {
			let timeLogIds = [];
			if (input.timeLogId instanceof Array) {
				timeLogIds = input.timeLogId;
			} else {
				timeLogIds.push(input.timeLogId);
			}
			timeSlot.timeLogs = await this.timeLogRepository.find({
				id: In(timeLogIds),
				tenantId,
				organizationId,
				employeeId
			});
		} else {
			try {
				/**
				 * Find TimeLog for TimeSlot Range 
				 */
				const timeLogs = await this.timeLogRepository.find({
					where: (query: SelectQueryBuilder<TimeLog>) => {
						query.andWhere(
							new Brackets((qb: WhereExpressionBuilder) => { 
								qb.andWhere(`"${query.alias}"."tenantId" = :tenantId`, { tenantId });
								qb.andWhere(`"${query.alias}"."organizationId" = :organizationId`, { organizationId });
								qb.andWhere(`"${query.alias}"."employeeId" = :employeeId`, { employeeId });
							})
						);
						query.andWhere(
							new Brackets((qb: WhereExpressionBuilder) => {
								const { startedAt } = timeSlot;
								qb.andWhere(`"${query.alias}"."startedAt" <= :startedAt AND "${query.alias}"."stoppedAt" > :startedAt`, { startedAt });
							})
						);
						console.log(query.getQueryAndParameters(), 'Find TimeLog for TimeSlot Range');
					}
				});
				timeSlot.timeLogs = timeLogs;
				console.log('Found TimeLogs for TimeSlots Range', { timeLogs })
			} catch (error) {
				throw new BadRequestException('Can\'t find TimeLog for TimeSlot');
			}
		}

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

		if (input.activities) {
			console.log({ activities });
			timeSlot.activities = await this.commandBus.execute(
				new BulkActivitiesSaveCommand({
					employeeId: timeSlot.employeeId,
					projectId: input.projectId,
					activities: activities
				})
			);
		}

		await this.timeSlotRepository.save(timeSlot);

		const minDate = input.startedAt;
		const maxDate = input.startedAt;

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
		return await this.timeSlotRepository.findOne(timeSlot.id, {
			relations: ['timeLogs', 'screenshots']
		});
	}
}
