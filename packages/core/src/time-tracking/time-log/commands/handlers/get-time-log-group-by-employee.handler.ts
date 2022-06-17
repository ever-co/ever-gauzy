import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { chain, pluck, reduce } from 'underscore';
import * as moment from 'moment';
import {
	IReportDayGroupByEmployee,
	ITimeLog,
	ITimeSlot
} from '@gauzy/contracts';
import { ArraySum } from '@gauzy/common';
import { GetTimeLogGroupByEmployeeCommand } from '../get-time-log-group-by-employee.command';

@CommandHandler(GetTimeLogGroupByEmployeeCommand)
export class GetTimeLogGroupByEmployeeHandler
	implements ICommandHandler<GetTimeLogGroupByEmployeeCommand> {
	constructor() {}

	public async execute(
		command: GetTimeLogGroupByEmployeeCommand
	): Promise<IReportDayGroupByEmployee> {
		const { timeLogs } = command;

		const dailyLogs: any = chain(timeLogs)
			.groupBy((log) => log.employeeId)
			.map((byEmployeeLogs: ITimeLog[]) => {
				/**
				* calculate avarage duration for specific employee.
				*/
				const avgDuration = reduce(pluck(byEmployeeLogs, 'duration'), ArraySum, 0);
				/**
				* calculate average activity for specific date range.
				*/
				const slots: ITimeSlot[] = chain(byEmployeeLogs).pluck('timeSlots').flatten(true).value();
				const avgActivity = (
					(reduce(pluck(slots, 'overall'), ArraySum, 0) * 100) / 
					(reduce(pluck(slots, 'duration'), ArraySum, 0))
				) || 0;

				const employee =
					byEmployeeLogs.length > 0
						? byEmployeeLogs[0].employee
						: null;

				const byDate = chain(byEmployeeLogs)
					.groupBy((log) =>
						moment(log.startedAt).format('YYYY-MM-DD')
					)
					.map((byDateLogs: ITimeLog[], date) => {
						const byProject = chain(byDateLogs)
							.groupBy('projectId')
							.map((byProjectLogs: ITimeLog[]) => {
								/**
								* calculate avarage duration of the employee
								*/
								const sum = reduce(pluck(byProjectLogs, 'duration'), ArraySum, 0);
								/**
								* calculate average activity of the employee
								*/
								const slots: ITimeSlot[] = chain(byProjectLogs).pluck('timeSlots').flatten(true).value();
								/**
								* Calculate Average activity of the employee
								*/
								const avgActivity = (
									(reduce(pluck(slots, 'overall'), ArraySum, 0) * 100) / 
									(reduce(pluck(slots, 'duration'), ArraySum, 0))
								) || 0;
								const project =
									byProjectLogs.length > 0
										? byProjectLogs[0].project
										: null;
								const task =
									byProjectLogs.length > 0
										? byProjectLogs[0].task
										: null;
								return {
									task,
									project,
									sum,
									activity: parseFloat(
										parseFloat(avgActivity + '').toFixed(2)
									)
								};
							})
							.value();
						return {
							date,
							projectLogs: byProject
						};
					})
					.value();

				return {
					employee,
					logs: byDate,
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
