import { Injectable } from '@nestjs/common';
import { Brackets, SelectQueryBuilder, WhereExpressionBuilder } from 'typeorm';
import { reduce, pluck, pick, mapObject, groupBy, chain } from 'underscore';
import * as moment from 'moment';
import * as chalk from 'chalk';
import {
	PermissionsEnum,
	IGetActivitiesStatistics,
	IGetTimeSlotStatistics,
	IGetTasksStatistics,
	IGetProjectsStatistics,
	IGetMembersStatistics,
	IGetCountsStatistics,
	ICountsStatistics,
	IMembersStatistics,
	IActivitiesStatistics,
	ITimeSlotStatistics,
	IProjectsStatistics,
	IGetManualTimesStatistics,
	IManualTimesStatistics,
	TimeLogType,
	ITimeLog,
	IWeeklyStatisticsActivities,
	ITodayStatisticsActivities
} from '@gauzy/contracts';
import { ArraySum, isNotEmpty } from '@gauzy/common';
import {
	ConfigService,
	DatabaseTypeEnum,
	MultiORM,
	isBetterSqlite3,
	isMySQL,
	isPostgres,
	isSqlite
} from '@gauzy/config';
import {
	concateUserNameExpression,
	getActivityDurationQueryString,
	getDurationQueryString,
	getTotalDurationQueryString
} from './statistic.helper';
import { prepareSQLQuery as p } from './../../database/database.helper';
import { RequestContext } from '../../core/context';
import { TimeLog, TimeSlot } from './../../core/entities/internal';
import { MultiORMEnum, getDateRangeFormat, getORMType } from './../../core/utils';
import { TypeOrmTimeSlotRepository } from '../../time-tracking/time-slot/repository/type-orm-time-slot.repository';
import { TypeOrmEmployeeRepository } from '../../employee/repository/type-orm-employee.repository';
import { TypeOrmActivityRepository } from '../activity/repository/type-orm-activity.repository';
import { MikroOrmTimeLogRepository, TypeOrmTimeLogRepository } from '../time-log/repository';

// Get the type of the Object-Relational Mapping (ORM) used in the application.
const ormType: MultiORM = getORMType();

@Injectable()
export class StatisticService {
	protected ormType: MultiORM = ormType;

	constructor(
		private readonly typeOrmTimeSlotRepository: TypeOrmTimeSlotRepository,
		private readonly typeOrmEmployeeRepository: TypeOrmEmployeeRepository,
		private readonly typeOrmActivityRepository: TypeOrmActivityRepository,
		private readonly typeOrmTimeLogRepository: TypeOrmTimeLogRepository,
		private readonly mikroOrmTimeLogRepository: MikroOrmTimeLogRepository,
		private readonly configService: ConfigService
	) {}

	/**
	 * Fetches the overall tracked time for time slots, aggregating data from related time logs.
	 *
	 * This function constructs a database query to join the `time_slot` and `time_log` entities,
	 * calculating the overall duration. It returns the total aggregated duration in hours.
	 *
	 * @returns {Promise<number>} The overall tracked time as a summed duration value in hours.
	 */
	async getOverallTrackedTime(): Promise<number> {
		// Retrieve the database type from the configuration service
		const dbType = this.configService.dbConnectionOptions.type;

		// Create a query builder for the TimeSlot entity
		const query = this.typeOrmTimeSlotRepository.createQueryBuilder('time_slot');

		// Join with the time_log table
		query.innerJoin('time_slot.timeLogs', 'time_log');

		// Select the sum of the overall duration, dynamically based on the DB type
		query.select(getTotalDurationQueryString(dbType, 'time_log'), 'overall_duration');

		// Execute the query and fetch the raw result from the database
		const overallDuration = await query.getRawOne();

		// Extract the overall duration in seconds
		const overallDurationInSeconds = overallDuration?.overall_duration ?? 0;
		console.log('Overall Tracked Time Duration (seconds):', overallDurationInSeconds);

		// Convert the overall duration in seconds to hours
		const overallDurationInHours = overallDurationInSeconds / 3600;
		console.log('Overall Tracked Time Duration (hours):', overallDurationInHours);

		return overallDurationInHours;
	}

	/**
	 * Retrieves time tracking dashboard count statistics, including the total number of employees worked,
	 * projects worked, weekly activities, and today's activities based on the given request.
	 *
	 * This function executes multiple asynchronous operations concurrently to fetch the necessary statistics
	 * and constructs a comprehensive response object with aggregated data.
	 *
	 * @param {IGetCountsStatistics} request - The request object containing filters and parameters to fetch
	 * the counts statistics, such as organizationId, date ranges, employeeIds, projectIds, and other filtering criteria.
	 *
	 * @returns {Promise<ICountsStatistics>} - Returns a promise that resolves with the counts statistics object,
	 * containing total employees count, projects count, weekly activity, weekly duration, today's activity, and today's duration.
	 */
	async getCounts(request: IGetCountsStatistics): Promise<ICountsStatistics> {
		// Retrieve statistics counts concurrently
		const [employeesCount, projectsCount, weekActivities, todayActivities] = await Promise.all([
			this.getEmployeeWorkedCounts(request),
			this.getProjectWorkedCounts(request),
			this.getWeeklyStatisticsActivities(request),
			this.getTodayStatisticsActivities(request)
		]);

		// Construct and return the response object
		return {
			employeesCount,
			projectsCount,
			weekActivities: parseFloat(weekActivities.overall.toFixed(2)),
			weekDuration: weekActivities.duration,
			todayActivities: parseFloat(todayActivities.overall.toFixed(2)),
			todayDuration: todayActivities.duration
		};
	}

	/**
	 * Get average activity and total duration of the work for the week.
	 *
	 * @param request - The request object containing filters and parameters
	 * @returns {Promise<IStatisticsActivities>} - The weekly activity statistics
	 */
	async getWeeklyStatisticsActivities(request: IGetCountsStatistics): Promise<IWeeklyStatisticsActivities> {
		let {
			organizationId,
			startDate,
			endDate,
			employeeIds = [],
			projectIds = [],
			teamIds = [],
			activityLevel,
			logType,
			source,
			onlyMe: isOnlyMeSelected // Determine if the request specifies to retrieve data for the current user only
		} = request;

		// Retrieves the database type from the configuration service.
		const dbType = this.configService.dbConnectionOptions.type;
		const user = RequestContext.currentUser(); // Retrieve the current user
		const tenantId = RequestContext.currentTenantId() ?? request.tenantId; // Retrieve the current tenant ID

		// Check if the current user has the permission to change the selected employee
		const hasChangeSelectedEmployeePermission: boolean = RequestContext.hasPermission(
			PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
		);

		// Set employeeIds based on user conditions and permissions
		if (user.employeeId && (isOnlyMeSelected || !hasChangeSelectedEmployeePermission)) {
			employeeIds = [user.employeeId];
		}

		let weekActivities = {
			overall: 0,
			duration: 0
		};

		// Define the start and end dates
		const { start, end } = getDateRangeFormat(
			moment.utc(startDate || moment().startOf('week')),
			moment.utc(endDate || moment().endOf('week'))
		);

		// Create a query builder for the TimeSlot entity
		const query = this.typeOrmTimeSlotRepository.createQueryBuilder();
		query
			.innerJoin(`${query.alias}.timeLogs`, 'time_log')
			.select([
				getDurationQueryString(dbType, 'time_log', query.alias) + ' AS week_duration',
				p(`COALESCE(SUM("${query.alias}"."overall"), 0)`) + ' AS overall',
				p(`COALESCE(SUM("${query.alias}"."duration"), 0)`) + ' AS duration',
				p(`COUNT("${query.alias}"."id")`) + ' AS time_slot_count'
			]);

		// Base where conditions
		query
			.where(`${query.alias}.tenantId = :tenantId`, { tenantId })
			.andWhere(`${query.alias}.organizationId = :organizationId`, { organizationId })
			.andWhere(`time_log.tenantId = :tenantId`, { tenantId })
			.andWhere(`time_log.organizationId = :organizationId`, { organizationId });

		query
			.andWhere(`${query.alias}.startedAt BETWEEN :startDate AND :endDate`, {
				startDate: start,
				endDate: end
			})
			.andWhere(`time_log.startedAt BETWEEN :startDate AND :endDate`, { startDate: start, endDate: end })
			.andWhere(`time_log.stoppedAt >= time_log.startedAt`);

		// Applying optional filters conditionally to avoid unnecessary execution
		if (isNotEmpty(employeeIds)) {
			query.andWhere(`${query.alias}.employeeId IN (:...employeeIds)`, { employeeIds });
			query.andWhere(`time_log.employeeId IN (:...employeeIds)`, { employeeIds });
		}

		// Filter by project
		if (isNotEmpty(projectIds)) {
			query.andWhere(`time_log.projectId IN (:...projectIds)`, { projectIds });
		}

		// Filter by team
		if (isNotEmpty(teamIds)) {
			query.andWhere(`time_log.organizationTeamId IN (:...teamIds)`, { teamIds });
		}

		// Filter by activity level
		if (isNotEmpty(activityLevel)) {
			const startLevel = activityLevel.start * 6; // Start level for activity level in seconds
			const endLevel = activityLevel.end * 6; // End level for activity level in seconds

			query.andWhere(`${query.alias}.overall BETWEEN :startLevel AND :endLevel`, {
				startLevel,
				endLevel
			});
		}

		// Filter by log type
		if (isNotEmpty(logType)) {
			query.andWhere(`time_log.logType IN (:...logType)`, { logType });
		}

		// Filter by source
		if (isNotEmpty(source)) {
			query.andWhere(`time_log.source IN (:...source)`, { source });
		}

		// Group by time_log.id to get the total duration and overall for each time slot
		const weekTimeStatistics = await query.groupBy(p(`"time_log"."id"`)).getRawMany();
		console.log('weekly time statistics activity', JSON.stringify(weekTimeStatistics));

		// Initialize variables to accumulate values
		let totalWeekDuration = 0;
		let totalOverall = 0;
		let totalDuration = 0;

		// Iterate over the weekTimeStatistics array once to calculate all values
		for (const stat of weekTimeStatistics) {
			totalWeekDuration += Number(stat.week_duration) || 0;
			totalOverall += Number(stat.overall) || 0;
			totalDuration += Number(stat.duration) || 0;
		}

		// Calculate the week percentage, avoiding division by zero
		const weekPercentage = totalDuration > 0 ? (totalOverall * 100) / totalDuration : 0;

		// Assign the calculated values to weekActivities
		weekActivities['duration'] = totalWeekDuration;
		weekActivities['overall'] = weekPercentage;

		return weekActivities;
	}

