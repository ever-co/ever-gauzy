import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository } from 'typeorm';
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
		let { organizationId } = input;

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

		console.log(
			`Attempt to get timeSlot from DB with Parameters`,
			{
				organizationId,
				tenantId,
				employeeId,
				startedAt: input.startedAt
			},
			{
				timeSlot
			}
		);

		if (!timeSlot) {
			timeSlot = new TimeSlot(_.omit(input, ['timeLogId']));
			console.log('Omit New Timeslot:', timeSlot);
		}

		console.log('Timelog ID:', input.timeLogId);

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
			let query = this.timeLogRepository.createQueryBuilder('time_log');
			query = query
				.andWhere(`${query.alias}.tenantId = ${tenantId}`)
				.andWhere(`${query.alias}.organizationId = ${organizationId}`)
				.andWhere(`${query.alias}.employeeId = ${employeeId}`)
				.andWhere(
					new Brackets((qb: any) => {
						const { startedAt } = timeSlot;
						qb.orWhere('"startedAt" <= :startedAt AND "stoppedAt" > :startedAt', { startedAt });
						qb.orWhere('"startedAt" <= :startedAt AND "stoppedAt" IS NULL', { startedAt });
					})
				);
			timeSlot.timeLogs = await query.getMany();
			console.log('Else Timelog Timeslot:', query.getQueryAndParameters(), timeSlot);
		}

		if (input.activities) {
			timeSlot.activities = await this.commandBus.execute(
				new BulkActivitiesSaveCommand({
					employeeId: timeSlot.employeeId,
					projectId: input.projectId,
					activities: input.activities
				})
			);
		}

		console.log('Timeslot Before Create:', timeSlot);
		await this.timeSlotRepository.save(timeSlot);

		const minDate = input.startedAt;
		const maxDate = input.startedAt;

		/*
		* Merge timeslots into 10 minutes slots
		*/
		let [createdTimeSlot] = await this.commandBus.execute(
			new TimeSlotMergeCommand(
				employeeId,
				minDate, 
				maxDate
			)
		);

		// If merge timeslots not found then pass created timeslot
		if (!createdTimeSlot) {
			createdTimeSlot = timeSlot;
		}

		console.log('Created Time Slot:', { timeSlot: createdTimeSlot });
		return await this.timeSlotRepository.findOne(createdTimeSlot.id, {
			relations: ['timeLogs', 'screenshots']
		});
	}
}
