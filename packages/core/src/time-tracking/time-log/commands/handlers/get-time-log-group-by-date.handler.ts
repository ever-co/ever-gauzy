import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { chain, pluck } from 'underscore';
import * as moment from 'moment';
import { IReportDayGroupByDate, ITimeLog } from '@gauzy/contracts';
import { GetTimeLogGroupByDateCommand } from '../get-time-log-group-by-date.command';
import { calculateAverage, calculateAverageActivity } from './../../time-log.utils';

@CommandHandler(GetTimeLogGroupByDateCommand)
export class GetTimeLogGroupByDateHandler implements ICommandHandler<GetTimeLogGroupByDateCommand> {

	/**
	 * Executes the command to generate a time log report grouped by date.
	 * @param command The command containing time logs and other parameters.
	 * @returns A Promise that resolves to the generated report grouped by date.
	 */
	public async execute(
		command: GetTimeLogGroupByDateCommand
	): Promise<IReportDayGroupByDate> {
		const { timeLogs } = command;

		const dailyLogs: any = chain(timeLogs)
			.groupBy((log) => moment(log.startedAt).format('YYYY-MM-DD'))
			.map((byDateLogs: ITimeLog[], date: string) => {
				// Calculate average duration for specific date range.
				const avgDuration = calculateAverage(pluck(byDateLogs, 'duration'));

				// Calculate average activity for specific date range.
				const avgActivity = calculateAverageActivity(chain(byDateLogs).pluck('timeSlots').flatten(true).value());

				const byProject = chain(byDateLogs).groupBy('projectId').map((byProjectLogs: ITimeLog[]) => {
					//
					const project = byProjectLogs.length > 0 ? byProjectLogs[0].project : null;
					const client = byProjectLogs.length > 0 ? byProjectLogs[0].organizationContact : project ? project.organizationContact : null;

					const byEmployee = chain(byProjectLogs).groupBy('employeeId').map((byEmployeeLogs: ITimeLog[]) => {
						// Calculate average duration of the employee for specific date range.
						const sum = calculateAverage(pluck(byEmployeeLogs, 'duration'));
						// Calculate Average activity of the employee
						const avgActivity = calculateAverageActivity(chain(byEmployeeLogs).pluck('timeSlots').flatten(true).value());
						//
						const employee = byEmployeeLogs.length > 0 ? byEmployeeLogs[0].employee : null;
						//
						const task = byEmployeeLogs.length > 0 ? byEmployeeLogs[0].task : null;
						//
						const description = byEmployeeLogs.length > 0 ? byEmployeeLogs[0].description : null;

						return {
							description,
							employee,
							sum,
							task,
							activity: parseFloat(parseFloat(avgActivity + '').toFixed(2))
						};
					}).value();

					return {
						project,
						client,
						employeeLogs: byEmployee
					};
				}).value();

				return {
					date,
					logs: byProject,
					sum: avgDuration || null,
					activity: parseFloat(parseFloat(avgActivity + '').toFixed(2))
				};
			});

		return dailyLogs.value();
	}
}
