import { Connection } from 'typeorm';
import * as faker from 'faker';
import {
	TimesheetStatus,
	IOrganizationProject,
	ITimeSlot,
	ITenant,
	IEmployee,
	ITimesheet,
	IOrganization
} from '@gauzy/contracts';
import * as moment from 'moment';
import * as _ from 'underscore';
import * as chalk from 'chalk';
import { IPluginConfig } from '@gauzy/common';
import { createRandomTimeLogs } from '../time-log/time-log.seed';
import { createRandomActivities } from '../activity/activities.seed';
import { Employee, Timesheet } from './../../core/entities/internal';
import { randomSeedConfig } from './../../core/seeds/random-seed-config';

export const createDefaultTimeSheet = async (
	connection: Connection,
	config: IPluginConfig,
	tenant: ITenant,
	organization: IOrganization,
	employees: IEmployee[],
	defaultProjects: IOrganizationProject[] | void
) => {
	if (!defaultProjects) {
		console.warn(
			'Warning: defaultProjects not found, RandomTimesheet will not be created'
		);
		return;
	}

	const timesheets: ITimesheet[] = [];
	for (let index = 0; index < 5; index++) {
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
			timesheet.organization = organization;
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
	const createdTimesheets = await connection.getRepository(Timesheet).find({
		where: {
			tenant
		}
	});
	
	try {
		console.log(chalk.green(`SEEDING Default TimeLogs & Activities`));
		const timeSlots: ITimeSlot[] = await createRandomTimeLogs(
			connection,
			config,
			tenant,
			createdTimesheets,
			defaultProjects
		);
		await createRandomActivities(
			connection, 
			tenant, 
			timeSlots
		);
	} catch (error) {
		console.log(chalk.red(`SEEDING Default TimeLogs & Activities`, error));
	}
};

export const createRandomTimesheet = async (
	connection: Connection,
	config: IPluginConfig,
	tenants: ITenant[],
	defaultProjects: IOrganizationProject[] | void
) => {
	if (!defaultProjects) {
		console.warn(
			'Warning: defaultProjects not found, RandomTimesheet will not be created'
		);
		return;
	}

	for (const tenant of tenants) {
		const timesheets: Timesheet[] = [];
		const employees = await connection.getRepository(Employee).find({
			where: {
				tenant
			},
			relations: ['organization']
		});

		for (let index = 0; index < randomSeedConfig.noOfTimesheetPerEmployee; index++) {
			const date = moment().subtract(index, 'week').toDate();
			const startedAt = moment(date).startOf('week').toDate();
			const stoppedAt = moment(date).endOf('week').toDate();

			_.chain(employees)
				.shuffle()
				.take(faker.datatype.number(employees.length))
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
	}

	try {
		console.log(chalk.green(`SEEDING Random TimeLogs & Activities`));
		for (const tenant of tenants) {
			const createdTimesheets = await connection.getRepository(Timesheet).find({
				where: {
					tenant
				}
			});
			const timeSlots: ITimeSlot[] = await createRandomTimeLogs(
				connection,
				config,
				tenant,
				createdTimesheets,
				defaultProjects
			);
			await createRandomActivities(
				connection,
				tenant, 
				timeSlots
			);
		}
	} catch (error) {
		console.log(chalk.red(`SEEDING Random TimeLogs & Activities`, error));
	}
};
