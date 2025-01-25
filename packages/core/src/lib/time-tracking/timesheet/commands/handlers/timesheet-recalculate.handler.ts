import { BadRequestException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Brackets, WhereExpressionBuilder } from 'typeorm';
import * as moment from 'moment';
import { ITimesheet } from '@gauzy/contracts';
import { TimeSheetService } from '../../timesheet.service';
import { TimesheetRecalculateCommand } from '../timesheet-recalculate.command';
import { RequestContext } from './../../../../core/context';
import { getDateRangeFormat } from './../../../../core/utils';
import { prepareSQLQuery as p } from './../../../../database/database.helper';
import { TypeOrmTimeSlotRepository } from '../../../time-slot/repository/type-orm-time-slot.repository';

@CommandHandler(TimesheetRecalculateCommand)
export class TimesheetRecalculateHandler implements ICommandHandler<TimesheetRecalculateCommand> {
	constructor(
		private readonly timesheetService: TimeSheetService,
		private readonly typeOrmTimeSlotRepository: TypeOrmTimeSlotRepository
	) {}

	/**
	 * Executes the `TimesheetRecalculateCommand` to recalculate timesheet data.
	 *
	 * @param {TimesheetRecalculateCommand} command - The command containing necessary parameters for recalculating a timesheet.
	 * @returns {Promise<ITimesheet>} - A promise resolving to the updated timesheet after recalculations.
	 *
	 * @description
	 * This method processes the given command to recalculate the timesheet based on updated time logs,
	 * adjustments, or other relevant criteria. It ensures that the total worked hours, breaks,
	 * and billable time are accurately computed.
	 *
	 * @example
	 * ```ts
	 * const command = new TimesheetRecalculateCommand(timesheetId);
	 * const updatedTimesheet = await timesheetService.execute(command);
	 * console.log(updatedTimesheet);
	 * ```
	 */
	public async execute(command: TimesheetRecalculateCommand): Promise<ITimesheet> {
		const { id } = command;
		const timesheet = await this.timesheetService.findOneByIdString(id);

		const tenantId = RequestContext.currentTenantId();
		const { employeeId, organizationId } = timesheet;

		const { start: startedAt, end: stoppedAt } = getDateRangeFormat(
			moment.utc(timesheet.startedAt),
			moment.utc(timesheet.stoppedAt)
		);

		const query = this.typeOrmTimeSlotRepository.createQueryBuilder();
		const timeSlot = await query
			.select('SUM(duration)', 'duration')
			.addSelect('AVG(keyboard)', 'keyboard')
			.addSelect('AVG(mouse)', 'mouse')
			.addSelect('AVG(overall)', 'overall')
			.where(
				new Brackets((qb: WhereExpressionBuilder) => {
					qb.where(
						p(`"${query.alias}"."employeeId" = :employeeId
						   AND "${query.alias}"."organizationId" = :organizationId
						   AND "${query.alias}"."tenantId" = :tenantId
						   AND "${query.alias}"."startedAt" >= :startedAt
						   AND "${query.alias}"."startedAt" < :stoppedAt`),
						{ employeeId, organizationId, tenantId, startedAt, stoppedAt }
					);
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
			throw new BadRequestException(
				`Can\'t update timesheet for employee-${employeeId} of organization-${organizationId}`
			);
		}

		return await this.timesheetService.findOneByIdString(id);
	}
}
