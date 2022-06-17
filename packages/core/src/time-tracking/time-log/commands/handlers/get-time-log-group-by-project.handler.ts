import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { chain, pluck, reduce } from 'underscore';
import * as moment from 'moment';
import {
	IReportDayGroupByProject,
	ITimeLog,
	ITimeSlot
} from '@gauzy/contracts';
import { GetTimeLogGroupByProjectCommand } from '../get-time-log-group-by-project.command';
import { ArraySum } from '@gauzy/common';

@CommandHandler(GetTimeLogGroupByProjectCommand)
export class GetTimeLogGroupByProjectHandler
	implements ICommandHandler<GetTimeLogGroupByProjectCommand> {
	constructor() {}

	public async execute(
		command: GetTimeLogGroupByProjectCommand
	): Promise<IReportDayGroupByProject> {
		const { timeLogs } = command;

		const dailyLogs: any = chain(timeLogs)
			.groupBy((log) => log.projectId)
			.map((byProjectLogs: ITimeLog[]) => {
				/**
				* calculate avarage duration for specific project.
				*/
				const avgDuration = reduce(pluck(byProjectLogs, 'duration'), ArraySum, 0);
				/**
				* calculate average activity for specific project.
				*/
				const slots: ITimeSlot[] = chain(byProjectLogs).pluck('timeSlots').flatten(true).value();
				const avgActivity = (
					(reduce(pluck(slots, 'overall'), ArraySum, 0) * 100) / 
					(reduce(pluck(slots, 'duration'), ArraySum, 0))
				) || 0;

				const project =
					byProjectLogs.length > 0 ? byProjectLogs[0].project : null;

				const byDate = chain(byProjectLogs)
					.groupBy((log) =>
						moment(log.startedAt).format('YYYY-MM-DD')
					)
					.map((byDateLogs: ITimeLog[], date) => {
						const byEmployee = chain(byDateLogs)
							.groupBy('employeeId')
							.map((byEmployeeLogs: ITimeLog[]) => {
								/**
								* calculate avarage duration of the employee
								*/
								const sum = reduce(pluck(byEmployeeLogs, 'duration'), ArraySum, 0);
								/**
								* calculate average activity of the employee
								*/
								const slots: ITimeSlot[] = chain(byEmployeeLogs).pluck('timeSlots').flatten(true).value();
								/**
								* Calculate Average activity of the employee
								*/
								const avgActivity = (
									(reduce(pluck(slots, 'overall'), ArraySum, 0) * 100) / 
									(reduce(pluck(slots, 'duration'), ArraySum, 0))
								) || 0;

								const task =
									byEmployeeLogs.length > 0
										? byEmployeeLogs[0].task
										: null;

								const employee =
									byEmployeeLogs.length > 0
										? byEmployeeLogs[0].employee
										: null;
										
								return {
									task,
									employee,
									sum,
									activity: parseFloat(
										parseFloat(avgActivity + '').toFixed(2)
									)
								};
							})
							.value();

						return {
							date,
							employeeLogs: byEmployee
						};
					})
					.value();
				return {
					project,
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