	/**
	 * Get average activity and total duration of the work for today.
	 *
	 * @param request - The request object containing filters and parameters
	 * @returns {Promise<IStatisticsActivities>} - Today's activity statistics
	 */
	async getTodayStatisticsActivities(request: IGetCountsStatistics): Promise<ITodayStatisticsActivities> {
		// Destructure the necessary properties from the request with default values
		let {
			organizationId,
			todayStart,
			todayEnd,
			employeeIds = [],
			projectIds = [],
			teamIds = [],
			activityLevel,
			onlyMe: isOnlyMeSelected, // Determine if the request specifies to retrieve data for the current user only
			logType,
			source
		} = request || {};

		// Retrieves the database type from the configuration service.
		const dbType = this.configService.dbConnectionOptions.type;
		const user = RequestContext.currentUser(); // Retrieve the current user
		const tenantId = RequestContext.currentTenantId() ?? request.tenantId; // Retrieve the current tenant ID

		// Check if the current user has the permission to change the selected employee
		const hasChangeSelectedEmployeePermission: boolean = RequestContext.hasPermission(
			PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
		);

		/**
		 * Set employeeIds based on user conditions and permissions
		 */
		if (user.employeeId && (isOnlyMeSelected || !hasChangeSelectedEmployeePermission)) {
			employeeIds = [user.employeeId];
		}

		// Get average activity and total duration of the work for today.
		let todayActivities = {
			overall: 0,
			duration: 0
		};

		// Get date range for today
		const { start: startToday, end: endToday } = getDateRangeFormat(
			moment.utc(todayStart || moment().startOf('day')),
			moment.utc(todayEnd || moment().endOf('day'))
		);

		// Create a query builder for the TimeSlot entity
		const query = this.typeOrmTimeSlotRepository.createQueryBuilder();

		// Define the base select statements and joins
		query
			.innerJoin(`${query.alias}.timeLogs`, 'time_log')
			.select([
				getDurationQueryString(dbType, 'time_log', query.alias) + ' AS today_duration',
				p(`COALESCE(SUM("${query.alias}"."overall"), 0)`) + ' AS overall',
				p(`COALESCE(SUM("${query.alias}"."duration"), 0)`) + ' AS duration',
				p(`COUNT("${query.alias}"."id")`) + ' AS time_slot_count'
			]);

		// Base where conditions
		query
			.andWhere(`${query.alias}.tenantId = :tenantId`, { tenantId })
			.andWhere(`${query.alias}.organizationId = :organizationId`, { organizationId })
			.andWhere(`time_log.tenantId = :tenantId`, { tenantId })
			.andWhere(`time_log.organizationId = :organizationId`, { organizationId });

		query
			.andWhere(p(`"${query.alias}"."startedAt" BETWEEN :startDate AND :endDate`), {
				startDate: startToday,
				endDate: endToday
			})
			.andWhere(p(`"time_log"."startedAt" BETWEEN :startDate AND :endDate`), {
				startDate: startToday,
				endDate: endToday
			})
			.andWhere(`time_log.stoppedAt >= time_log.startedAt`);

		// Optional filters
		if (isNotEmpty(employeeIds)) {
			query
				.andWhere(p(`"${query.alias}"."employeeId" IN (:...employeeIds)`), { employeeIds })
				.andWhere(p(`"time_log"."employeeId" IN (:...employeeIds)`), { employeeIds });
		}

		if (isNotEmpty(teamIds)) {
			query.andWhere(p(`"time_log"."organizationTeamId" IN (:...teamIds)`), { teamIds });
		}

		if (isNotEmpty(projectIds)) {
			query.andWhere(p(`"time_log"."projectId" IN (:...projectIds)`), { projectIds });
		}

		if (isNotEmpty(activityLevel)) {
			/**
			 * Activity Level should be 0-100%
			 * So, we have to convert it into a 10-minute TimeSlot by multiplying by 6
			 */
			const startLevel = activityLevel.start * 6;
			const endLevel = activityLevel.end * 6;

			query.andWhere(p(`"${query.alias}"."overall" BETWEEN :startLevel AND :endLevel`), {
				startLevel,
				endLevel
			});
		}

		if (isNotEmpty(logType)) {
			query.andWhere(p(`"time_log"."logType" IN (:...logType)`), { logType });
		}

		if (isNotEmpty(source)) {
			query.andWhere(p(`"time_log"."source" IN (:...source)`), { source });
		}

		const todayTimeStatistics = await query.groupBy(p(`"time_log"."id"`)).getRawMany();
		console.log('today time statistics activity', JSON.stringify(todayTimeStatistics));

		// Initialize variables to accumulate values
		let totalTodayDuration = 0;
		let totalOverall = 0;
		let totalDuration = 0;

		// Iterate over the todayTimeStatistics array once to calculate all values
		for (const stat of todayTimeStatistics) {
			totalTodayDuration += Number(stat.today_duration) || 0;
			totalOverall += Number(stat.overall) || 0;
			totalDuration += Number(stat.duration) || 0;
		}

		// Calculate today's percentage, avoiding division by zero
		const todayPercentage = totalDuration > 0 ? (totalOverall * 100) / totalDuration : 0;

		// Assign the calculated values to todayActivities
		todayActivities['duration'] = totalTodayDuration;
		todayActivities['overall'] = todayPercentage;

		return todayActivities;
	}

