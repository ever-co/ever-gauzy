import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { chain, pluck } from 'underscore';
import * as moment from 'moment';
import {
	IOrganizationContact,
	IReportDayGroupByClient,
	ITimeLog
} from '@gauzy/contracts';
import { GetTimeLogGroupByClientCommand } from '../get-time-log-group-by-client.command';
import { calculateAverage, calculateAverageActivity } from './../../time-log.utils';

@CommandHandler(GetTimeLogGroupByClientCommand)
export class GetTimeLogGroupByClientHandler implements ICommandHandler<GetTimeLogGroupByClientCommand> {

	/**
	 * Executes the command to generate a time log report grouped by client.
	 * @param command The command containing time logs and other parameters.
	 * @returns A Promise that resolves to the generated report grouped by client.
	 */
	public async execute(
		command: GetTimeLogGroupByClientCommand
	): Promise<IReportDayGroupByClient> {
		const { timeLogs } = command;

		// Group timeLogs by organizationContactId
		const dailyLogs: any = chain(timeLogs)
			.groupBy((log: ITimeLog) => log.organizationContactId)
			.map((logs: ITimeLog[]) => {
				// Calculate average duration for specific client.
				const avgDuration = calculateAverage(pluck(logs, 'duration'));

				// Calculate average activity for specific client.
				const avgActivity = calculateAverageActivity(chain(logs).pluck('timeSlots').flatten(true).value());

				// Retrieve the first log for further details
				const log = logs.length > 0 ? logs[0] : null;

				// Extract client information using optional chaining
				const client: IOrganizationContact | null = log?.organizationContact ?? (log?.project?.organizationContact ?? null);

				// Group logs by projectId
				const byClient = chain(logs).groupBy((log: ITimeLog) => log.projectId)
					.map((projectLogs: ITimeLog[]) => {
						// Retrieve the first log for further details
						const project = projectLogs.length > 0 ? projectLogs[0].project : null;

						// Group projectLogs by date
						const byDate = chain(projectLogs)
							.groupBy((log) => moment(log.startedAt).format('YYYY-MM-DD'))
							.map((dateLogs: ITimeLog[], date) => ({
								date,
								projectLogs: this.getGroupByEmployee(dateLogs) // Group dateLogs by employeeId
							}))
							.value();

						return {
							project,
							logs: byDate
						};
					}).value();

				return {
					client,
					logs: byClient,
					sum: avgDuration || null,
					activity: parseFloat(parseFloat(avgActivity + '').toFixed(2))
				};
			}).value();

		return dailyLogs;
	}

	/**
	 * Groups time logs by employee and calculates average duration and activity for each employee.
	 * @param logs An array of time logs.
	 * @returns An array containing logs grouped by employee with calculated averages.
	 */
	getGroupByEmployee(logs: ITimeLog[]) {
		const byEmployee = chain(logs).groupBy('employeeId').map((timeLogs: ITimeLog[]) => {
			// Calculate average duration for specific employee.
			const sum = calculateAverage(pluck(timeLogs, 'duration'));

			// Calculate average activity for specific employee.
			const avgActivity = calculateAverageActivity(chain(timeLogs).pluck('timeSlots').flatten(true).value());

			// Retrieve employee details
			const employee = timeLogs.length > 0 ? timeLogs[0].employee : null;
			const task = timeLogs.length > 0 ? timeLogs[0].task : null;
			const description = timeLogs.length > 0 ? timeLogs[0].description : null;

			return {
				description,
				task,
				employee,
				sum,
				activity: parseFloat(avgActivity.toFixed(2))
			};
		}).value();

		return byEmployee;
	}
}
