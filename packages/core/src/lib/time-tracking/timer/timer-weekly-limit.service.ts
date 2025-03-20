import { Injectable, ConflictException, Logger } from '@nestjs/common';
import * as moment from 'moment';
import {
	ITimeLog,
	IEmployee,
	IWeeklyLimitStatus
} from '@gauzy/contracts';

import { StatisticService } from '../statistic/statistic.service';


@Injectable()
export class TimerWeeklyLimitService {
	private readonly logger = new Logger(`GZY - ${TimerWeeklyLimitService.name}`);

	constructor(private readonly _statisticService: StatisticService) { }

	/**
	 * Check if the employee has reached the weekly limit
	 *
	 * @param employee
	 * @param refDate
	 * @returns
	 */
	async checkWeeklyLimit(employee: IEmployee, refDate?: Date, ignoreException = false): Promise<IWeeklyLimitStatus> {
		const statistics = await this._statisticService.getWeeklyStatisticsActivities({
			organizationId: employee.organizationId,
			tenantId: employee.tenantId,
			employeeId: employee.id,
			startDate: moment(refDate).startOf('week').toDate(),
			endDate: moment(refDate).endOf('week').toDate()
		});
		const remainWeeklyTime = Math.trunc(employee.reWeeklyLimit * 3600) - statistics.duration;

		// Check if the employee has reached the weekly limit
		if (remainWeeklyTime <= 0 && !ignoreException) {
			throw new ConflictException('weekly-limit-reached');
		}
		return { remainWeeklyTime, workedThisWeek: statistics.duration };
	}

	/**
	 * Adjusts the stoppedAt time based on the remaining weekly limit.
	 * Comparison is done against the last stoppedAt time because previous time blocks before this value
	 * are already accounted for in the duration calculation
	 *
	 * @param stoppedAt - The stoppedAt time to adjust.
	 * @param lastLog - The last time log entry.
	 * @param remainWeeklyLimit - The remaining weekly limit.
	 * @returns The adjusted stoppedAt time.
	 */
	adjustStoppedAtBasedOnWeeklyLimit(stoppedAt: Date, lastLog: ITimeLog, remainWeeklyLimit: number): Date {
		// Check if the stoppedAt time exceeds the remaining weekly limit
		const duration = moment(stoppedAt).diff(moment.utc(lastLog.stoppedAt), 'seconds');
		if (duration > remainWeeklyLimit) {
			// Adjust the stoppedAt time to the remaining weekly limit
			const newStoppedAt = moment.utc(lastLog.stoppedAt).add(remainWeeklyLimit, 'seconds').toDate();
			this.logger.verbose(`Adjusted stoppedAt: ${stoppedAt} to ${newStoppedAt}`);
			return newStoppedAt;
		}
		return stoppedAt;
	}
}