	/**
	 * GET Time Tracking Dashboard Worked Members Statistics
	 *
	 * @param request
	 * @returns
	 */
	async getMembers(request: IGetMembersStatistics): Promise<IMembersStatistics[]> {
		// Destructure properties from the request with default values where necessary
		let {
			organizationId,
			startDate,
			endDate,
			todayStart,
			todayEnd,
			employeeIds = [],
			projectIds = [],
			teamIds = []
		} = request || {};

		// Retrieves the database type from the configuration service.
		const dbType = this.configService.dbConnectionOptions.type;
		const user = RequestContext.currentUser(); // Retrieve the current user
		const tenantId = RequestContext.currentTenantId() ?? request.tenantId; // Retrieve the current tenant ID

		// Get the start and end date for the weekly statistics
		const { start: weeklyStart, end: weeklyEnd } = getDateRangeFormat(
			moment.utc(startDate || moment().startOf('week')),
			moment.utc(endDate || moment().endOf('week'))
		);

		// Check if the current user has the permission to change the selected employee
		const hasChangeSelectedEmployeePermission: boolean = RequestContext.hasPermission(
			PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
		);

		// Set employeeIds based on user conditions and permissions
		if (user.employeeId || (!hasChangeSelectedEmployeePermission && user.employeeId)) {
			employeeIds = [user.employeeId];
		}

		// Create a query builder for the Employee entity
		const query = this.typeOrmEmployeeRepository.createQueryBuilder();

		let employees: IMembersStatistics[] = await query
			.select(p(`"${query.alias}".id`))
			// Builds a SELECT statement for the "user_name" column based on the database type.
			.addSelect(p(`${concateUserNameExpression(dbType)}`), 'user_name')
			.addSelect(p(`"user"."imageUrl"`), 'user_image_url')
			.addSelect(getTotalDurationQueryString(dbType, 'timeLogs'), `duration`)
			// Add isOnline and isAway from the employee table
			.addSelect(p(`"${query.alias}"."isOnline"`), 'isOnline')
			.addSelect(p(`"${query.alias}"."isAway"`), 'isAway')
			.innerJoin(`${query.alias}.user`, 'user')
			.innerJoin(`${query.alias}.timeLogs`, 'timeLogs')
			.innerJoin(`timeLogs.timeSlots`, 'time_slot')
			.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					qb.andWhere(p(`"${query.alias}"."tenantId" = :tenantId`), { tenantId });
					qb.andWhere(p(`"${query.alias}"."organizationId" = :organizationId`), { organizationId });
				})
			)
			.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					qb.andWhere(p(`"timeLogs"."tenantId" = :tenantId`), { tenantId });
					qb.andWhere(p(`"timeLogs"."organizationId" = :organizationId`), { organizationId });
				})
			)
			.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					qb.andWhere(p(`"timeLogs"."startedAt" BETWEEN :weeklyStart AND :weeklyEnd`), {
						weeklyStart,
						weeklyEnd
					});
					qb.andWhere(p(`"time_slot"."startedAt" BETWEEN :weeklyStart AND :weeklyEnd`), {
						weeklyStart,
						weeklyEnd
					});
					/**
					 * If Employee Selected
					 */
					if (isNotEmpty(employeeIds)) {
						qb.andWhere(p(`"${query.alias}"."id" IN(:...employeeIds)`), { employeeIds });
						qb.andWhere(p(`"timeLogs"."employeeId" IN(:...employeeIds)`), { employeeIds });
					}
					/**
					 * If Project Selected
					 */
					if (isNotEmpty(projectIds)) {
						qb.andWhere(p(`"timeLogs"."projectId" IN (:...projectIds)`), { projectIds });
					}
					if (isNotEmpty(teamIds)) {
						qb.andWhere(p(`"timeLogs"."organizationTeamId" IN (:...teamIds)`), { teamIds });
					}
				})
			)
			.groupBy(p(`"${query.alias}"."id"`))
			.addGroupBy(p(`"${query.alias}"."isOnline"`))
			.addGroupBy(p(`"${query.alias}"."isAway"`))
			.addGroupBy(p(`"user"."id"`))
			.orderBy('duration', 'DESC')
			.getRawMany();

		if (employees.length > 0) {
			const employeeIds = pluck(employees, 'id');

			/**
			 * Weekly Member Activity
			 */
			const weekTimeQuery = this.typeOrmTimeSlotRepository.createQueryBuilder('time_slot');
			weekTimeQuery
				.select(getDurationQueryString(dbType, 'timeLogs', weekTimeQuery.alias), `week_duration`)
				.addSelect(p(`COALESCE(SUM("${weekTimeQuery.alias}"."overall"), 0)`), `overall`)
				.addSelect(p(`COALESCE(SUM("${weekTimeQuery.alias}"."duration"), 0)`), `duration`)
				.addSelect(p(`COUNT("${weekTimeQuery.alias}"."id")`), `time_slot_count`)
				.addSelect(`${weekTimeQuery.alias}.employeeId`, 'employeeId')
				.innerJoin(`${weekTimeQuery.alias}.timeLogs`, 'timeLogs')
				.andWhere(
					new Brackets((qb: WhereExpressionBuilder) => {
						qb.andWhere(p(`"${weekTimeQuery.alias}"."tenantId" = :tenantId`), { tenantId });
						qb.andWhere(p(`"${weekTimeQuery.alias}"."organizationId" = :organizationId`), {
							organizationId
						});
					})
				)
				.andWhere(
					new Brackets((qb: WhereExpressionBuilder) => {
						qb.andWhere(p(`"timeLogs"."tenantId" = :tenantId`), { tenantId });
						qb.andWhere(p(`"timeLogs"."organizationId" = :organizationId`), { organizationId });
					})
				)
				.andWhere(
					new Brackets((qb: WhereExpressionBuilder) => {
						qb.andWhere(p(`"timeLogs"."startedAt" BETWEEN :weeklyStart AND :weeklyEnd`), {
							weeklyStart,
							weeklyEnd
						});
						qb.andWhere(p(`"${weekTimeQuery.alias}"."startedAt" BETWEEN :weeklyStart AND :weeklyEnd`), {
							weeklyStart,
							weeklyEnd
						});
						/**
						 * If Employee Selected
						 */
						if (isNotEmpty(employeeIds)) {
							qb.andWhere(p(`"${weekTimeQuery.alias}"."employeeId" IN(:...employeeIds)`), {
								employeeIds
							});
							qb.andWhere(p(`"timeLogs"."employeeId" IN(:...employeeIds)`), {
								employeeIds
							});
						}
						/**
						 * If Project Selected
						 */
						if (isNotEmpty(projectIds)) {
							qb.andWhere(p(`"timeLogs"."projectId" IN(:...projectIds)`), {
								projectIds
							});
						}
						if (isNotEmpty(teamIds)) {
							qb.andWhere(p(`"timeLogs"."organizationTeamId" IN (:...teamIds)`), { teamIds });
						}
					})
				)
				.groupBy(`timeLogs.id`)
				.addGroupBy(`${weekTimeQuery.alias}.employeeId`);

			let weekTimeSlots: any = await weekTimeQuery.getRawMany();

			weekTimeSlots = mapObject(groupBy(weekTimeSlots, 'employeeId'), (values, employeeId) => {
				const weekDuration = reduce(pluck(values, 'week_duration'), ArraySum, 0);
				const weekPercentage =
					(reduce(pluck(values, 'overall'), ArraySum, 0) * 100) /
					reduce(pluck(values, 'duration'), ArraySum, 0);
				return {
					employeeId,
					duration: weekDuration,
					overall: weekPercentage
				};
			});
			weekTimeSlots = chain(weekTimeSlots)
				.map((weekTimeSlot: any) => {
					if (weekTimeSlot && weekTimeSlot.overall) {
						weekTimeSlot.overall = parseFloat(weekTimeSlot.overall as string).toFixed(1);
					}
					return weekTimeSlot;
				})
				.indexBy('employeeId')
				.value();

			/**
			 * Daily Member Activity
			 */
			let dayTimeQuery = this.typeOrmTimeSlotRepository.createQueryBuilder('time_slot');
			dayTimeQuery
				.select(getDurationQueryString(dbType, 'timeLogs', dayTimeQuery.alias), `today_duration`)
				.addSelect(p(`COALESCE(SUM("${dayTimeQuery.alias}"."overall"), 0)`), `overall`)
				.addSelect(p(`COALESCE(SUM("${dayTimeQuery.alias}"."duration"), 0)`), `duration`)
				.addSelect(p(`COUNT("${dayTimeQuery.alias}"."id")`), `time_slot_count`)
				.addSelect(`${dayTimeQuery.alias}.employeeId`, 'employeeId')
				.innerJoin(`${dayTimeQuery.alias}.timeLogs`, 'timeLogs')
				.andWhere(
					new Brackets((qb: WhereExpressionBuilder) => {
						qb.andWhere(p(`"${dayTimeQuery.alias}"."tenantId" = :tenantId`), { tenantId });
						qb.andWhere(p(`"${dayTimeQuery.alias}"."organizationId" = :organizationId`), {
							organizationId
						});
					})
				)
				.andWhere(
					new Brackets((qb: WhereExpressionBuilder) => {
						qb.andWhere(p(`"timeLogs"."tenantId" = :tenantId`), { tenantId });
						qb.andWhere(p(`"timeLogs"."organizationId" = :organizationId`), { organizationId });
					})
				)
				.andWhere(
					new Brackets((qb: WhereExpressionBuilder) => {
						const { start: startToday, end: endToday } = getDateRangeFormat(
							moment.utc(todayStart || moment().startOf('day')),
							moment.utc(todayEnd || moment().endOf('day'))
						);
						qb.where(p(`"timeLogs"."startedAt" BETWEEN :startToday AND :endToday`), {
							startToday,
							endToday
						});
						qb.andWhere(p(`"${dayTimeQuery.alias}"."startedAt" BETWEEN :startToday AND :endToday`), {
							startToday,
							endToday
						});
						/**
						 * If Employee Selected
						 */
						if (isNotEmpty(employeeIds)) {
							qb.andWhere(p(`"${dayTimeQuery.alias}"."employeeId" IN(:...employeeIds)`), { employeeIds });
							qb.andWhere(p(`"timeLogs"."employeeId" IN(:...employeeIds)`), { employeeIds });
						}
						/**
						 * If Project Selected
						 */
						if (isNotEmpty(projectIds)) {
							qb.andWhere(p(`"timeLogs"."projectId" IN(:...projectIds)`), { projectIds });
						}
						if (isNotEmpty(teamIds)) {
							qb.andWhere(p(`"timeLogs"."organizationTeamId" IN (:...teamIds)`), { teamIds });
						}
					})
				)
				.groupBy(`timeLogs.id`)
				.addGroupBy(`${dayTimeQuery.alias}.employeeId`);

			let dayTimeSlots: any = await dayTimeQuery.getRawMany();
			dayTimeSlots = mapObject(groupBy(dayTimeSlots, 'employeeId'), (values, employeeId) => {
				const todayDuration = reduce(pluck(values, 'today_duration'), ArraySum, 0);
				const todayPercentage =
					(reduce(pluck(values, 'overall'), ArraySum, 0) * 100) /
					reduce(pluck(values, 'duration'), ArraySum, 0);
				return {
					employeeId,
					duration: todayDuration,
					overall: todayPercentage
				};
			});
			dayTimeSlots = chain(dayTimeSlots)
				.map((dayTimeSlot: any) => {
					if (dayTimeSlot && dayTimeSlot.overall) {
						dayTimeSlot.overall = parseFloat(dayTimeSlot.overall as string).toFixed(1);
					}
					return dayTimeSlot;
				})
				.indexBy('employeeId')
				.value();

			for (let index = 0; index < employees.length; index++) {
				const member = employees[index];

				member.weekTime = weekTimeSlots[member.id];
				member.todayTime = dayTimeSlots[member.id];

				member.user = {
					name: member.user_name,
					imageUrl: member.user_image_url
				};

				delete member.user_name;
				delete member.user_image_url;

				const weekHoursQuery = this.typeOrmEmployeeRepository.createQueryBuilder();
				weekHoursQuery
					.innerJoin(`${weekHoursQuery.alias}.timeLogs`, 'timeLogs')
					.innerJoin(`timeLogs.timeSlots`, 'time_slot')
					.select(getTotalDurationQueryString(dbType, 'timeLogs'), `duration`)
					.addSelect(
						// -- why we minus 1 if MySQL is selected, Sunday DOW in postgres is 0, in MySQL is 1
						// -- in case no database type is selected we return "0" as the DOW
						isSqlite() || isBetterSqlite3()
							? `(strftime('%w', timeLogs.startedAt))`
							: isPostgres()
							? 'EXTRACT(DOW FROM "timeLogs"."startedAt")'
							: isMySQL()
							? p('DayOfWeek("timeLogs"."startedAt") - 1')
							: '0',
						'day'
					)
					.andWhere(p(`"${weekHoursQuery.alias}"."id" = :memberId`), { memberId: member.id })
					.andWhere(
						new Brackets((qb: WhereExpressionBuilder) => {
							qb.andWhere(p(`"${weekHoursQuery.alias}"."tenantId" = :tenantId`), { tenantId });
							qb.andWhere(p(`"${weekHoursQuery.alias}"."organizationId" = :organizationId`), {
								organizationId
							});
						})
					)
					.andWhere(
						new Brackets((qb: WhereExpressionBuilder) => {
							qb.andWhere(p(`"timeLogs"."tenantId" = :tenantId`), { tenantId });
							qb.andWhere(p(`"timeLogs"."organizationId" = :organizationId`), { organizationId });
						})
					)
					.andWhere(
						new Brackets((qb: WhereExpressionBuilder) => {
							qb.andWhere(p(`"timeLogs"."startedAt" BETWEEN :weeklyStart AND :weeklyEnd`), {
								weeklyStart,
								weeklyEnd
							});
							qb.andWhere(p(`"time_slot"."startedAt" BETWEEN :weeklyStart AND :weeklyEnd`), {
								weeklyStart,
								weeklyEnd
							});
						})
					)
					.andWhere(
						new Brackets((qb: WhereExpressionBuilder) => {
							if (isNotEmpty(employeeIds)) {
								qb.andWhere(p(`"timeLogs"."employeeId" IN (:...employeeIds)`), { employeeIds });
							}
							if (isNotEmpty(projectIds)) {
								qb.andWhere(p(`"timeLogs"."projectId" IN (:...projectIds)`), { projectIds });
							}
							if (isNotEmpty(teamIds)) {
								qb.andWhere(p(`"timeLogs"."organizationTeamId" IN (:...teamIds)`), { teamIds });
							}
						})
					)
					.addGroupBy(
						isSqlite() || isBetterSqlite3()
							? `(strftime('%w', timeLogs.startedAt))`
							: isPostgres()
							? 'EXTRACT(DOW FROM "timeLogs"."startedAt")'
							: isMySQL()
							? p('DayOfWeek("timeLogs"."startedAt") - 1')
							: '0'
					);

				member.weekHours = await weekHoursQuery.getRawMany();
			}
		}
		return employees;
	}

	/**
	 * GET Time Tracking Dashboard Projects Statistics
	 *
	 * @param request
	 * @returns
	 */
	async getProjects(request: IGetProjectsStatistics): Promise<IProjectsStatistics[]> {
		const { organizationId, startDate, endDate } = request;
		let { employeeIds = [], projectIds = [], teamIds = [] } = request;

		const user = RequestContext.currentUser();
		const tenantId = RequestContext.currentTenantId() || request.tenantId;

		const { start, end } = getDateRangeFormat(
			moment.utc(startDate || moment().startOf('week')),
			moment.utc(endDate || moment().endOf('week'))
		);

		// Check if the current user has the permission to change the selected employee
		const hasChangeSelectedEmployeePermission: boolean = RequestContext.hasPermission(
			PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
		);

		// Retrieves the database type from the configuration service.
		const dbType = this.configService.dbConnectionOptions.type;

		// Determine if the request specifies to retrieve data for the current user only
		const isOnlyMeSelected: boolean = request.onlyMe;

		/**
		 * Set employeeIds based on user conditions and permissions
		 */
		if ((user.employeeId && isOnlyMeSelected) || (!hasChangeSelectedEmployeePermission && user.employeeId)) {
			employeeIds = [user.employeeId];
		}

		const query = this.typeOrmTimeLogRepository.createQueryBuilder('time_log');

		let queryString: string;
		switch (dbType) {
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
				queryString = `COALESCE(ROUND(SUM((julianday(COALESCE("${query.alias}"."stoppedAt", datetime('now'))) - julianday("${query.alias}"."startedAt")) * 86400) / COUNT("time_slot"."id")), 0)`;
				break;
			case DatabaseTypeEnum.postgres:
				queryString = `COALESCE(ROUND(SUM(extract(epoch from (COALESCE("${query.alias}"."stoppedAt", NOW()) - "${query.alias}"."startedAt"))) / COUNT("time_slot"."id")), 0)`;
				break;
			case DatabaseTypeEnum.mysql:
				queryString = p(
					`COALESCE(ROUND(SUM(TIMESTAMPDIFF(SECOND, "${query.alias}"."startedAt", COALESCE("${query.alias}"."stoppedAt", NOW()))) / COUNT("time_slot"."id")), 0)`
				);
				break;
			default:
				throw Error(`cannot create statistic query due to unsupported database type: ${dbType}`);
		}

		query
			.select(p(`"project"."name"`), 'name')
			.addSelect(p(`"project"."id"`), 'projectId')
			.addSelect(queryString, `duration`)
			.innerJoin(`${query.alias}.project`, 'project')
			.innerJoin(`${query.alias}.timeSlots`, 'time_slot')
			.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					qb.andWhere(p(`"${query.alias}"."startedAt" BETWEEN :start AND :end`), {
						start,
						end
					});
					qb.andWhere(p(`"time_slot"."startedAt" BETWEEN :start AND :end`), {
						start,
						end
					});
				})
			)
			.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					qb.andWhere(p(`"${query.alias}"."tenantId" = :tenantId`), { tenantId });
					qb.andWhere(p(`"${query.alias}"."organizationId" = :organizationId`), { organizationId });
				})
			)
			.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					qb.andWhere(p(`"time_slot"."tenantId" = :tenantId`), { tenantId });
					qb.andWhere(p(`"time_slot"."organizationId" = :organizationId`), { organizationId });
				})
			)
			.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					if (isNotEmpty(employeeIds)) {
						qb.andWhere(p(`"${query.alias}"."employeeId" IN (:...employeeIds)`), {
							employeeIds
						});
						qb.andWhere(p(`"time_slot"."employeeId" IN (:...employeeIds)`), {
							employeeIds
						});
					}
					if (isNotEmpty(projectIds)) {
						qb.andWhere(p(`"${query.alias}"."projectId" IN (:...projectIds)`), {
							projectIds
						});
						qb.andWhere(p(`"project"."id" IN (:...projectIds)`), {
							projectIds
						});
					}
					if (isNotEmpty(teamIds)) {
						qb.andWhere(p(`"${query.alias}"."organizationTeamId" IN (:...teamIds)`), { teamIds });
					}
				})
			)
			.groupBy(p(`"${query.alias}"."id"`))
			.addGroupBy(p(`"project"."id"`))
			.orderBy('duration', 'DESC');

		let statistics: IProjectsStatistics[] = await query.getRawMany();
		let projects: IProjectsStatistics[] = chain(statistics)
			.groupBy('projectId')
			.map((projects: IProjectsStatistics[], projectId) => {
				const [project] = projects;
				return {
					name: project.name,
					id: projectId,
					duration: reduce(pluck(projects, 'duration'), ArraySum, 0)
				} as IProjectsStatistics;
			})
			.value()
			.splice(0, 5);

		const totalDurationQuery = this.typeOrmTimeLogRepository.createQueryBuilder('time_log');

		let totalDurationQueryString: string;
		switch (dbType) {
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
				totalDurationQueryString = `COALESCE(ROUND(SUM((julianday(COALESCE("${totalDurationQuery.alias}"."stoppedAt", datetime('now'))) - julianday("${totalDurationQuery.alias}"."startedAt")) * 86400)), 0)`;
				break;
			case DatabaseTypeEnum.postgres:
				totalDurationQueryString = `COALESCE(ROUND(SUM(extract(epoch from (COALESCE("${totalDurationQuery.alias}"."stoppedAt", NOW()) - "${totalDurationQuery.alias}"."startedAt")))), 0)`;
				break;
			case DatabaseTypeEnum.mysql:
				totalDurationQueryString = p(
					`COALESCE(ROUND(SUM(TIMESTAMPDIFF(SECOND, "${totalDurationQuery.alias}"."startedAt", COALESCE("${totalDurationQuery.alias}"."stoppedAt", NOW())))), 0)`
				);
				break;
			default:
				throw Error(`cannot create statistic query due to unsupported database type: ${dbType}`);
		}

		totalDurationQuery
			.select(totalDurationQueryString, `duration`)
			.innerJoin(`${totalDurationQuery.alias}.project`, 'project')
			.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					qb.andWhere(p(`"${totalDurationQuery.alias}"."startedAt" BETWEEN :start AND :end`), {
						start,
						end
					});
				})
			)
			.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					qb.andWhere(p(`"${totalDurationQuery.alias}"."tenantId" = :tenantId`), { tenantId });
					qb.andWhere(p(`"${totalDurationQuery.alias}"."organizationId" = :organizationId`), {
						organizationId
					});
				})
			)
			.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					if (isNotEmpty(employeeIds)) {
						qb.andWhere(p(`"${totalDurationQuery.alias}"."employeeId" IN (:...employeeIds)`), {
							employeeIds
						});
					}
					if (isNotEmpty(projectIds)) {
						qb.andWhere(p(`"${totalDurationQuery.alias}"."projectId" IN (:...projectIds)`), {
							projectIds
						});
						qb.andWhere(p(`"project"."id" IN (:...projectIds)`), {
							projectIds
						});
					}
					if (isNotEmpty(teamIds)) {
						qb.andWhere(p(`"${totalDurationQuery.alias}"."organizationTeamId" IN (:...teamIds)`), {
							teamIds
						});
					}
				})
			);
		const totalDuration = await totalDurationQuery.getRawOne();
		projects = projects.map((project: IProjectsStatistics) => {
			project.durationPercentage = parseFloat(
				parseFloat((project.duration * 100) / totalDuration.duration + '').toFixed(2)
			);
			return project;
		});
		return projects || [];
	}

	/**
	 * GET Time Tracking Dashboard Tasks Statistics
	 *
	 * @param request
	 * @returns
	 */
	async getTasks(request: IGetTasksStatistics) {
		const { organizationId, startDate, endDate, take, onlyMe = false, organizationTeamId } = request;
		const { projectIds = [], taskIds = [], teamIds = [], defaultRange, unitOfTime } = request;
		let { employeeIds = [], todayEnd, todayStart } = request;

		const user = RequestContext.currentUser();
		const tenantId = RequestContext.currentTenantId() || request.tenantId;

		let start: string | Date;
		let end: string | Date;

		if (startDate && endDate) {
			const range = getDateRangeFormat(moment.utc(startDate), moment.utc(endDate));
			start = range.start;
			end = range.end;
		} else if (defaultRange) {
			const unit = (unitOfTime || 'week') as moment.unitOfTime.StartOf;
			const range = getDateRangeFormat(moment().startOf(unit).utc(), moment().endOf(unit).utc());
			start = range.start;
			end = range.end;
		}

		/*
		 *  Get employees id of the organization or get current employee id
		 */
		if (
			user &&
			user.employeeId &&
			(onlyMe || !RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE))
		) {
			if (
				isNotEmpty(organizationTeamId) ||
				RequestContext.hasPermission(PermissionsEnum.ORG_MEMBER_LAST_LOG_VIEW)
			) {
				employeeIds = [...employeeIds];
			} else {
				employeeIds = [user.employeeId];
			}
		}

		if (todayStart && todayEnd) {
			const range = getDateRangeFormat(moment.utc(todayStart), moment.utc(todayEnd));
			todayStart = range.start;
			todayEnd = range.end;
		} else if (defaultRange) {
			const unit = (unitOfTime || 'day') as moment.unitOfTime.StartOf;
			const range = getDateRangeFormat(moment().startOf(unit).utc(), moment().endOf(unit).utc());
			todayStart = range.start;
			todayEnd = range.end;
		}

		// Retrieves the database type from the configuration service.
		const dbType = this.configService.dbConnectionOptions.type;

		let todayStatistics: any[] = [];

		/**
		 * Get Today's Task Statistics
		 */
		switch (this.ormType) {
			case MultiORMEnum.MikroORM:
				{
					// Start building the MikroORM query
					const qb = this.mikroOrmTimeLogRepository.createQueryBuilder('time_log');
					const knex = this.mikroOrmTimeLogRepository.getKnex();

					// Add the raw SQL snippet to the select
					const raw = getDurationQueryString(dbType, qb.alias, 'time_slot');

					// Constructs SQL query to fetch task title, ID, last updated timestamp, and today's duration.
					let sq = knex(qb.alias).select([
						`task.title AS title`,
						`task.id AS taskId`,
						`${qb.alias}.updatedAt AS updatedAt`,
						knex.raw(`${raw} AS today_duration`)
					]);

					// Add join clauses
					sq.innerJoin('task', `${qb.alias}.taskId`, 'task.id');
					sq.innerJoin('time_slot_time_logs', `${qb.alias}.id`, 'time_slot_time_logs.timeLogId');
					sq.innerJoin('time_slot', 'time_slot_time_logs.timeSlotId', 'time_slot.id');

					// Add where clauses
					sq.andWhere({
						[`${qb.alias}.tenantId`]: tenantId,
						[`${qb.alias}.organizationId`]: organizationId,
						[`time_slot.tenantId`]: tenantId,
						[`time_slot.organizationId`]: organizationId
					});

					if (todayStart && todayEnd) {
						sq.whereBetween(`${qb.alias}.startedAt`, [todayStart, todayEnd]);
						sq.whereBetween(`time_slot.startedAt`, [todayStart, todayEnd]);
					}
					if (isNotEmpty(employeeIds)) {
						sq.whereIn(`${qb.alias}.employeeId`, employeeIds);
						sq.whereIn(`time_slot.employeeId`, employeeIds);
					}
					if (isNotEmpty(projectIds)) {
						sq.whereIn(`${qb.alias}.projectId`, projectIds);
					}
					if (isNotEmpty(taskIds)) {
						sq.whereIn(`${qb.alias}.taskId`, taskIds);
					}
					if (isNotEmpty(organizationTeamId) || isNotEmpty(teamIds)) {
						sq.andWhere(function () {
							if (isNotEmpty(organizationTeamId)) {
								this.orWhere(`${qb.alias}.organizationTeamId`, '=', organizationTeamId);
							}
							if (isNotEmpty(teamIds)) {
								this.orWhereIn(`${qb.alias}.organizationTeamId`, teamIds);
							}
						});
					}
					sq.groupBy([`${qb.alias}.id`, 'task.id']); // Apply multiple group by clauses in a single statement
					sq.orderBy(`${qb.alias}.updatedAt`, 'desc'); // Apply order by clause
					console.log(chalk.green(sq.toString() + ' || Get Today Statistics Query MikroORM!'));
					// Execute the raw SQL query and get the results
					todayStatistics = (await knex.raw(sq.toString())).rows || [];
				}
				break;

			case MultiORMEnum.TypeORM:
				{
					const qb = this.typeOrmTimeLogRepository.createQueryBuilder('time_log');

					qb.select(p(`"task"."title"`), 'title');
					qb.addSelect(p(`"task"."id"`), 'taskId');
					qb.addSelect(p(`"${qb.alias}"."updatedAt"`), 'updatedAt');
					qb.addSelect(getDurationQueryString(dbType, qb.alias, 'time_slot'), `today_duration`);

					// Add join clauses
					qb.innerJoin(`${qb.alias}.task`, 'task');
					qb.innerJoin(`${qb.alias}.timeSlots`, 'time_slot');

					// Combine tenant and organization ID conditions
					qb.andWhere(
						p(`"${qb.alias}"."tenantId" = :tenantId AND "${qb.alias}"."organizationId" = :organizationId`),
						{ tenantId, organizationId }
					);
					qb.andWhere(
						p(`"time_slot"."tenantId" = :tenantId AND "time_slot"."organizationId" = :organizationId`),
						{ tenantId, organizationId }
					);

					// Add conditions based on today's start and end time
					if (todayStart && todayEnd) {
						qb.andWhere(p(`"${qb.alias}"."startedAt" BETWEEN :todayStart AND :todayEnd`), {
							todayStart,
							todayEnd
						});
						qb.andWhere(p(`"time_slot"."startedAt" BETWEEN :todayStart AND :todayEnd`), {
							todayStart,
							todayEnd
						});
					}
					if (isNotEmpty(employeeIds)) {
						qb.andWhere(p(`"${qb.alias}"."employeeId" IN (:...employeeIds)`), { employeeIds });
						qb.andWhere(p(`"time_slot"."employeeId" IN (:...employeeIds)`), { employeeIds });
					}
					if (isNotEmpty(projectIds)) {
						qb.andWhere(p(`"${qb.alias}"."projectId" IN (:...projectIds)`), { projectIds });
					}
					if (isNotEmpty(taskIds)) {
						qb.andWhere(p(`"${qb.alias}"."taskId" IN (:...taskIds)`), { taskIds });
					}
					if (isNotEmpty(organizationTeamId) || isNotEmpty(teamIds)) {
						qb.andWhere(
							new Brackets((web) => {
								if (isNotEmpty(organizationTeamId)) {
									web.orWhere(`${qb.alias}.organizationTeamId = :organizationTeamId`, {
										organizationTeamId
									});
								}
								if (isNotEmpty(teamIds)) {
									web.orWhere(`${qb.alias}.organizationTeamId IN (:...teamIds)`, { teamIds });
								}
							})
						);
					}
					qb.groupBy(p(`"${qb.alias}"."id"`));
					qb.addGroupBy(p(`"task"."id"`));
					qb.orderBy(p(`"${qb.alias}"."updatedAt"`), 'DESC');
					console.log(qb.getQuery(), ' || Get Today Statistics Query TypeORM');
					// Execute the SQL query and get the results
					todayStatistics = await qb.getRawMany();
				}
				break;
			default:
				throw new Error(`Cannot create statistic query due to unsupported database type: ${dbType}`);
		}

		let statistics: any[] = [];

		/**
		 * Get Given Time Frame Task Statistics
		 */
		switch (this.ormType) {
			case MultiORMEnum.MikroORM:
				{
					// Start building the MikroORM query
					const qb = this.mikroOrmTimeLogRepository.createQueryBuilder('time_log');
					const knex = this.mikroOrmTimeLogRepository.getKnex();

					// Add the raw SQL snippet to the select
					const raw = getDurationQueryString(dbType, qb.alias, 'time_slot');

					// Constructs SQL query to fetch task title, ID, last updated timestamp, and today's duration.
					let sq = knex(qb.alias).select([
						`task.title AS title`,
						`task.id AS taskId`,
						`${qb.alias}.updatedAt AS updatedAt`,
						knex.raw(`${raw} AS duration`)
					]);

					// Add join clauses
					sq.innerJoin('task', `${qb.alias}.taskId`, 'task.id');
					sq.innerJoin('time_slot_time_logs', `${qb.alias}.id`, 'time_slot_time_logs.timeLogId');
					sq.innerJoin('time_slot', 'time_slot_time_logs.timeSlotId', 'time_slot.id');

					// Add where clauses
					sq.andWhere({
						[`${qb.alias}.tenantId`]: tenantId,
						[`${qb.alias}.organizationId`]: organizationId,
						[`time_slot.tenantId`]: tenantId,
						[`time_slot.organizationId`]: organizationId
					});

					if (start && end) {
						sq.whereBetween(`${qb.alias}.startedAt`, [start, end]);
						sq.whereBetween(`time_slot.startedAt`, [start, end]);
					}
					if (isNotEmpty(employeeIds)) {
						sq.whereIn(`${qb.alias}.employeeId`, employeeIds);
						sq.whereIn(`time_slot.employeeId`, employeeIds);
					}
					if (isNotEmpty(projectIds)) {
						sq.whereIn(`${qb.alias}.projectId`, projectIds);
					}
					if (isNotEmpty(taskIds)) {
						sq.whereIn(`${qb.alias}.taskId`, taskIds);
					}
					if (isNotEmpty(organizationTeamId) || isNotEmpty(teamIds)) {
						sq.andWhere(function () {
							if (isNotEmpty(organizationTeamId)) {
								this.orWhere(`${qb.alias}.organizationTeamId`, '=', organizationTeamId);
							}
							if (isNotEmpty(teamIds)) {
								this.orWhereIn(`${qb.alias}.organizationTeamId`, teamIds);
							}
						});
					}
					sq.groupBy([`${qb.alias}.id`, 'task.id']); // Apply multiple group by clauses in a single statement
					sq.orderBy(`${qb.alias}.updatedAt`, 'desc'); // Apply order by clause
					console.log(chalk.green(sq.toString() + ' || Get Statistics Query MikroORM!'));
					// Execute the raw SQL query and get the results
					statistics = (await knex.raw(sq.toString())).rows || [];
				}
				break;

			case MultiORMEnum.TypeORM:
				{
					/**
					 * Get Time Range Statistics
					 */
					const qb = this.typeOrmTimeLogRepository.createQueryBuilder('time_log');
					qb.select(p(`"task"."title"`), 'title');
					qb.addSelect(p(`"task"."id"`), 'taskId');
					qb.addSelect(p(`"${qb.alias}"."updatedAt"`), 'updatedAt');
					qb.addSelect(getDurationQueryString(dbType, qb.alias, 'time_slot'), `duration`);

					// Add join clauses
					qb.innerJoin(`${qb.alias}.task`, 'task');
					qb.innerJoin(`${qb.alias}.timeSlots`, 'time_slot');

					// Add join clauses
					// Combine tenant and organization ID conditions for qb.alias
					qb.andWhere(
						p(`"${qb.alias}"."tenantId" = :tenantId AND "${qb.alias}"."organizationId" = :organizationId`),
						{ tenantId, organizationId }
					);
					// Combine tenant and organization ID conditions for time_slot
					qb.andWhere(
						p(`"time_slot"."tenantId" = :tenantId AND "time_slot"."organizationId" = :organizationId`),
						{ tenantId, organizationId }
					);

					// Add conditions based on start and end time
					if (start && end) {
						qb.andWhere(p(`"${qb.alias}"."startedAt" BETWEEN :start AND :end`), { start, end });
						qb.andWhere(p(`"time_slot"."startedAt" BETWEEN :start AND :end`), { start, end });
					}
					if (isNotEmpty(employeeIds)) {
						qb.andWhere(
							p(
								`"${qb.alias}"."employeeId" IN (:...employeeIds) AND "time_slot"."employeeId" IN (:...employeeIds)`
							),
							{ employeeIds }
						);
					}
					if (isNotEmpty(projectIds)) {
						qb.andWhere(p(`"${qb.alias}"."projectId" IN (:...projectIds)`), { projectIds });
					}
					if (isNotEmpty(taskIds)) {
						qb.andWhere(p(`"${qb.alias}"."taskId" IN (:...taskIds)`), { taskIds });
					}
					if (isNotEmpty(organizationTeamId) || isNotEmpty(teamIds)) {
						qb.andWhere(
							new Brackets((web) => {
								if (isNotEmpty(organizationTeamId)) {
									web.orWhere(`${qb.alias}.organizationTeamId = :organizationTeamId`, {
										organizationTeamId
									});
								}
								if (isNotEmpty(teamIds)) {
									web.orWhere(`${qb.alias}.organizationTeamId IN (:...teamIds)`, { teamIds });
								}
							})
						);
					}

					qb.groupBy(p(`"${qb.alias}"."id"`));
					qb.addGroupBy(p(`"task"."id"`));
					qb.orderBy(p(`"${qb.alias}"."updatedAt"`), 'DESC');
					console.log(qb.getQueryAndParameters(), 'Get Statistics Query TypeORM');
					// Execute the raw SQL query and get the results
					statistics = await qb.getRawMany();
				}
				break;
			default:
				throw new Error(`Cannot create statistic query due to unsupported database type: ${dbType}`);
		}

		let totalDuration: any;

		/**
		 * Get Total Task Statistics
		 */
		switch (this.ormType) {
			case MultiORMEnum.MikroORM:
				{
					const qb = this.mikroOrmTimeLogRepository.createQueryBuilder('time_log');
					const knex = this.mikroOrmTimeLogRepository.getKnex();

					// Add the raw SQL snippet to the select
					const raw = getTotalDurationQueryString(dbType, qb.alias);
					// Construct your SQL query using knex
					let sq = knex(qb.alias).select([knex.raw(`${raw} AS duration`)]);

					// Add join clauses
					sq.innerJoin('task', `${qb.alias}.taskId`, 'task.id');
					sq.innerJoin('time_slot_time_logs', `${qb.alias}.id`, 'time_slot_time_logs.timeLogId');
					sq.innerJoin('time_slot', 'time_slot_time_logs.timeSlotId', 'time_slot.id');

					// Add where clauses
					sq.andWhere({
						[`${qb.alias}.tenantId`]: tenantId,
						[`${qb.alias}.organizationId`]: organizationId
					});

					if (start && end) {
						sq.whereBetween(`${qb.alias}.startedAt`, [start, end]);
					}
					if (isNotEmpty(employeeIds)) {
						sq.whereIn(`${qb.alias}.employeeId`, employeeIds);
					}
					if (isNotEmpty(projectIds)) {
						sq.whereIn(`${qb.alias}.projectId`, projectIds);
					}
					if (isNotEmpty(organizationTeamId) || isNotEmpty(teamIds)) {
						sq.andWhere(function () {
							if (isNotEmpty(organizationTeamId)) {
								this.orWhere(`${qb.alias}.organizationTeamId`, '=', organizationTeamId);
							}
							if (isNotEmpty(teamIds)) {
								this.orWhereIn(`${qb.alias}.organizationTeamId`, teamIds);
							}
						});
					}
					console.log(chalk.green(sq.toString() + ' || Get Total Duration Query MikroORM!'));
					// Execute the raw SQL query and get the results
					[totalDuration] = (await knex.raw(sq.toString())).rows || [];
				}

				break;

			case MultiORMEnum.TypeORM:
				{
					const qb = this.typeOrmTimeLogRepository.createQueryBuilder('time_log');
					qb.select(getTotalDurationQueryString(dbType, qb.alias), 'duration');

					// Add join clauses
					qb.innerJoin(`${qb.alias}.task`, 'task');

					// Add where clauses
					qb.andWhere(p(`"${qb.alias}"."tenantId" = :tenantId`), { tenantId });
					qb.andWhere(p(`"${qb.alias}"."organizationId" = :organizationId`), { organizationId });

					if (start && end) {
						qb.andWhere(p(`"${qb.alias}"."startedAt" BETWEEN :start AND :end`), { start, end });
					}
					if (isNotEmpty(employeeIds)) {
						qb.andWhere(p(`"${qb.alias}"."employeeId" IN (:...employeeIds)`), { employeeIds });
					}
					if (isNotEmpty(projectIds)) {
						qb.andWhere(p(`"${qb.alias}"."projectId" IN (:...projectIds)`), { projectIds });
					}
					if (isNotEmpty(organizationTeamId) || isNotEmpty(teamIds)) {
						qb.andWhere(
							new Brackets((web) => {
								if (isNotEmpty(organizationTeamId)) {
									web.orWhere(`${qb.alias}.organizationTeamId = :organizationTeamId`, {
										organizationTeamId
									});
								}
								if (isNotEmpty(teamIds)) {
									web.orWhere(`${qb.alias}.organizationTeamId IN (:...teamIds)`, { teamIds });
								}
							})
						);
					}
					console.log(qb.getQuery(), 'Get Total Duration Query TypeORM!');
					// Execute the raw SQL query and get the results
					totalDuration = await qb.getRawOne();
				}
				break;

			default:
				throw new Error(`Cannot create statistic query due to unsupported database type: ${dbType}`);
		}

		// ------------------------------------------------

		console.log('Find Statistics length: ', statistics.length);
		console.log('Find Today Statistics length: ', todayStatistics.length);
		console.log('Find Total Duration: ', totalDuration?.duration);

		/* Code that cause issues... We try to optimize it using "hashing" approach etc

		const mergedStatistics = _.map(statistics, (statistic) => {
			const updatedAt = String(statistic.updatedAt);
			return _.extend(
				{
					today_duration: 0,
					...statistic,
					updatedAt
				},
				_.findWhere(
					todayStatistics.map((today) => ({
						...today,
						updatedAt: String(today.updatedAt)
					})),
					{
						taskId: statistic.taskId,
						updatedAt
					}
				)
			);
		});

		let tasks: ITask[] = chain(mergedStatistics)
			.groupBy('taskId')
			.map((tasks: ITask[], taskId) => {
				const [task] = tasks;
				return {
					title: task.title,
					id: taskId,
					duration: reduce(pluck(tasks, 'duration'), ArraySum, 0),
					todayDuration: reduce(pluck(tasks, 'today_duration'), ArraySum, 0),
					updatedAt: task.updatedAt
				} as ITask;
			})
			.value();

		if (isNotEmpty(take)) {
			tasks = tasks.splice(0, take);
		}

		tasks = tasks.map((task: any) => {
			task.durationPercentage = parseFloat(
				parseFloat((task.duration * 100) / totalDuration.duration + '').toFixed(2)
			);
			return task;
		});

		*/

		const totalDurationValue = statistics.reduce((total, stat) => total + (parseInt(stat.duration, 10) || 0), 0);

		console.log('Total Duration Value: ', totalDurationValue);

		const todayStatsLookup = todayStatistics.reduce((acc, stat) => {
			const taskId = stat.taskId;
			if (!acc[taskId]) {
				acc[taskId] = { todayDuration: 0 };
			}
			acc[taskId].todayDuration += parseInt(stat.today_duration, 10) || 0;
			return acc;
		}, {});

		const taskAggregates = statistics.reduce((acc, stat) => {
			const taskId = stat.taskId;

			if (!acc[taskId]) {
				acc[taskId] = { duration: 0, todayDuration: 0, title: stat.title, updatedAt: stat.updatedAt };
			}

			// Convert stat.duration to a number before adding
			const durationToAdd = Number(stat.duration) || 0;

			// Sum durations as numbers
			acc[taskId].duration += durationToAdd;

			if (todayStatsLookup[taskId]) {
				acc[taskId].todayDuration = todayStatsLookup[taskId].todayDuration;
			}

			return acc;
		}, {});

		let tasks = Object.entries(taskAggregates).map(([taskId, agg]: [string, any]) => ({
			id: taskId,
			title: agg.title,
			duration: agg.duration,
			todayDuration: agg.todayDuration,
			updatedAt: agg.updatedAt
		}));

		tasks = tasks.map((task: any) => {
			const duration = parseInt(task.duration, 10);
			const todayDuration = parseInt(task.todayDuration, 10);

			// Update task with parsed numeric values
			task.duration = isNaN(duration) ? null : duration;
			task.todayDuration = isNaN(todayDuration) ? null : todayDuration;

			if (!isNaN(task.duration) && totalDurationValue !== 0) {
				task.durationPercentage = parseFloat(((task.duration * 100) / totalDurationValue).toFixed(2));
			} else {
				task.durationPercentage = 0;
			}

			return task;
		});

		if (isNotEmpty(take)) {
			tasks = tasks.splice(0, take);
		}

		console.log('Task Aggregates: ', tasks);

		return tasks;
	}

	/**
	 * GET Time Tracking Dashboard Manual Time Logs Statistics
	 *
	 * @param request
	 * @returns
	 */
	async manualTimes(request: IGetManualTimesStatistics): Promise<IManualTimesStatistics[]> {
		console.time('Get Manual Time Log');

		const { organizationId, startDate, endDate } = request;
		let { employeeIds = [], projectIds = [], teamIds = [] } = request;

		const user = RequestContext.currentUser();
		const tenantId = RequestContext.currentTenantId() || request.tenantId;

		const { start, end } = getDateRangeFormat(
			moment.utc(startDate || moment().startOf('week')),
			moment.utc(endDate || moment().endOf('week'))
		);

		// Check if the current user has the permission to change the selected employee
		const hasChangeSelectedEmployeePermission: boolean = RequestContext.hasPermission(
			PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
		);

		// Determine if the request specifies to retrieve data for the current user only
		const isOnlyMeSelected: boolean = request.onlyMe;

		/**
		 * Set employeeIds based on user conditions and permissions
		 */
		if ((user.employeeId && isOnlyMeSelected) || (!hasChangeSelectedEmployeePermission && user.employeeId)) {
			employeeIds = [user.employeeId];
		}

		const query = this.typeOrmTimeLogRepository.createQueryBuilder('time_log');
		query.innerJoin(`${query.alias}.timeSlots`, 'timeSlots');
		query.leftJoinAndSelect(`${query.alias}.project`, 'project');
		query.leftJoinAndSelect(`${query.alias}.employee`, 'employee');
		query.leftJoinAndSelect(`employee.user`, 'user');
		query.setFindOptions({
			take: 5,
			order: {
				startedAt: 'DESC'
			}
		});
		query.where((qb: SelectQueryBuilder<TimeLog>) => {
			qb.andWhere(
				new Brackets((web: WhereExpressionBuilder) => {
					web.andWhere(p(`"${qb.alias}"."logType" = :logType`), {
						logType: TimeLogType.MANUAL
					});
				})
			);
			qb.andWhere(
				new Brackets((web: WhereExpressionBuilder) => {
					web.andWhere(p(`"${qb.alias}"."startedAt" BETWEEN :start AND :end`), {
						start,
						end
					});
					web.andWhere(p(`"timeSlots"."startedAt" BETWEEN :start AND :end`), {
						start,
						end
					});
				})
			);
			qb.andWhere(
				new Brackets((web: WhereExpressionBuilder) => {
					web.andWhere(p(`"${qb.alias}"."tenantId" = :tenantId`), { tenantId });
					web.andWhere(p(`"${qb.alias}"."organizationId" = :organizationId`), { organizationId });
				})
			);
			qb.andWhere(
				new Brackets((web: WhereExpressionBuilder) => {
					web.andWhere(p(`"timeSlots"."tenantId" = :tenantId`), { tenantId });
					web.andWhere(p(`"timeSlots"."organizationId" = :organizationId`), { organizationId });
				})
			);
			qb.andWhere(
				new Brackets((web: WhereExpressionBuilder) => {
					if (isNotEmpty(employeeIds)) {
						web.andWhere(p(`"${qb.alias}"."employeeId" IN (:...employeeIds)`), {
							employeeIds
						});
					}
					if (isNotEmpty(projectIds)) {
						web.andWhere(p(`"${qb.alias}"."projectId" IN (:...projectIds)`), {
							projectIds
						});
					}
					if (isNotEmpty(teamIds)) {
						web.andWhere(p(`"${qb.alias}"."organizationTeamId" IN (:...teamIds)`), { teamIds });
					}
				})
			);
		});
		const timeLogs = await query.getMany();

		const mappedTimeLogs: IManualTimesStatistics[] = timeLogs.map(
			(timeLog: ITimeLog): IManualTimesStatistics => ({
				id: timeLog.id,
				startedAt: timeLog.startedAt,
				duration: timeLog.duration,
				user: { ...pick(timeLog.employee.user, ['name', 'imageUrl']) },
				project: { ...pick(timeLog.project, ['name', 'imageUrl']) },
				employeeId: timeLog.employee.id,
				employee: timeLog.employee
			})
		);

		console.timeEnd('Get Manual Time Log');
		return mappedTimeLogs || [];
	}

	/**
	 * GET Time Tracking Dashboard Activities Statistics
	 *
	 * @param request
	 * @returns
	 */
	async getActivities(request: IGetActivitiesStatistics): Promise<IActivitiesStatistics[]> {
		const { organizationId, startDate, endDate } = request;
		let { employeeIds = [], projectIds = [], teamIds = [] } = request;

		const user = RequestContext.currentUser();
		const tenantId = RequestContext.currentTenantId() || request.tenantId;

		const { start, end } = getDateRangeFormat(
			moment.utc(startDate || moment().startOf('week')),
			moment.utc(endDate || moment().endOf('week'))
		);

		// Check if the current user has the permission to change the selected employee
		const hasChangeSelectedEmployeePermission: boolean = RequestContext.hasPermission(
			PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
		);

		// Retrieves the database type from the configuration service.
		const dbType = this.configService.dbConnectionOptions.type;

		// Determine if the request specifies to retrieve data for the current user only
		const isOnlyMeSelected: boolean = request.onlyMe;

		/**
		 * Set employeeIds based on user conditions and permissions
		 */
		if ((user.employeeId && isOnlyMeSelected) || (!hasChangeSelectedEmployeePermission && user.employeeId)) {
			employeeIds = [user.employeeId];
		}

		const query = this.typeOrmActivityRepository.createQueryBuilder();
		query
			.select(p(`COUNT("${query.alias}"."id")`), `sessions`)
			.addSelect(p(`SUM("${query.alias}"."duration")`), `duration`)
			.addSelect(p(`"${query.alias}"."title"`), `title`)
			.innerJoin(`${query.alias}.timeSlot`, 'time_slot')
			.innerJoin(`time_slot.timeLogs`, 'time_log')
			.addGroupBy(p(`"${query.alias}"."title"`));

		query
			.andWhere(getActivityDurationQueryString(dbType, query.alias), { start, end })
			.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					qb.andWhere(p(`"time_log"."startedAt" BETWEEN :startDate AND :endDate`), {
						startDate: start,
						endDate: end
					});
					qb.andWhere(p(`"time_slot"."startedAt" BETWEEN :startDate AND :endDate`), {
						startDate: start,
						endDate: end
					});
				})
			)
			.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					qb.andWhere(p(`"${query.alias}"."tenantId" = :tenantId`), { tenantId });
					qb.andWhere(p(`"${query.alias}"."organizationId" = :organizationId`), { organizationId });
				})
			)
			.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					qb.andWhere(p(`"time_log"."tenantId" = :tenantId`), { tenantId });
					qb.andWhere(p(`"time_log"."organizationId" = :organizationId`), { organizationId });
				})
			)
			.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					if (isNotEmpty(employeeIds)) {
						qb.andWhere(p(`"${query.alias}"."employeeId" IN (:...employeeIds)`), { employeeIds });
					}
					if (isNotEmpty(projectIds)) {
						qb.andWhere(p(`"${query.alias}"."projectId" IN (:...projectIds)`), { projectIds });
					}
					if (isNotEmpty(teamIds)) {
						qb.andWhere(p(`"time_log"."organizationTeamId" IN (:...teamIds)`), { teamIds });
					}
				})
			)
			.orderBy(p(`"duration"`), 'DESC')
			.limit(5);
		let activities: IActivitiesStatistics[] = await query.getRawMany();

		/*
		 * Fetch total duration of the week for calculate duration percentage
		 */
		const totalDurationQuery = this.typeOrmActivityRepository.createQueryBuilder();

		totalDurationQuery
			.select(p(`SUM("${totalDurationQuery.alias}"."duration")`), `duration`)
			.innerJoin(`${totalDurationQuery.alias}.timeSlot`, 'time_slot')
			.innerJoin(`time_slot.timeLogs`, 'time_log');

		totalDurationQuery
			.andWhere(getActivityDurationQueryString(dbType, totalDurationQuery.alias), { start, end })
			.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					qb.andWhere(p(`"time_log"."startedAt" BETWEEN :startDate AND :endDate`), {
						startDate: start,
						endDate: end
					});
					qb.andWhere(p(`"time_slot"."startedAt" BETWEEN :startDate AND :endDate`), {
						startDate: start,
						endDate: end
					});
				})
			)
			.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					qb.andWhere(p(`"${totalDurationQuery.alias}"."tenantId" = :tenantId`), { tenantId });
					qb.andWhere(p(`"${totalDurationQuery.alias}"."organizationId" = :organizationId`), {
						organizationId
					});
				})
			)
			.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					qb.andWhere(p(`"time_log"."tenantId" = :tenantId`), { tenantId });
					qb.andWhere(p(`"time_log"."organizationId" = :organizationId`), { organizationId });
				})
			)
			.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					if (isNotEmpty(employeeIds)) {
						qb.andWhere(p(`"${totalDurationQuery.alias}"."employeeId" IN (:...employeeIds)`), {
							employeeIds
						});
					}
					if (isNotEmpty(projectIds)) {
						qb.andWhere(p(`"${totalDurationQuery.alias}"."projectId" IN (:...projectIds)`), { projectIds });
					}
					if (isNotEmpty(teamIds)) {
						qb.andWhere(p(`"time_log"."organizationTeamId" IN (:...teamIds)`), { teamIds });
					}
				})
			);
		const totalDuration = await totalDurationQuery.getRawOne();
		activities = activities.map((activity) => {
			activity.durationPercentage = (activity.duration * 100) / totalDuration.duration;
			return activity;
		});

		return activities || [];
	}

	/**
	 * GET Time Tracking Dashboard Time Slots Statistics
	 *
	 * @param request
	 * @returns
	 */
	async getEmployeeTimeSlots(request: IGetTimeSlotStatistics): Promise<ITimeSlotStatistics[]> {
		console.time('Get Employee TimeSlots');

		const { organizationId, startDate, endDate } = request;
		let { employeeIds = [], projectIds = [], teamIds = [] } = request;

		const user = RequestContext.currentUser();
		const tenantId = RequestContext.currentTenantId() || request.tenantId;

		const { start, end } = getDateRangeFormat(
			moment.utc(startDate || moment().startOf('week')),
			moment.utc(endDate || moment().endOf('week'))
		);

		// Check if the current user has the permission to change the selected employee
		const hasChangeSelectedEmployeePermission: boolean = RequestContext.hasPermission(
			PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
		);

		// Determine if the request specifies to retrieve data for the current user only
		const isOnlyMeSelected: boolean = request.onlyMe;

		/**
		 * Set employeeIds based on user conditions and permissions
		 */
		if ((user.employeeId && isOnlyMeSelected) || (!hasChangeSelectedEmployeePermission && user.employeeId)) {
			employeeIds = [user.employeeId];
		}

		const query = this.typeOrmTimeLogRepository.createQueryBuilder();
		query.innerJoin(`${query.alias}.employee`, 'employee');
		query.innerJoin(`${query.alias}.timeSlots`, 'time_slot');
		query.innerJoin(`employee.user`, 'user');
		query.select(p(`"${query.alias}"."employeeId"`), 'id');
		query.addSelect(p(`"employee"."isOnline"`), 'isOnline');
		query.addSelect(p(`"employee"."isAway"`), 'isAway');
		query.addSelect(p(`MAX("${query.alias}"."startedAt")`), 'startedAt');
		query.addSelect(p(`"user"."imageUrl"`), 'user_image_url');
		// Builds a SELECT statement for the "user_name" column based on the database type.
		query.addSelect(p(`${concateUserNameExpression(this.configService.dbConnectionOptions.type)}`), 'user_name');
		query.andWhere(
			new Brackets((qb: WhereExpressionBuilder) => {
				qb.andWhere(p(`"${query.alias}"."tenantId" = :tenantId`), { tenantId });
				qb.andWhere(p(`"${query.alias}"."organizationId" = :organizationId`), { organizationId });
				qb.andWhere(p(`"${query.alias}"."startedAt" BETWEEN :start AND :end`), { start, end });
			})
		);
		query.andWhere(
			new Brackets((qb: WhereExpressionBuilder) => {
				qb.andWhere(p(`"time_slot"."tenantId" = :tenantId`), { tenantId });
				qb.andWhere(p(`"time_slot"."organizationId" = :organizationId`), { organizationId });
				qb.andWhere(p(`"time_slot"."startedAt" BETWEEN :start AND :end`), { start, end });
			})
		);
		query.andWhere(
			new Brackets((qb: WhereExpressionBuilder) => {
				if (isNotEmpty(employeeIds)) {
					qb.andWhere(p(`"${query.alias}"."employeeId" IN (:...employeeIds)`), { employeeIds });
				}
				if (isNotEmpty(projectIds)) {
					qb.andWhere(p(`"${query.alias}"."projectId" IN (:...projectIds)`), { projectIds });
				}
				if (isNotEmpty(teamIds)) {
					qb.andWhere(p(`"${query.alias}"."organizationTeamId" IN (:...teamIds)`), { teamIds });
				}
			})
		);
		query.groupBy(p(`"${query.alias}"."employeeId"`));
		query.addGroupBy(p(`"user"."id"`));
		query.addGroupBy(p(`"employee"."isOnline"`));
		query.addGroupBy(p(`"employee"."isAway"`));
		query.addOrderBy(p(`"startedAt"`), 'DESC');
		query.limit(3);

		let employees: ITimeSlotStatistics[] = [];
		employees = await query.getRawMany();

		for await (const employee of employees) {
			employee.user = {
				imageUrl: employee.user_image_url,
				name: employee.user_name
			};
			delete employee.user_image_url;
			delete employee.user_name;

			const query = this.typeOrmTimeSlotRepository.createQueryBuilder();
			query.innerJoinAndSelect(`${query.alias}.timeLogs`, 'timeLogs');
			query.leftJoinAndSelect(`${query.alias}.employee`, 'employee');
			query.leftJoinAndSelect(`${query.alias}.screenshots`, 'screenshots');
			query.where((qb: SelectQueryBuilder<TimeSlot>) => {
				qb.andWhere(
					new Brackets((web: WhereExpressionBuilder) => {
						const { id: employeeId } = employee;
						web.andWhere(p(`"${query.alias}"."employeeId" = :employeeId`), { employeeId });
						web.andWhere(p(`"${query.alias}"."organizationId" = :organizationId`), { organizationId });
						web.andWhere(p(`"${query.alias}"."tenantId" = :tenantId`), { tenantId });
						web.andWhere(p(`"${query.alias}"."startedAt" BETWEEN :start AND :end`), { start, end });
					})
				);
				qb.andWhere(
					new Brackets((web: WhereExpressionBuilder) => {
						const { id: employeeId } = employee;
						web.andWhere(p(`"timeLogs"."employeeId" = :employeeId`), { employeeId });
						web.andWhere(p(`"timeLogs"."organizationId" = :organizationId`), { organizationId });
						web.andWhere(p(`"timeLogs"."tenantId" = :tenantId`), { tenantId });
						web.andWhere(p(`"timeLogs"."startedAt" BETWEEN :start AND :end`), { start, end });

						if (isNotEmpty(projectIds)) {
							web.andWhere(p(`"timeLogs"."projectId" IN (:...projectIds)`), { projectIds });
						}

						if (isNotEmpty(teamIds)) {
							web.andWhere(p(`"timeLogs"."organizationTeamId" IN (:...teamIds)`), { teamIds });
						}
					})
				);
			});
			query.orderBy(p(`"${query.alias}"."startedAt"`), 'DESC');
			query.limit(9);

			employee.timeSlots = await query.getMany();
		}

		console.timeEnd('Get Employee TimeSlots');
		return employees;
	}

	/**
	 * Get the count of employees who worked this week.
	 *
	 * @param request
	 * @returns The count of unique employees
	 */
	private async getEmployeeWorkedCounts(request: IGetCountsStatistics) {
		const query = this.typeOrmTimeLogRepository.createQueryBuilder('time_log');
		query
			.select('COUNT(DISTINCT time_log.employeeId)', 'count')
			.innerJoin('time_log.employee', 'employee')
			.innerJoin('time_log.timeSlots', 'time_slot')
			.andWhere(
				new Brackets((where: WhereExpressionBuilder) => {
					this.getFilterQuery(query, where, request);
				})
			);
		const result = await query.getRawOne();
		const count = parseInt(result.count, 10);
		return count;
	}

	/**
	 * Get the count of projects worked on this week.
	 *
	 * @param request
	 * @returns The count of unique projects
	 */
	private async getProjectWorkedCounts(request: IGetCountsStatistics) {
		const query = this.typeOrmTimeLogRepository.createQueryBuilder('time_log');
		query
			.select('COUNT(DISTINCT time_log.projectId)', 'count')
			.innerJoin('time_log.employee', 'employee')
			.innerJoin('time_log.project', 'project')
			.innerJoin('time_log.timeSlots', 'time_slot')
			.andWhere(
				new Brackets((where: WhereExpressionBuilder) => {
					this.getFilterQuery(query, where, request);
				})
			);
		const result = await query.getRawOne();
		const count = parseInt(result.count, 10);
		return count;
	}

	/**
	 * Applies filtering conditions to the given TypeORM query builder based on the provided request parameters.
	 *
	 * @param query The TypeORM query builder instance.
	 * @param qb The TypeORM WhereExpressionBuilder instance.
	 * @param request The request object containing filter parameters.
	 * @returns The modified TypeORM WhereExpressionBuilder instance with applied filtering conditions.
	 */
	private getFilterQuery(
		query: SelectQueryBuilder<TimeLog>,
		qb: WhereExpressionBuilder,
		request: IGetCountsStatistics
	): WhereExpressionBuilder {
		let {
			organizationId,
			startDate,
			endDate,
			employeeIds = [],
			projectIds = [],
			teamIds = [],
			activityLevel,
			logType,
			source,
			onlyMe: isOnlyMeSelected // Determine if the request specifies to retrieve data for the current user only
		} = request;

		const user = RequestContext.currentUser(); // Retrieve the current user
		const tenantId = RequestContext.currentTenantId() ?? request.tenantId; // Retrieve the current tenant ID

		// Check if the current user has the permission to change the selected employee
		const hasChangeSelectedEmployeePermission: boolean = RequestContext.hasPermission(
			PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
		);

		// Set employeeIds based on user conditions and permissions
		if (user.employeeId && (isOnlyMeSelected || !hasChangeSelectedEmployeePermission)) {
			employeeIds = [user.employeeId];
		}

		// Use consistent date range formatting
		const { start, end } = getDateRangeFormat(
			moment.utc(startDate || moment().startOf('week')),
			moment.utc(endDate || moment().endOf('week'))
		);

		qb.andWhere(`${query.alias}.tenantId = :tenantId`, { tenantId });
		qb.andWhere(`${query.alias}.organizationId = :organizationId`, { organizationId });
		qb.andWhere(`${query.alias}.startedAt BETWEEN :startDate AND :endDate`, { startDate: start, endDate: end });
		qb.andWhere(`time_slot.startedAt BETWEEN :startDate AND :endDate`, { startDate: start, endDate: end });

		// Apply activity level filter only if provided
		if (isNotEmpty(activityLevel)) {
			const startLevel = activityLevel.start * 6; // Start level for activity level in seconds
			const endLevel = activityLevel.end * 6; // End level for activity level in seconds

			qb.andWhere(`time_slot.overall BETWEEN :startLevel AND :endLevel`, {
				startLevel,
				endLevel
			});
		}

		// Apply log type filter if present
		if (isNotEmpty(logType)) {
			qb.andWhere(`${query.alias}.logType IN (:...logType)`, { logType });
		}

		// Apply source filter if present
		if (isNotEmpty(source)) {
			qb.andWhere(`${query.alias}.source IN (:...source)`, { source });
		}

		// Apply employee filter, optimizing joins
		if (isNotEmpty(employeeIds)) {
			qb.andWhere(`${query.alias}.employeeId IN (:...employeeIds)`, { employeeIds });
		}

		// Apply project filter
		if (isNotEmpty(projectIds)) {
			qb.andWhere(`${query.alias}.projectId IN (:...projectIds)`, { projectIds });
		}

		// Apply team filter
		if (isNotEmpty(teamIds)) {
			qb.andWhere(`${query.alias}.organizationTeamId IN (:...teamIds)`, { teamIds });
		}

		return qb;
	}
}
