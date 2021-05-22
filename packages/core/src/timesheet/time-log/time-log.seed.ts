import { Connection, In, IsNull } from 'typeorm';
import * as faker from 'faker';
import * as _ from 'underscore';
import {
	TimeLogSourceEnum,
	TimeLogType,
	ITimeSlot,
	IOrganizationProject,
	ITenant,
	ITimesheet
} from '@gauzy/contracts';
import * as moment from 'moment';
import { IPluginConfig } from '@gauzy/common';
import { createRandomScreenshot } from '../screenshot/screenshot.seed';
import { createTimeSlots } from '../time-slot/time-slot.seed';
import { OrganizationProject, Screenshot, TimeLog, Timesheet } from './../../core/entities/internal';

export const createRandomTimeLogs = async (
	connection: Connection,
	config: IPluginConfig,
	tenant: ITenant,
	timeSheets: ITimesheet[],
	defaultProjects: IOrganizationProject[],
	noOfTimeLogsPerTimeSheet
) => {
	let query = connection
		.getRepository(OrganizationProject)
		.createQueryBuilder()
		.where({
			id: In(_.pluck(defaultProjects, 'id'))
		});
	query = query.leftJoinAndSelect(`${query.alias}.tasks`, 'tasks');
	const projects = await query.getMany();

	const timeSheetChunk = _.chunk(timeSheets, 5) as Array<Timesheet[]>;
	const allTimeSlots: ITimeSlot[] = [];

	for (
		let timeSheetChunkIndex = 0;
		timeSheetChunkIndex < timeSheetChunk.length;
		timeSheetChunkIndex++
	) {
		const timeSlots: ITimeSlot[] = [];
		const timeLogs: TimeLog[] = [];
		const screenshotsPromise: Promise<Screenshot[]>[] = [];

		for (
			let timeSheetIndex = 0;
			timeSheetIndex < timeSheetChunk[timeSheetChunkIndex].length;
			timeSheetIndex++
		) {
			const timesheet = timeSheetChunk[timeSheetChunkIndex][timeSheetIndex];
			const randomDays = _.chain([0, 1, 2, 3, 4, 5, 6])
				.shuffle()
				.take(faker.datatype.number({ min: 3, max: 5 }))
				.values()
				.value();

			for (let index = 0; index <= randomDays.length; index++) {
				const day = randomDays[index];
				const date = moment(timesheet.startedAt)
					.add(day, 'day')
					.toDate();

				const range = dateRanges(
					moment(date).startOf('day').toDate(),
					moment(date).endOf('day').toDate()
				);

				for (
					let rangeIndex = 0;
					rangeIndex < range.length;
					rangeIndex++
				) {
					const { startedAt, stoppedAt } = range[rangeIndex];
					const project = faker.random.arrayElement(projects);
					const task = faker.random.arrayElement(project.tasks);

					const source: TimeLogSourceEnum = faker.random.arrayElement(
						Object.keys(TimeLogSourceEnum)
					) as TimeLogSourceEnum;

				
					let logType: TimeLogType = TimeLogType.TRACKED;
					if (
						source === TimeLogSourceEnum.WEB_TIMER ||
						source === TimeLogSourceEnum.BROWSER
					) {
						logType = TimeLogType.MANUAL;
					}

					const timeLog = new TimeLog({
						employeeId: timesheet.employeeId
					});
					timeLog.timesheet = timesheet;
					timeLog.project = project;
					timeLog.task = task;
					timeLog.organizationContact = project.organizationContact;
					timeLog.startedAt = startedAt;
					timeLog.stoppedAt = stoppedAt;
					timeLog.logType = logType;
					timeLog.source = source;
					timeLog.description = faker.lorem.sentence(faker.datatype.number(10));
					timeLog.isBillable = faker.random.arrayElement([true, false]);
					timeLog.deletedAt = null;
					timeLog.organizationId = timesheet.organizationId,
					timeLog.tenant = tenant;

					const newTimeSlots = createTimeSlots(
						startedAt,
						stoppedAt
					).map((timeSlot) => {
						timeSlot.employeeId = timesheet.employeeId;
						timeSlot.organizationId = timesheet.organizationId;
						timeSlot.tenant = tenant;
						timeSlot.timeLogs = [timeLog];
						return timeSlot;
					});
					timeSlots.push(...newTimeSlots);
					timeLogs.push(timeLog);
				}
			}
		}

		const savedTimeLogs = await connection.manager.save(timeLogs);
		const savedTimeSlots = await connection.manager.save(timeSlots);

		allTimeSlots.push(...savedTimeSlots);

		for await (const timeLog of savedTimeLogs) {
			if (timeLog.logType === TimeLogType.TRACKED) {
				const filterTimeSlots = savedTimeSlots.filter(
					(x) => x.employeeId === timeLog.employeeId
				);
				for await (const timeSlot of filterTimeSlots) {
					for (let i = 0; i < noOfTimeLogsPerTimeSheet; i++) {
						screenshotsPromise.push(
							createRandomScreenshot(timeSlot, tenant, config)
						);
					}
				}
			}
		}

		await Promise.all(screenshotsPromise)
			.then(async (data) => {
				const screenshots: Screenshot[] = [];
				data.forEach((row) => {
					screenshots.push(...row);
				});
				await connection.manager.save(screenshots);

				/*
				* Need to delete screenshots which don't have timeslot
				*/
				const repository = connection.manager.getRepository(Screenshot);
				await repository.delete({ timeSlotId: IsNull(), tenant });
			})
			.catch((err) => {
				console.log({ err });
			});
	}
	return allTimeSlots;
};

function dateRanges(start: Date, stop: Date) {
	const range = [];
	const startedAt = faker.date.between(start, stop);
	const stoppedAt = faker.date.between(
		startedAt,
		moment(startedAt).add(2, 'hours').toDate()
	);
	range.push({ startedAt, stoppedAt });
	return range;
}
