import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { GetTimeLogGroupByDateCommand } from '../get-time-log-group-by-date.command';
import { chain } from 'underscore';
import * as moment from 'moment';
import { IReportDayGroupByDate, ITimeLog, ITimeSlot } from '@gauzy/contracts';

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
									byEmployeeLogs.reduce(
										(iteratee: any, timeSlot: any) => {
											return iteratee + timeSlot.overall;
										},
										0
									) || 0;

								const activity =
									activitiesSum / timeSlots.length;

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
									activity
								};
							})
							.value();

						return {
							project,
							employeeLogs: byEmployee
						};
					})
					.value();

				return { date, logs: byProject };
			})
			.value();

		return dailyLogs;
	}
}
