import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { chain } from 'underscore';
import * as moment from 'moment';
import { IReportDayGroupByClient, ITimeLog, ITimeSlot } from '@gauzy/contracts';
import { GetTimeLogGroupByClientCommand } from '../get-time-log-group-by-client.command';

@CommandHandler(GetTimeLogGroupByClientCommand)
export class GetTimeLogGroupByClientHandler
	implements ICommandHandler<GetTimeLogGroupByClientCommand> {
	constructor() {}

	public async execute(
		command: GetTimeLogGroupByClientCommand
	): Promise<IReportDayGroupByClient> {
		const { timeLogs } = command;

		const dailyLogs: any = chain(timeLogs)
			.groupBy((log) =>
				log.project ? log.project.organizationContactId : null
			)
			.map((byClientLogs: ITimeLog[]) => {
				const log = byClientLogs.length > 0 ? byClientLogs[0] : null;
				let client = null;
				if (log && log.project && log.project.organizationContact) {
					client = log.project.organizationContact;
				}

				const byClient = chain(byClientLogs)
					.groupBy((log) => log.projectId)
					.map((byProjectLogs: ITimeLog[]) => {
						const project =
							byProjectLogs.length > 0
								? byProjectLogs[0].project
								: null;

						const byDate = chain(byProjectLogs)
							.groupBy((log) =>
								moment(log.startedAt).format('YYYY-MM-DD')
							)
							.map((byDateLogs: ITimeLog[], date) => {
								const byEmployee = chain(byDateLogs)
									.groupBy('employeeId')
									.map((byEmployeeLogs: ITimeLog[]) => {
										const employee =
											byEmployeeLogs.length > 0
												? byEmployeeLogs[0].employee
												: null;

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
												(
													iteratee: any,
													timeSlot: any
												) => {
													return (
														iteratee +
														timeSlot.overall
													);
												},
												0
											) || 0;

										const task =
											byEmployeeLogs.length > 0
												? byEmployeeLogs[0].task
												: null;

										const activity =
											activitiesSum / timeSlots.length;

										return {
											task,
											employee,
											sum,
											activity: activity
										};
									})
									.value();

								return {
									date,
									projectLogs: byEmployee
								};
							})
							.value();

						return { project, logs: byDate };
					})
					.value();

				return { client, logs: byClient };
			});

		return dailyLogs;
	}
}
