import { BadRequestException } from '@nestjs/common';
import { Brackets, DataSource, WhereExpressionBuilder } from 'typeorm';
import { faker } from '@faker-js/faker';
import { chain, chunk, omit } from 'underscore';
import * as moment from 'moment';
import { ApplicationPluginConfig } from '@gauzy/common';
import {
	TimeLogSourceEnum,
	TimeLogType,
	ITimeSlot,
	IOrganizationProject,
	ITenant,
	ITimesheet,
	ITimeLog
} from '@gauzy/contracts';
import { getRandomElement, isEmpty } from '@gauzy/utils';
import { createRandomScreenshot } from '../screenshot/screenshot.seed';
import { createTimeSlots } from '../time-slot/time-slot.seed';
import { OrganizationProject, Screenshot, TimeLog, Timesheet, TimeSlot } from './../../core/entities/internal';
import { getDateRangeFormat } from './../../core/utils';
import { prepareSQLQuery as p } from './../../database/database.helper';

/**
 * Generates and saves random time logs for the provided timesheets.
 *
 * This function creates random time logs for each timesheet provided in the `timeSheets` array.
 * It uses the provided data source to interact with the database and save the generated time logs.
 *
 * @param {DataSource} dataSource - The database connection or ORM data source used to execute queries.
 * @param {Partial<ApplicationPluginConfig>} config - Configuration for generating random data (e.g., settings, paths).
 * @param {ITenant} tenant - The tenant to associate with the generated time logs.
 * @param {ITimesheet[]} timeSheets - An array of timesheets for which random time logs will be created.
 * @returns {Promise<void>} - A promise that resolves when the time logs have been generated and saved.
 */
