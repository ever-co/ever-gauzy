import { Connection, In } from 'typeorm';
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
import { OrganizationProject, Screenshot, TimeLog, Timesheet, TimeSlot } from './../../core/entities/internal';

export const createRandomTimeLogs = async (
	connection: Connection,
	config: IPluginConfig,
	tenant: ITenant,
	timeSheets: ITimesheet[],
	defaultProjects: IOrganizationProject[]
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
		const timeLogs: TimeLog[] = [];
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

					const { employeeId, organizationId } = timesheet;
					const timeLog = new TimeLog({
						employeeId,
						organizationId,
						timesheet,
						project,
						task,
						startedAt,
						stoppedAt,
						logType,
						source,
						tenant
					});
					timeLog.organizationContact = project.organizationContact;
					timeLog.description = faker.lorem.sentence(faker.datatype.number(10));
					timeLog.isBillable = faker.random.arrayElement([true, false]);
					timeLog.deletedAt = null;
					timeLogs.push(timeLog);
				}
			}
		}
		const savedTimeLogs = await connection.getRepository(TimeLog).save(timeLogs);

		const trackedTimeSlots: ITimeSlot[] = [];
		for (const timeLog of savedTimeLogs) {
			const { startedAt, stoppedAt, employeeId, organizationId, tenantId } = timeLog;
			const newTimeSlots: ITimeSlot[] = createTimeSlots(startedAt, stoppedAt).map((timeSlot) => {
				return {
					...timeSlot,
					employeeId,
					organizationId,
					tenantId,
					timeLogs: [timeLog]
				};
			});
			trackedTimeSlots.push(...newTimeSlots);
		}
		 
		/*
		* Saved Tracked Time Log & Time Slots and Related Screenshots 
		*/
		const newTrackedTimeSlots: ITimeSlot[] = [];
		for (const timeSlot of trackedTimeSlots) {
			const { tenantId, organizationId, startedAt, stoppedAt } = timeSlot;
			const randomScreenshots = await createRandomScreenshot(
				config, 
				tenantId,
				organizationId,
				startedAt, 
				stoppedAt
			);
			const screenshots = randomScreenshots.map(
				(item) => new Screenshot(_.omit(item, ['timeSlotId']))
			);
			const savedScreenshots = await connection.getRepository(Screenshot).save(screenshots);
			const newTimeSlot = new TimeSlot({
				..._.omit(timeSlot),
				screenshots: savedScreenshots
			});
			newTrackedTimeSlots.push(newTimeSlot);
		}
		await connection.getRepository(TimeSlot).save(newTrackedTimeSlots);

		allTimeSlots.push(...newTrackedTimeSlots);
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
