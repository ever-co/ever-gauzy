import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { chain, pluck } from 'underscore';
import moment from 'moment';
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
	public async execute(command: GetTimeLogGroupByDateCommand): Promise<IReportDayGroupByDate> {
		const { timeLogs, timeZone = moment.tz.guess() } = command;

		const dailyLogs: any = chain(timeLogs)
			.groupBy((log: ITimeLog) => moment.utc(log.startedAt).tz(timeZone).format('YYYY-MM-DD'))
			.map((byDateLogs: ITimeLog[], date: string) => {
				// Calculate average duration for specific date range.
				const avgDuration = calculateAverage(pluck(byDateLogs, 'duration'));

				// Calculate average activity for specific date range.
				const avgActivity = calculateAverageActivity(
					chain(byDateLogs).pluck('timeSlots').flatten(true).value()
				);

				const byProject = chain(byDateLogs)
					.groupBy('projectId')
					.map((byProjectLogs: ITimeLog[]) => {
						// Extract project information
						const project = byProjectLogs.length > 0 ? byProjectLogs[0].project : null;

						return {
							project,
							employeeLogs: this.getGroupByEmployee(byProjectLogs)
						};
					})
					.value();

				return {
					date,
					logs: byProject,
					sum: avgDuration || null,
					activity: parseFloat(parseFloat(avgActivity + '').toFixed(2))
				};
			})
			.value();

		return dailyLogs;
	}

	/**
	 * Groups time logs by employee and calculates average duration and activity for each employee.
	 * @param logs An array of time logs.
	 * @returns An array containing logs grouped by employee with calculated averages.
	 */
	getGroupByEmployee(logs: ITimeLog[]) {
		const byEmployee = chain(logs)
			.groupBy('employeeId')
			.map((timeLogs: ITimeLog[]) => {
				// Calculate average duration of the employee for specific date range.
				const sum = calculateAverage(pluck(timeLogs, 'duration'));

				// Calculate Average activity of the employee
				const avgActivity = calculateAverageActivity(chain(timeLogs).pluck('timeSlots').flatten(true).value());

				// Retrieve employee details
				const employee = timeLogs.length > 0 ? timeLogs[0].employee : null;

				const tasks = timeLogs.map((log) => ({
					task: log.task,
					description: log.description,
					duration: log.duration,
					client: log.organizationContact ? log.organizationContact : null
				}));

				return {
					employee,
					sum,
					tasks,
					activity: parseFloat(parseFloat(avgActivity + '').toFixed(2))
				};
			})
			.value();

		return byEmployee;
	}
}
