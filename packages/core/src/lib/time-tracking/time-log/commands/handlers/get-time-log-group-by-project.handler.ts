import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { chain, pluck } from 'underscore';
import moment from 'moment';
import { IReportDayGroupByProject, ITimeLog } from '@gauzy/contracts';
import { GetTimeLogGroupByProjectCommand } from '../get-time-log-group-by-project.command';
import { calculateAverage, calculateAverageActivity } from './../../time-log.utils';

@CommandHandler(GetTimeLogGroupByProjectCommand)
export class GetTimeLogGroupByProjectHandler implements ICommandHandler<GetTimeLogGroupByProjectCommand> {
	/**
	 * Executes the command to generate a time log report grouped by project.
	 * @param command The command containing time logs and other parameters.
	 * @returns A Promise that resolves to the generated report grouped by project.
	 */
	public async execute(command: GetTimeLogGroupByProjectCommand): Promise<IReportDayGroupByProject> {
		const { timeLogs, timeZone = moment.tz.guess() } = command;

		// Group timeLogs by projectId
		const dailyLogs: any = chain(timeLogs)
			.groupBy((log: ITimeLog) => log.projectId)
			.map((byProjectLogs: ITimeLog[]) => {
				// Calculate average duration for specific project.
				const avgDuration = calculateAverage(pluck(byProjectLogs, 'duration'));

				// Calculate average activity for specific project.
				const avgActivity = calculateAverageActivity(
					chain(byProjectLogs).pluck('timeSlots').flatten(true).value()
				);

				// Extract project information
				const project = byProjectLogs.length > 0 ? byProjectLogs[0].project : null;

				// Group projectLogs by date
				const byDate = chain(byProjectLogs)
					.groupBy((log: ITimeLog) => moment.utc(log.startedAt).tz(timeZone).format('YYYY-MM-DD'))
					.map((byDateLogs: ITimeLog[], date) => ({
						date,
						employeeLogs: this.getGroupByEmployee(byDateLogs)
					}))
					.value();

				return {
					project,
					logs: byDate,
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
				// Calculate average duration of the employee for specific employee.
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
					tasks,
					employee,
					sum,
					activity: parseFloat(parseFloat(avgActivity + '').toFixed(2))
				};
			})
			.value();

		return byEmployee;
	}
}
