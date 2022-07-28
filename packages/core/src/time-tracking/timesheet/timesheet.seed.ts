import { DataSource } from 'typeorm';
import { faker } from '@ever-co/faker';
import {
	TimesheetStatus,
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
import { createRandomTimeLogs, recalculateTimesheetActivity } from './../time-log/time-log.seed';
import { createRandomActivities } from '../activity/activity.seed';
import { Employee, Timesheet } from './../../core/entities/internal';
import { randomSeedConfig } from './../../core/seeds/random-seed-config';

export const createDefaultTimeSheet = async (
	dataSource: DataSource,
	config: Partial<IPluginConfig>,
	tenant: ITenant,
	organization: IOrganization,
	employees: IEmployee[]
) => {
	try {
		const timesheets: ITimesheet[] = [];
		for (let index = 0; index < 5; index++) {
			const date = moment().subtract(index, 'week').toDate();
			const startedAt = moment(date).startOf('week').toDate();
			const stoppedAt = moment(date).endOf('week').toDate();

			for await (const employee of employees) {
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
		await dataSource.getRepository(Timesheet).save(timesheets);
	} catch (error) {
		console.log(chalk.red(`SEEDING Default Timesheet`, error));
	}

	try {
		console.log(chalk.green(`SEEDING Default TimeLogs & Activities`));
		const { id: tenantId } = tenant;
		const { id: organizationId } = organization;
		const createdTimesheets = await dataSource.manager.findBy(Timesheet, {
			tenantId,
			organizationId
		});
		const timeSlots: ITimeSlot[] = await createRandomTimeLogs(
			dataSource,
			config,
			tenant,
			createdTimesheets
		);
		/**
		 * Recalculate Timesheet Activities
		 */
		await recalculateTimesheetActivity(
			dataSource,
			createdTimesheets
		);
		await createRandomActivities(
			dataSource,
			tenant,
			timeSlots
		);
	} catch (error) {
		console.log(chalk.red(`SEEDING Default TimeLogs & Activities`, error));
	}
};

export const createRandomTimesheet = async (
	dataSource: DataSource,
	config: Partial<IPluginConfig>,
	tenants: ITenant[]
) => {
	for await (const tenant of tenants) {
		try {
			const timesheets: ITimesheet[] = [];
			const { id: tenantId } = tenant;
			const employees = await dataSource.getRepository(Employee).find({
				where: {
					tenantId: tenantId
				},
				relations: {
					organization: true
				}
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
			await dataSource.getRepository(Timesheet).save(timesheets);
		} catch (error) {
			console.log(chalk.red(`SEEDING Default Timesheet`, error));
		}
	}

	try {
		console.log(chalk.green(`SEEDING Random TimeLogs & Activities`));
		for await (const tenant of tenants) {
			const { id: tenantId } = tenant;
			const createdTimesheets = await dataSource.manager.findBy(Timesheet, {
				tenantId
			});
			const timeSlots: ITimeSlot[] = await createRandomTimeLogs(
				dataSource,
				config,
				tenant,
				createdTimesheets
			);
			/**
			 * Recalculate Timesheet Activities
			 */
			await recalculateTimesheetActivity(
				dataSource,
				createdTimesheets
			);
			await createRandomActivities(
				dataSource,
				tenant,
				timeSlots
			);
		}
	} catch (error) {
		console.log(chalk.red(`SEEDING Random TimeLogs & Activities`, error));
	}
};
