import { Connection } from 'typeorm';
import * as faker from 'faker';
import * as _ from 'underscore';
import { TimeLogSourceEnum, TimeLogType } from '@gauzy/models';
import * as moment from 'moment';
import { TimeLog } from '../time-log.entity';
import { Employee } from '../../employee/employee.entity';
import { Timesheet } from '../timesheet.entity';
import { OrganizationProjects } from '../../organization-projects/organization-projects.entity';
import { createRandomScreenshot } from '../screenshot/screenshot.seed';
import { createTimeSlots } from '../time-slot/time-slot.seed';
import { Screenshot } from '../screenshot.entity';

export const createRandomTimeLogs = async (
	connection: Connection,
	timeSheets: Timesheet[]
) => {
	const employees = await connection
		.getRepository(Employee)
		.createQueryBuilder()
		.getMany();

	let query = connection
		.getRepository(OrganizationProjects)
		.createQueryBuilder();
	query = query.leftJoinAndSelect(`${query.alias}.tasks`, 'tasks');
	const projects = await query.getMany();

	for (
		let timeSheetIndex = 0;
		timeSheetIndex < timeSheets.length;
		timeSheetIndex++
	) {
		const timesheet = timeSheets[timeSheetIndex];
		const randomDays = _.chain([0, 1, 2, 3, 4, 5, 6])
			.shuffle()
			.take(faker.random.number(7))
			.values()
			.value();

		const timelogs: TimeLog[] = [];
		let screenshots: Screenshot[] = [];
		const screenshotsPromise: Promise<Screenshot[]>[] = [];
		for (let index = 0; index <= randomDays.length; index++) {
			const day = randomDays[index];
			const date = moment(timesheet.startedAt).add(day, 'day').toDate();

			const range = dateRanges(
				moment(date).startOf('day').toDate(),
				moment(date).endOf('day').toDate()
			);
			for (let rangeIndex = 0; rangeIndex < range.length; rangeIndex++) {
				const { startedAt, stoppedAt } = range[rangeIndex];

				const project = faker.random.arrayElement(projects);
				const task = faker.random.arrayElement(project.tasks);

				const source: TimeLogSourceEnum = faker.random.arrayElement(
					Object.keys(TimeLogSourceEnum)
				) as TimeLogSourceEnum;

				const timelog = new TimeLog();
				timelog.employee = faker.random.arrayElement(employees);

				let timeSlots = await createTimeSlots(startedAt, stoppedAt);
				let logType: TimeLogType = TimeLogType.TRACKED;
				if (
					source === TimeLogSourceEnum.WEB_TIMER ||
					source === TimeLogSourceEnum.BROWSER
				) {
					logType = TimeLogType.MANUAL;
				} else {
					timeSlots = timeSlots.map((timeSlot) => {
						timeSlot.employee = timelog.employee;
						return timeSlot;
					});
				}

				await connection.manager.save(timeSlots);

				timeSlots.forEach((timeSlot) => {
					screenshotsPromise.push(createRandomScreenshot(timeSlot));
				});

				await Promise.all(screenshotsPromise).then((data) => {
					data.map((row) => {
						screenshots = screenshots.concat(row);
					});
				});

				timelog.timesheet = timesheet;
				timelog.timeSlots = timeSlots;
				timelog.project = project;
				timelog.task = task;
				timelog.client = project.organizationContact;
				timelog.startedAt = startedAt;
				timelog.stoppedAt = stoppedAt;
				timelog.logType = logType;
				timelog.source = source;
				timelog.description = faker.lorem.sentence(
					faker.random.number(10)
				);
				timelog.isBillable = faker.random.arrayElement([
					true,
					true,
					false
				]);
				timelog.deletedAt = null;
				timelogs.push(timelog);
			}
		}

		await connection.manager.save(timelogs);
		await connection.manager.save(screenshots);
	}
};

function dateRanges(start: Date, stop: Date) {
	const range = [];
	const startedAt = faker.date.between(start, stop);
	const stoppedAt = faker.date.between(startedAt, stop);
	range.push({ startedAt, stoppedAt });
	return range;
}
