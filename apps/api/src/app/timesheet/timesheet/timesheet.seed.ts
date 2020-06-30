import { Connection } from 'typeorm';
import * as faker from 'faker';
import { TimesheetStatus } from '@gauzy/models';
import { Timesheet } from '../timesheet.entity';
import { Employee } from '../../employee/employee.entity';
import * as moment from 'moment';
import * as _ from 'underscore';
import * as rimraf from 'rimraf';
import * as path from 'path';
import { OrganizationClients } from '../../organization-clients/organization-clients.entity';
import { createRandomTimeLogs } from '../time-log/time-log.seed';
import { createRandomActivities } from '../activity/activities.seed';

export const createRandomTimesheet = async (connection: Connection) => {
	const timesheets: Timesheet[] = [];
	const employees = await connection
		.getRepository(Employee)
		.createQueryBuilder()
		.getMany();

	const users = await connection
		.getRepository(OrganizationClients)
		.createQueryBuilder()
		.getMany();

	for (let index = 0; index < 2; index++) {
		const date = moment().subtract(index, 'week').toDate();
		const startedAt = moment(date).startOf('week').toDate();
		const stoppedAt = moment(date).endOf('week').toDate();

		_.chain(employees)
			.shuffle()
			.take(faker.random.number(employees.length))
			.each((employee) => {
				const status = faker.random.arrayElement(
					Object.keys(TimesheetStatus)
				);

				let isBilled = false;
				let approvedAt: Date = null;
				let submittedAt: Date = null;

				if (TimesheetStatus[status] === TimesheetStatus.PENDING) {
					approvedAt = null;
					submittedAt = faker.date.past();
				} else if (
					TimesheetStatus[status] === TimesheetStatus.IN_REVIEW
				) {
					approvedAt = null;
					submittedAt = faker.date.between(startedAt, new Date());
				} else if (
					TimesheetStatus[status] === TimesheetStatus.APPROVED
				) {
					isBilled = faker.random.arrayElement([true, false]);
					approvedAt = faker.date.between(startedAt, new Date());
					submittedAt = faker.date.between(startedAt, approvedAt);
				}

				const timesheet = new Timesheet();
				timesheet.employee = employee;
				timesheet.approvedBy = faker.random.arrayElement(users);
				timesheet.startedAt = startedAt;
				timesheet.stoppedAt = stoppedAt;
				timesheet.duration = 0;
				timesheet.keyboard = 0;
				timesheet.mouse = 0;
				timesheet.overall = 0;
				timesheet.approvedAt = approvedAt;
				timesheet.submittedAt = submittedAt;
				timesheet.lockedAt = null;
				timesheet.isBilled = isBilled;
				timesheet.status = TimesheetStatus[status];
				timesheet.deletedAt = null;
				timesheets.push(timesheet);
			});
	}

	await connection.getRepository(Timesheet).save(timesheets);

	const createdTimesheets = await connection.getRepository(Timesheet).find();

	await new Promise((resolve, reject) => {
		const dir = path.join(
			process.cwd(),
			'apps',
			'api',
			'public',
			'screenshots'
		);
		rimraf(dir, () => {
			resolve();
		});
	});
	await createRandomTimeLogs(connection, createdTimesheets);
	await createRandomActivities(connection);

	return createdTimesheets;
};
