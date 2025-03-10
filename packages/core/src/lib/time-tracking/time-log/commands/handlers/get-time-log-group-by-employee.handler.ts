import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { chain, pluck } from 'underscore';
import * as moment from 'moment';
import { IReportDayGroupByEmployee, IReportProjectLogs, ITimeLog } from '@gauzy/contracts';
import { GetTimeLogGroupByEmployeeCommand } from '../get-time-log-group-by-employee.command';
import { calculateAverage, calculateAverageActivity } from './../../time-log.utils';

@CommandHandler(GetTimeLogGroupByEmployeeCommand)
export class GetTimeLogGroupByEmployeeHandler implements ICommandHandler<GetTimeLogGroupByEmployeeCommand> {
	/**
	 * Executes the command to generate a time log report grouped by employee.
	 * @param command The command containing time logs and other parameters.
	 * @returns A Promise that resolves to the generated report grouped by employee.
	 */
	public async execute(command: GetTimeLogGroupByEmployeeCommand): Promise<IReportDayGroupByEmployee[]> {
		const { timeLogs, logActivity, timeZone = moment.tz.guess() } = command;

		const dailyLogs = chain(timeLogs)
			.groupBy((log: ITimeLog) => log.employeeId)
			.map((byEmployeeLogs: ITimeLog[]) => {
				// Calculate average duration for specific date range.
				const avgDuration = calculateAverage(pluck(byEmployeeLogs, 'duration'));

				// Calculate average activity for specific date range.
				const avgActivity = calculateAverageActivity(byEmployeeLogs, logActivity);

				// Extract employee information
				const employee = byEmployeeLogs.length > 0 ? byEmployeeLogs[0].employee : null;

				const byDate = chain(byEmployeeLogs)
					.groupBy((log: ITimeLog) => moment.utc(log.startedAt).tz(timeZone).format('YYYY-MM-DD'))
					.map((byDateLogs: ITimeLog[], date) => ({
						date,
						projectLogs: this.getGroupByProject(byDateLogs, logActivity)
					}))
					.value();

				return {
					employee,
					logs: byDate,
					sum: avgDuration || null,
					activity: parseFloat(parseFloat(avgActivity + '').toFixed(2))
				};
			})
			.value();

		return dailyLogs;
	}

	/**
	 * Groups time logs by employee and calculates average duration and activity for each project.
	 * @param logs An array of time logs.
	 * @returns An array containing logs grouped by employee with calculated averages.
	 */
	getGroupByProject(logs: ITimeLog[], logActivity: Record<string, number>): IReportProjectLogs[] {
		const byProject = chain(logs)
			.groupBy('projectId')
			.map((timeLogs: ITimeLog[]) => {
				// Calculate average duration of the employee for specific project.
				const sum = calculateAverage(pluck(timeLogs, 'duration'));

				// Calculate Average activity of the employee
				const avgActivity = calculateAverageActivity(timeLogs, logActivity);

				// Retrieve employee details
				const project = timeLogs.length > 0 ? timeLogs[0].project : null;

				const projectClient = project ? project.organizationContact : null;
				const tasks = timeLogs.map((log) => ({
					task: log.task,
					description: log.description,
					duration: log.duration,
					client: log.organizationContact ? log.organizationContact : projectClient
				}));
				return {
					tasks,
					project,
					sum,
					activity: parseFloat(parseFloat(avgActivity + '').toFixed(2))
				};
			})
			.value();

		return byProject;
	}
}
