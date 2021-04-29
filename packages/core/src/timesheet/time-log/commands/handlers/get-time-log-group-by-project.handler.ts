import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { chain } from 'underscore';
import * as moment from 'moment';
import {
	IReportDayGroupByProject,
	ITimeLog,
	ITimeSlot
} from '@gauzy/contracts';
import { GetTimeLogGroupByProjectCommand } from '../get-time-log-group-by-project.command';

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
								const sum = byEmployeeLogs.reduce(
									(iteratee: any, log: any) => {
										return iteratee + log.duration;
									},
									0
								);

								const timeSlots: ITimeSlot[] = chain(
									byEmployeeLogs
								)
									.pluck('timeSlots')
									.flatten(true)
									.value();

								const activitiesSum =
									timeSlots.reduce(
										(iteratee: any, timeSlot: any) => {
											return iteratee + timeSlot.overall;
										},
										0
									) || 0;

								const activity =
									activitiesSum / timeSlots.length;

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
									activity
								};
							})
							.value();

						return {
							date,
							employeeLogs: byEmployee
						};
					})
					.value();

				return { project, logs: byDate };
			})
			.value();

		return dailyLogs;
	}
}
