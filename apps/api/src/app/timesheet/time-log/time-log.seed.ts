import { Connection, In } from 'typeorm';
import * as faker from 'faker';
import * as _ from 'underscore';
import { TimeLogSourceEnum, TimeLogType, TimeSlot } from '@gauzy/models';
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
	timeSheets: Timesheet[],
	defaultProjects: OrganizationProjects[]
) => {
	const allEmployees = await connection
		.getRepository(Employee)
		.createQueryBuilder()
		.getMany();

	let query = connection
		.getRepository(OrganizationProjects)
		.createQueryBuilder()
		.where({
			id: In(_.pluck(defaultProjects, 'id'))
		});
	query = query.leftJoinAndSelect(`${query.alias}.tasks`, 'tasks');

	const projects = await query.getMany();

	for (
		let timeSheetIndex = 0;
		timeSheetIndex < timeSheets.length;
		timeSheetIndex++
	) {
		const employees = _.chain(allEmployees)
			.shuffle()
			.take(faker.random.number({ min: 5, max: 10 }))
			.values()
			.value();

		const timesheet = timeSheets[timeSheetIndex];

		let timeSlots: TimeSlot[] = [];
		const timelogs: TimeLog[] = [];
		let screenshots: Screenshot[] = [];
		const screenshotsPromise: Promise<Screenshot[]>[] = [];

		for (
			let employeeIndex = 0;
			employeeIndex < employees.length;
			employeeIndex++
		) {
			const employee = employees[employeeIndex];

			const randomDays = _.chain([0, 1, 2, 3, 4, 5, 6])
				.shuffle()
				.take(faker.random.number({ min: 2, max: 4 }))
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

					const timelog = new TimeLog();
					timelog.employee = employee;

					let logType: TimeLogType = TimeLogType.TRACKED;
					if (
						source === TimeLogSourceEnum.WEB_TIMER ||
						source === TimeLogSourceEnum.BROWSER
					) {
						logType = TimeLogType.MANUAL;
					}
					const newTimeSlot = createTimeSlots(
						startedAt,
						stoppedAt
					).map((timeSlot) => {
						timeSlot.employee = timelog.employee;
						if (logType === TimeLogType.TRACKED) {
							screenshotsPromise.push(
								createRandomScreenshot(timeSlot)
							);
						}
						return timeSlot;
					});
					timeSlots = timeSlots.concat();

					timelog.timesheet = timesheet;
					timelog.timeSlots = newTimeSlot;
					timelog.project = project;
					timelog.task = task;
					timelog.organizationContact = project.organizationContact;
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
		}

		await connection.manager.save(timeSlots);

		await Promise.all(screenshotsPromise).then((data) => {
			data.forEach((row) => {
				screenshots = screenshots.concat(row);
			});
		});

		await connection.manager.save(timelogs);
		await connection.manager.save(screenshots);
	}
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
