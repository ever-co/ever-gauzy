import { Connection } from 'typeorm';
import * as faker from 'faker';
import {
	TimesheetStatus,
	IOrganizationProject,
	ITimeSlot
} from '@gauzy/models';
import { Timesheet } from '../timesheet.entity';
import { Employee } from '../../employee/employee.entity';
import * as moment from 'moment';
import * as _ from 'underscore';
import { createRandomTimeLogs } from '../time-log/time-log.seed';
import { createRandomActivities } from '../activity/activities.seed';
import chalk from 'chalk';
import { Tenant } from '../../tenant/tenant.entity';

export const createDefaultTimeSheet = async (
	connection: Connection,
	tenant: Tenant,
	employees: Employee[],
	defaultProjects: IOrganizationProject[] | void,
	noOfTimeLogsPerTimeSheet
) => {
	if (!defaultProjects) {
		console.warn(
			'Warning: defaultProjects not found, RandomTimesheet will not be created'
		);
		return;
	}

	const timesheets: Timesheet[] = [];

	for (let index = 0; index < 2; index++) {
		const date = moment().subtract(index, 'week').toDate();
		const startedAt = moment(date).startOf('week').toDate();
		const stoppedAt = moment(date).endOf('week').toDate();

		for (const employee of employees) {
			const status = faker.random.arrayElement(
				Object.keys(TimesheetStatus)
			);

			let isBilled = false;
			let approvedAt: Date = null;
			let submittedAt: Date = null;

			if (TimesheetStatus[status] === TimesheetStatus.PENDING) {
				approvedAt = null;
				submittedAt = faker.date.past();
			} else if (TimesheetStatus[status] === TimesheetStatus.IN_REVIEW) {
				approvedAt = null;
				submittedAt = faker.date.between(startedAt, new Date());
			} else if (TimesheetStatus[status] === TimesheetStatus.APPROVED) {
				isBilled = faker.random.arrayElement([true, false]);
				approvedAt = faker.date.between(startedAt, new Date());
				submittedAt = faker.date.between(startedAt, approvedAt);
			}
			const timesheet = new Timesheet();
			timesheet.employee = employee;
			timesheet.organization = employee.organization;
			timesheet.tenant = tenant;
			timesheet.approvedBy = null;
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
		}
	}

	await connection.getRepository(Timesheet).save(timesheets);

	const createdTimesheets = await connection.getRepository(Timesheet).find();
	let timeSlots: ITimeSlot[];
	try {
		console.log(chalk.green(`SEEDING Default TimeLogs`));
		timeSlots = await createRandomTimeLogs(
			connection,
			tenant,
			createdTimesheets,
			defaultProjects,
			noOfTimeLogsPerTimeSheet
		);
	} catch (error) {
		console.log(chalk.red(`SEEDING Default TimeLogs`, error));
	}

	try {
		console.log(chalk.green(`SEEDING Default Activities`));
		await createRandomActivities(connection, tenant, timeSlots);
	} catch (error) {
		console.log(chalk.red(`SEEDING Default Activities`, error));
	}

	return createdTimesheets;
};

export const createRandomTimesheet = async (
	connection: Connection,
	tenant: Tenant,
	defaultProjects: IOrganizationProject[] | void,
	noOfTimeLogsPerTimeSheet
) => {
	if (!defaultProjects) {
		console.warn(
			'Warning: defaultProjects not found, RandomTimesheet will not be created'
		);
		return;
	}

	const timesheets: Timesheet[] = [];

	const employees = await connection
		.getRepository(Employee)
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
				timesheet.organization = employee.organization;
				timesheet.tenant = tenant;
				timesheet.approvedBy = null;
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
	let timeSlots: ITimeSlot[];
	try {
		console.log(chalk.green(`SEEDING Random TimeLogs`));
		timeSlots = await createRandomTimeLogs(
			connection,
			tenant,
			createdTimesheets,
			defaultProjects,
			noOfTimeLogsPerTimeSheet
		);
	} catch (error) {
		console.log(chalk.red(`SEEDING Random TimeLogs`, error));
	}

	try {
		console.log(chalk.green(`SEEDING Random Activities`));
		await createRandomActivities(connection, tenant, timeSlots);
	} catch (error) {
		console.log(chalk.red(`SEEDING Random Activities`, error));
	}

	return createdTimesheets;
};
