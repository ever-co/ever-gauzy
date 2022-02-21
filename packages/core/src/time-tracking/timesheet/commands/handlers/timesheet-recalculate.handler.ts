import { BadRequestException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository, WhereExpressionBuilder } from 'typeorm';
import * as moment from 'moment';
import { ITimesheet } from '@gauzy/contracts';
import { TimeSheetService } from '../../timesheet.service';
import { TimesheetRecalculateCommand } from '../timesheet-recalculate.command';
import { TimeSlot } from './../../../../core/entities/internal';
import { RequestContext } from './../../../../core/context';
import { getDateFormat } from './../../../../core/utils';

@CommandHandler(TimesheetRecalculateCommand)
export class TimesheetRecalculateHandler
	implements ICommandHandler<TimesheetRecalculateCommand> {
	constructor(
		private readonly timesheetService: TimeSheetService,
		
		@InjectRepository(TimeSlot)
		private readonly timeSlotRepository: Repository<TimeSlot>
	) {}

	public async execute(
		command: TimesheetRecalculateCommand
	): Promise<ITimesheet> {
		const { id } = command;
		const timesheet = await this.timesheetService.findOneByIdString(id);

		const tenantId = RequestContext.currentTenantId();
		const { employeeId, organizationId } = timesheet;

		const { start: startedAt, end: stoppedAt } = getDateFormat(
			moment.utc(timesheet.startedAt),
			moment.utc(timesheet.stoppedAt)
		);
		
		const query = this.timeSlotRepository.createQueryBuilder('time_slot');
		const timeSlot = await query
			.select('SUM(duration)', 'duration')
			.addSelect('AVG(keyboard)', 'keyboard')
			.addSelect('AVG(mouse)', 'mouse')
			.addSelect('AVG(overall)', 'overall')
			.where(
				new Brackets((qb: WhereExpressionBuilder) => {
					qb.andWhere(`"${query.alias}"."employeeId" = :employeeId`, {
						employeeId
					});
					qb.andWhere(`"${query.alias}"."organizationId" = :organizationId`, {
						organizationId
					});
					qb.andWhere(`"${query.alias}"."tenantId" = :tenantId`, {
						tenantId
					});
					qb.andWhere(`"${query.alias}"."startedAt" >= :startedAt AND "${query.alias}"."startedAt" < :stoppedAt`, {
						startedAt,
						stoppedAt
					});
				})
			)
			.getRawOne();
		try {
			await this.timesheetService.update(id, {
				duration: Math.round(timeSlot.duration),
				keyboard: Math.round(timeSlot.keyboard),
				mouse: Math.round(timeSlot.mouse),
				overall: Math.round(timeSlot.overall)
			});
		} catch (error) {
			throw new BadRequestException(`Can\'t update timesheet for employee-${employeeId} of organization-${organizationId}`);
		}
		return await this.timesheetService.findOneByIdString(id);
	}
}