export const createRandomTimeLogs = async (
	dataSource: DataSource,
	config: Partial<ApplicationPluginConfig>,
	tenant: ITenant,
	timeSheets: ITimesheet[]
): Promise<ITimeSlot[]> => {
	const query = dataSource.getRepository(OrganizationProject).createQueryBuilder('organization_project');
	const projects: IOrganizationProject[] = await query
		.leftJoinAndSelect(`${query.alias}.tasks`, 'tasks')
		.leftJoinAndSelect(`${query.alias}.organizationContact`, 'organizationContact')
		.andWhere(p(`"${query.alias}"."tenantId" =:tenantId`), { tenantId: tenant.id })
		.andWhere(p(`"tasks"."tenantId" =:tenantId`), { tenantId: tenant.id })
		.getMany();
	if (isEmpty(projects)) {
		console.warn(`Warning: projects not found for tenantId: ${tenant.id}, RandomTimesheet will not be created`);
		return;
	}
	const timeSheetChunk = chunk(timeSheets, 5) as Array<ITimesheet[]>;
	const allTimeSlots: ITimeSlot[] = [];
	for (let timeSheetChunkIndex = 0; timeSheetChunkIndex < timeSheetChunk.length; timeSheetChunkIndex++) {
		const timeLogs: ITimeLog[] = [];
		for (let timeSheetIndex = 0; timeSheetIndex < timeSheetChunk[timeSheetChunkIndex].length; timeSheetIndex++) {
			const timesheet = timeSheetChunk[timeSheetChunkIndex][timeSheetIndex];
			const randomDays = chain([0, 1, 2, 3, 4, 5, 6])
				.shuffle()
				.take(faker.number.int({ min: 3, max: 5 }))
				.values()
				.value();

			for (let index = 0; index <= randomDays.length; index++) {
				const day = randomDays[index];
				const date = moment(timesheet.startedAt).add(day, 'day').toDate();

				const range = dateRanges(moment.utc(date).startOf('day').toDate(), moment.utc(date).toDate());

				for (let rangeIndex = 0; rangeIndex < range.length; rangeIndex++) {
					const { startedAt, stoppedAt } = range[rangeIndex];
					if (moment.utc().isAfter(moment.utc(stoppedAt))) {
						const project = getRandomElement(projects);
						const task = getRandomElement(project.tasks);

						const source: TimeLogSourceEnum = faker.helpers.arrayElement(
							Object.keys(TimeLogSourceEnum)
						) as TimeLogSourceEnum;

						let logType: TimeLogType = TimeLogType.TRACKED;
						if (source === TimeLogSourceEnum.WEB_TIMER || source === TimeLogSourceEnum.BROWSER_EXTENSION) {
							logType = TimeLogType.MANUAL;
						}

						const { employeeId, organizationId } = timesheet;
						const timeLog = new TimeLog({
							employeeId,
							organizationId,
							timesheet,
							project,
							task,
							startedAt: moment.utc(startedAt).toDate(),
							stoppedAt: moment.utc(stoppedAt).toDate(),
							logType,
							source,
							tenant
						});
						timeLog.organizationContact = project.organizationContact;
						timeLog.description = faker.lorem.sentence(faker.number.int(10));
						timeLog.isBillable = faker.helpers.arrayElement([true, false]);
						timeLog.isRunning = false;
						timeLogs.push(timeLog);
					}
				}
			}
		}
		const savedTimeLogs = await dataSource.getRepository(TimeLog).save(timeLogs);

		const trackedTimeSlots: ITimeSlot[] = [];
		for await (const timeLog of savedTimeLogs) {
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
		for await (const timeSlot of trackedTimeSlots) {
			const { tenantId, organizationId, startedAt, stoppedAt, employeeId } = timeSlot;
			const randomScreenshots = await createRandomScreenshot(
				config,
				tenantId,
				organizationId,
				employeeId,
				startedAt,
				stoppedAt
			);
			const screenshots = randomScreenshots.map((item) => new Screenshot(omit(item, ['timeSlotId'])));
			const savedScreenshots = await dataSource.getRepository(Screenshot).save(screenshots);
			const newTimeSlot = new TimeSlot({
				...omit(timeSlot),
				screenshots: savedScreenshots
			});
			newTrackedTimeSlots.push(newTimeSlot);
		}
		await dataSource.getRepository(TimeSlot).save(newTrackedTimeSlots);

		allTimeSlots.push(...newTrackedTimeSlots);
	}
	return allTimeSlots;
};

/**
 * Generates a range of dates with start and stop timestamps.
 *
 * The function creates a random date range where the `startedAt` date
 * is generated within the provided `start` and `stop` range, and the `stoppedAt`
 * date is generated between `startedAt` and up to 2 hours after `startedAt`.
 *
 * @param {Date} start - The earliest possible start date for the range.
 * @param {Date} stop - The latest possible stop date for the range.
 * @returns {Array<{ startedAt: Date; stoppedAt: Date }>} - An array containing a single object
 * with `startedAt` and `stoppedAt` timestamps.
 */
function dateRanges(start: Date, stop: Date): Array<{ startedAt: Date; stoppedAt: Date }> {
	const range = [];

	// Generate a random start date within the range
	const startedAt = faker.date.between({ from: start, to: stop });

	// Generate a random stop date between startedAt and 2 hours after startedAt
	const stoppedAt = faker.date.between({
		from: startedAt,
		to: moment(startedAt).add(2, 'hours').toDate()
	});

	// Add the range to the result array
	range.push({ startedAt, stoppedAt });

	return range;
}

/**
 * Recalculates the activity for the given timesheets by interacting with the data source.
 *
 * This function performs recalculation of activities for a list of timesheets. It may involve
 * querying the database using the provided data source to update activity metrics based on the
 * timesheet records.
 *
 * @param {DataSource} dataSource - The database connection or ORM data source used to execute queries.
 * @param {ITimesheet[]} timesheets - An array of timesheet objects to process and recalculate activities for.
 * @returns {Promise<void>} - A promise that resolves when the recalculation process is complete.
 */
export const recalculateTimesheetActivity = async (dataSource: DataSource, timesheets: ITimesheet[]): Promise<void> => {
	for await (const timesheet of timesheets) {
		const { id, startedAt, stoppedAt, employeeId, organizationId, tenantId } = timesheet;
		const { start, end } = getDateRangeFormat(moment.utc(startedAt), moment.utc(stoppedAt));
		const query = dataSource.getRepository(TimeSlot).createQueryBuilder();
		const timeSlot = await query
			.select('SUM(duration)', 'duration')
			.addSelect('AVG(keyboard)', 'keyboard')
			.addSelect('AVG(mouse)', 'mouse')
			.addSelect('AVG(overall)', 'overall')
			.where(
				new Brackets((qb: WhereExpressionBuilder) => {
					qb.andWhere(p(`"${query.alias}"."employeeId" = :employeeId`), { employeeId });
					qb.andWhere(p(`"${query.alias}"."organizationId" = :organizationId`), { organizationId });
					qb.andWhere(p(`"${query.alias}"."tenantId" = :tenantId`), { tenantId });
					qb.andWhere(
						p(`"${query.alias}"."startedAt" >= :startedAt AND "${query.alias}"."startedAt" < :stoppedAt`),
						{
							startedAt: start,
							stoppedAt: end
						}
					);
				})
			)
			.getRawOne();
		try {
			await dataSource.getRepository(Timesheet).update(id, {
				duration: Math.round(timeSlot.duration),
				keyboard: Math.round(timeSlot.keyboard),
				mouse: Math.round(timeSlot.mouse),
				overall: Math.round(timeSlot.overall)
			});
		} catch (error) {
			throw new BadRequestException(
				`Can\'t update timesheet for employee-${employeeId} of organization-${organizationId}`
			);
		}
	}
};
