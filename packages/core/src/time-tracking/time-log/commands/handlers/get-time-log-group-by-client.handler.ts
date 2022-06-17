import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { chain, pluck, reduce } from 'underscore';
import * as moment from 'moment';
import { IOrganizationContact, IReportDayGroupByClient, ITimeLog, ITimeSlot } from '@gauzy/contracts';
import { GetTimeLogGroupByClientCommand } from '../get-time-log-group-by-client.command';
import { ArraySum } from '@gauzy/common';

@CommandHandler(GetTimeLogGroupByClientCommand)
export class GetTimeLogGroupByClientHandler
	implements ICommandHandler<GetTimeLogGroupByClientCommand> {
	constructor() {}

	public async execute(
		command: GetTimeLogGroupByClientCommand
	): Promise<IReportDayGroupByClient> {
		const { timeLogs } = command;

		const dailyLogs: any = chain(timeLogs)
			.groupBy((log: ITimeLog) =>
				log.organizationContact ? log.organizationContactId : null
			)
			.map((byClientLogs: ITimeLog[]) => {
				/**
				* calculate avarage duration for specific client.
				*/
				const avgDuration = reduce(pluck(byClientLogs, 'duration'), ArraySum, 0);
				/**
				* calculate average activity for specific client.
				*/
				const slots: ITimeSlot[] = chain(byClientLogs).pluck('timeSlots').flatten(true).value();
				const avgActivity = (
					(reduce(pluck(slots, 'overall'), ArraySum, 0) * 100) / 
					(reduce(pluck(slots, 'duration'), ArraySum, 0))
				) || 0;


				const log = byClientLogs.length > 0 ? byClientLogs[0] : null;
				let client: IOrganizationContact = null;
				if (log && log.organizationContact) {
					client = log.organizationContact;
				} else if (log && log.project && log.project.organizationContact) {
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
										/**
										* calculate avarage duration of the employee for specific date range.
										*/
										const sum = reduce(pluck(byEmployeeLogs, 'duration'), ArraySum, 0);

										/**
										* calculate average activity of the employee for specific date range.
										*/
										const slots: ITimeSlot[] = chain(byEmployeeLogs).pluck('timeSlots').flatten(true).value();

										/**
										* Calculate Average activity of the employee
										*/
										const avgActivity = (
											(reduce(pluck(slots, 'overall'), ArraySum, 0) * 100) / 
											(reduce(pluck(slots, 'duration'), ArraySum, 0))
										) || 0;

										const employee =
											byEmployeeLogs.length > 0
												? byEmployeeLogs[0].employee
												: null;

										const task =
											byEmployeeLogs.length > 0
												? byEmployeeLogs[0].task
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
									projectLogs: byEmployee
								};
							})
							.value();

						return { project, logs: byDate };
					})
					.value();

				return {
					client,
					logs: byClient,
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
