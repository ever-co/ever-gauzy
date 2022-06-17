import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { chain, pluck, reduce } from 'underscore';
import * as moment from 'moment';
import { ArraySum } from '@gauzy/common';
import { IReportDayGroupByDate, ITimeLog, ITimeSlot } from '@gauzy/contracts';
import { GetTimeLogGroupByDateCommand } from '../get-time-log-group-by-date.command';

@CommandHandler(GetTimeLogGroupByDateCommand)
export class GetTimeLogGroupByDateHandler
	implements ICommandHandler<GetTimeLogGroupByDateCommand> {
	constructor() {}

	public async execute(
		command: GetTimeLogGroupByDateCommand
	): Promise<IReportDayGroupByDate> {
		const { timeLogs } = command;

		const dailyLogs: any = chain(timeLogs)
			.groupBy((log) => moment(log.startedAt).format('YYYY-MM-DD'))
			.map((byDateLogs: ITimeLog[], date: string) => {
				/**
				* calculate avarage duration for specific date range.
				*/
				const avgDuration = reduce(pluck(byDateLogs, 'duration'), ArraySum, 0);
				/**
				* calculate average activity for specific date range.
				*/
				const slots: ITimeSlot[] = chain(byDateLogs).pluck('timeSlots').flatten(true).value();
				const avgActivity = (
					(reduce(pluck(slots, 'overall'), ArraySum, 0) * 100) / 
					(reduce(pluck(slots, 'duration'), ArraySum, 0))
				) || 0;

				const byProject = chain(byDateLogs)
					.groupBy('projectId')
					.map((byProjectLogs: ITimeLog[]) => {
						const project =
							byProjectLogs.length > 0
								? byProjectLogs[0].project
								: null;

						const byEmployee = chain(byProjectLogs)
							.groupBy('employeeId')
							.map((byEmployeeLogs: ITimeLog[]) => {
								/**
								* calculate avarage duration of the employee for specific date range.
								*/
								const sum = reduce(pluck(byEmployeeLogs, 'duration'), ArraySum, 0);

								/**
								* calculate average activity of the employee for specific date range.
								*/
								const slots: ITimeSlot[] = chain(byEmployeeLogs).pluck('timeSlots').flatten(true).value();

								/**
								* Calculate Average activity of the employee
								*/
								const avgActivity = (
									(reduce(pluck(slots, 'overall'), ArraySum, 0) * 100) / 
									(reduce(pluck(slots, 'duration'), ArraySum, 0))
								) || 0;

								const employee =
									byEmployeeLogs.length > 0
										? byEmployeeLogs[0].employee
										: null;

								const task =
									byEmployeeLogs.length > 0
										? byEmployeeLogs[0].task
										: null;

								return {
									employee,
									sum: sum,
									task,
									activity: parseFloat(
										parseFloat(avgActivity + '').toFixed(2)
									)
								};

							})
							.value();

						return {
							project,
							employeeLogs: byEmployee
						};
					})
					.value();
					
				return {
					date,
					logs: byProject,
					sum: avgDuration || null,
					activity: parseFloat(
						parseFloat(avgActivity + '').toFixed(2)
					)
				};
			})
			.value();

		return dailyLogs;
	}
}
