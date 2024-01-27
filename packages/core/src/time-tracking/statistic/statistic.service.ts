import { MikroInjectRepository } from '@gauzy/common';
import { EntityRepository } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets, SelectQueryBuilder, WhereExpressionBuilder } from 'typeorm';
import { reduce, pluck, pick, mapObject, groupBy, chain } from 'underscore';
import * as _ from 'underscore';
import * as moment from 'moment';
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
	ITask,
	ITimeLog
} from '@gauzy/contracts';
import { ArraySum, isNotEmpty } from '@gauzy/common';
import { ConfigService, databaseTypes, isBetterSqlite3, isMySQL, isPostgres, isSqlite } from '@gauzy/config';
import { prepareSQLQuery as p } from './../../database/database.helper';
import { RequestContext } from '../../core/context';
import {
	Activity,
	Employee,
	TimeLog,
	TimeSlot
} from './../../core/entities/internal';
import { getDateRangeFormat } from './../../core/utils';

@Injectable()
export class StatisticService {
	constructor(
		@InjectRepository(TimeSlot)
		private readonly timeSlotRepository: Repository<TimeSlot>,
		@MikroInjectRepository(TimeSlot)
		private readonly mikroTimeSlotRepository: EntityRepository<TimeSlot>,

		@InjectRepository(Employee)
		private readonly employeeRepository: Repository<Employee>,

		@MikroInjectRepository(Employee)
		private readonly mikroEmployeeRepository: EntityRepository<Employee>,

		@InjectRepository(Activity)
		private readonly activityRepository: Repository<Activity>,

		@MikroInjectRepository(Activity)
		private readonly mikroActivityRepository: EntityRepository<Activity>,

		@InjectRepository(TimeLog)
		private readonly timeLogRepository: Repository<TimeLog>,

		@MikroInjectRepository(TimeLog)
		private readonly mikroTimeLogRepository: EntityRepository<TimeLog>,

		private readonly configService: ConfigService
	) { }

	/**
	 * GET Time Tracking Dashboard Counts Statistics
	 *
	 * @param request
	 * @returns
	 */
	async getCounts(request: IGetCountsStatistics): Promise<ICountsStatistics> {
		const { organizationId, startDate, endDate, todayStart, todayEnd } = request;
		let { employeeIds = [], projectIds = [] } = request;

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

		/**
		 * GET statistics counts
		 */
		const employeesCount = await this.getEmployeeWorkedCounts({
			...request,
			employeeIds
		});
		const projectsCount = await this.getProjectWorkedCounts({
			...request,
			employeeIds
		});

		/*
		 * Get average activity and total duration of the work for the week.
		 */
		let weekActivities = {
			overall: 0,
			duration: 0
		};
		const weekQuery = this.timeSlotRepository.createQueryBuilder();

		let weekQueryString: string;
		switch (this.configService.dbConnectionOptions.type) {
			case databaseTypes.sqlite:
			case databaseTypes.betterSqlite3:
				weekQueryString = `COALESCE(ROUND(SUM((julianday(COALESCE("timeLogs"."stoppedAt", datetime('now'))) - julianday("timeLogs"."startedAt")) * 86400) / COUNT("${weekQuery.alias}"."id")), 0)`;
				break;
			case databaseTypes.postgres:
				weekQueryString = `COALESCE(ROUND(SUM(extract(epoch from (COALESCE("timeLogs"."stoppedAt", NOW()) - "timeLogs"."startedAt"))) / COUNT("${weekQuery.alias}"."id")), 0)`;
				break;
			case databaseTypes.mysql:
				weekQueryString = p(`COALESCE(ROUND(SUM(TIMESTAMPDIFF(SECOND, "timeLogs"."startedAt", COALESCE("timeLogs"."stoppedAt", NOW()))) / COUNT("${weekQuery.alias}"."id")), 0)`);
				break;
			default:
				throw Error(`cannot create statistic query due to unsupported database type: ${this.configService.dbConnectionOptions.type}`);
		}

		weekQuery
			.innerJoin(`${weekQuery.alias}.timeLogs`, 'timeLogs')
			.select(weekQueryString, `week_duration`)
			.addSelect(p(`COALESCE(SUM("${weekQuery.alias}"."overall"), 0)`), `overall`)
			.addSelect(p(`COALESCE(SUM("${weekQuery.alias}"."duration"), 0)`), `duration`)
			.addSelect(p(`COUNT("${weekQuery.alias}"."id")`), `time_slot_count`)
			.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					qb.andWhere(p(`"${weekQuery.alias}"."tenantId" = :tenantId`), { tenantId });
					qb.andWhere(p(`"${weekQuery.alias}"."organizationId" = :organizationId`), { organizationId });
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
					qb.andWhere(p(`"${weekQuery.alias}"."startedAt" BETWEEN :startDate AND :endDate`), {
						startDate: start,
						endDate: end
					});
					qb.andWhere(p(`"timeLogs"."startedAt" BETWEEN :startDate AND :endDate`), {
						startDate: start,
						endDate: end
					});
					/**
					 * If Employee Selected
					 */
					if (isNotEmpty(employeeIds)) {
						qb.andWhere(p(`"${weekQuery.alias}"."employeeId" IN (:...employeeIds)`), { employeeIds });
						qb.andWhere(p(`"timeLogs"."employeeId" IN (:...employeeIds)`), { employeeIds });
					}
					/**
					 * If Project Selected
					 */
					if (isNotEmpty(projectIds)) {
						qb.andWhere(p(`"timeLogs"."projectId" IN (:...projectIds)`), { projectIds });
					}
					if (isNotEmpty(request.activityLevel)) {
						/**
						 * Activity Level should be 0-100%
						 * So, we have convert it into 10 minutes TimeSlot by multiply by 6
						 */
						const { activityLevel } = request;
						const startLevel = (activityLevel.start * 6);
						const endLevel = (activityLevel.end * 6);

						qb.andWhere(p(`"${weekQuery.alias}"."overall" BETWEEN :startLevel AND :endLevel`), {
							startLevel,
							endLevel
						});
					}
					/**
					 * If LogType Selected
					 */
					if (isNotEmpty(request.logType)) {
						const { logType } = request;
						qb.andWhere(p(`"timeLogs"."logType" IN (:...logType)`), {
							logType
						});
					}
					/**
					 * If Source Selected
					 */
					if (isNotEmpty(request.source)) {
						const { source } = request;
						qb.andWhere(p(`"timeLogs"."source" IN (:...source)`), {
							source
						});
					}
				})
			)
			.groupBy(p(`"timeLogs"."id"`));

		const weekTimeStatistics = await weekQuery.getRawMany();

		const weekDuration = reduce(pluck(weekTimeStatistics, 'week_duration'), ArraySum, 0);
		const weekPercentage = (
			(reduce(pluck(weekTimeStatistics, 'overall'), ArraySum, 0) * 100) /
			(reduce(pluck(weekTimeStatistics, 'duration'), ArraySum, 0))
		);

		weekActivities['duration'] = weekDuration;
		weekActivities['overall'] = weekPercentage;

		/*
		 * Get average activity and total duration of the work for today.
		 */
		let todayActivities = {
			overall: 0,
			duration: 0
		};

		const { start: startToday, end: endToday } = getDateRangeFormat(
			moment.utc(todayStart || moment().startOf('day')),
			moment.utc(todayEnd || moment().endOf('day'))
		);

		const todayQuery = this.timeSlotRepository.createQueryBuilder();

		let todayQueryString: string;
		switch (this.configService.dbConnectionOptions.type) {
			case databaseTypes.sqlite:
			case databaseTypes.betterSqlite3:
				todayQueryString = `COALESCE(ROUND(SUM((julianday(COALESCE("timeLogs"."stoppedAt", datetime('now'))) - julianday("timeLogs"."startedAt")) * 86400) / COUNT("${todayQuery.alias}"."id")), 0)`;
				break;
			case databaseTypes.postgres:
				todayQueryString = `COALESCE(ROUND(SUM(extract(epoch from (COALESCE("timeLogs"."stoppedAt", NOW()) - "timeLogs"."startedAt"))) / COUNT("${todayQuery.alias}"."id")), 0)`;
				break;
			case databaseTypes.mysql:
				todayQueryString = p(`COALESCE(ROUND(SUM(TIMESTAMPDIFF(SECOND, "timeLogs"."startedAt", COALESCE("timeLogs"."stoppedAt", NOW()))) / COUNT("${todayQuery.alias}"."id")), 0)`);
				break;
			default:
				throw Error(`cannot create statistic query due to unsupported database type: ${this.configService.dbConnectionOptions.type}`);
		}

		todayQuery
			.innerJoin(`${todayQuery.alias}.timeLogs`, 'timeLogs')
			.select(todayQueryString, `today_duration`)
			.addSelect(p(`COALESCE(SUM("${todayQuery.alias}"."overall"), 0)`), `overall`)
			.addSelect(p(`COALESCE(SUM("${todayQuery.alias}"."duration"), 0)`), `duration`)
			.addSelect(p(`COUNT("${todayQuery.alias}"."id")`), `time_slot_count`)
			.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					qb.andWhere(p(`"${todayQuery.alias}"."tenantId" = :tenantId`), { tenantId });
					qb.andWhere(p(`"${todayQuery.alias}"."organizationId" = :organizationId`), { organizationId });
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
					qb.andWhere(p(`"timeLogs"."startedAt" BETWEEN :startDate AND :endDate`), {
						startDate: startToday,
						endDate: endToday
					});
					qb.andWhere(p(`"${todayQuery.alias}"."startedAt" BETWEEN :startDate AND :endDate`), {
						startDate: startToday,
						endDate: endToday
					});
					/**
					 * If Employee Selected
					 */
					if (isNotEmpty(employeeIds)) {
						qb.andWhere(p(`"timeLogs"."employeeId" IN (:...employeeIds)`), {
							employeeIds
						});
						qb.andWhere(p(`"${todayQuery.alias}"."employeeId" IN (:...employeeIds)`), {
							employeeIds
						});
					}
					/**
					 * If Project Selected
					 */
					if (isNotEmpty(projectIds)) {
						qb.andWhere(p(`"timeLogs"."projectId" IN (:...projectIds)`), {
							projectIds
						});
					}
					if (isNotEmpty(request.activityLevel)) {
						/**
						 * Activity Level should be 0-100%
						 * So, we have convert it into 10 minutes TimeSlot by multiply by 6
						 */
						const { activityLevel } = request;
						const startLevel = (activityLevel.start * 6);
						const endLevel = (activityLevel.end * 6);

						qb.andWhere(p(`"${todayQuery.alias}"."overall" BETWEEN :startLevel AND :endLevel`), {
							startLevel,
							endLevel
						});
					}
					/**
					 * If LogType Selected
					 */
					if (isNotEmpty(request.logType)) {
						const { logType } = request;
						qb.andWhere(p(`"timeLogs"."logType" IN (:...logType)`), {
							logType
						});
					}
					/**
					 * If Source Selected
					 */
					if (isNotEmpty(request.source)) {
						const { source } = request;
						qb.andWhere(p(`"timeLogs"."source" IN (:...source)`), {
							source
						});
					}
				})
			)
			.groupBy(p(`"timeLogs"."id"`));

		const todayTimeStatistics = await todayQuery.getRawMany();

		const todayDuration = reduce(pluck(todayTimeStatistics, 'today_duration'), ArraySum, 0);
		const todayPercentage = (
			(reduce(pluck(todayTimeStatistics, 'overall'), ArraySum, 0) * 100) /
			(reduce(pluck(todayTimeStatistics, 'duration'), ArraySum, 0))
		);

		todayActivities['duration'] = todayDuration;
		todayActivities['overall'] = todayPercentage;

		return {
			employeesCount,
			projectsCount,
			weekActivities: parseFloat(parseFloat(weekActivities.overall + '').toFixed(2)),
			weekDuration: weekActivities.duration,
			todayActivities: parseFloat(parseFloat(todayActivities.overall + '').toFixed(2)),
			todayDuration: todayActivities.duration
		};
	}

	/**
	 * GET Time Tracking Dashboard Worked Members Statistics
	 *
	 * @param request
	 * @returns
	 */
	/**
	 * GET Time Tracking Dashboard Worked Members Statistics
	 *
	 * @param request
	 * @returns
	 */
	async getMembers(request: IGetMembersStatistics): Promise<IMembersStatistics[]> {
		const { organizationId, startDate, endDate, todayStart, todayEnd } = request;
		let { employeeIds = [], projectIds = [] } = request;

		const user = RequestContext.currentUser();
		const tenantId = RequestContext.currentTenantId() || request.tenantId;

		const { start: weeklyStart, end: weeklyEnd } = getDateRangeFormat(
			moment.utc(startDate || moment().startOf('week')),
			moment.utc(endDate || moment().endOf('week'))
		);

		// Check if the current user has the permission to change the selected employee
		const hasChangeSelectedEmployeePermission: boolean = RequestContext.hasPermission(
			PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
		);

		/**
		 * Set employeeIds based on user conditions and permissions
		 */
		if ((user.employeeId) || (!hasChangeSelectedEmployeePermission && user.employeeId)) {
			employeeIds = [user.employeeId];
		}

		let queryString: string;
		switch (this.configService.dbConnectionOptions.type) {
			case databaseTypes.sqlite:
			case databaseTypes.betterSqlite3:
				queryString = `COALESCE(ROUND(SUM((julianday(COALESCE("timeLogs"."stoppedAt", datetime('now'))) - julianday("timeLogs"."startedAt")) * 86400)), 0)`;
				break;
			case databaseTypes.postgres:
				queryString = `COALESCE(ROUND(SUM(extract(epoch from (COALESCE("timeLogs"."stoppedAt", NOW()) - "timeLogs"."startedAt")))), 0)`;
				break;
			case databaseTypes.mysql:
				queryString = p(`COALESCE(ROUND(SUM(TIMESTAMPDIFF(SECOND, "timeLogs"."startedAt", COALESCE("timeLogs"."stoppedAt", NOW())))), 0)`);
				break;
			default:
				throw Error(`cannot create statistic query due to unsupported database type: ${this.configService.dbConnectionOptions.type}`);
		}

		const query = this.employeeRepository.createQueryBuilder();
		let employees: IMembersStatistics[] = await query
			.select(p(`"${query.alias}".id`))
			.addSelect(p(`CONCAT("user"."firstName", ' ', "user"."lastName")`), 'user_name')
			.addSelect(p(`"user"."imageUrl"`), 'user_image_url')
			.addSelect(queryString, `duration`)
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
						qb.andWhere(p(`"${query.alias}"."id" IN(:...employeeIds)`), {
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
						qb.andWhere(p(`"timeLogs"."projectId" IN (:...projectIds)`), { projectIds });
					}
				})
			)
			.addGroupBy(p(`"${query.alias}"."id"`))
			.addGroupBy(p(`"user"."id"`))
			.orderBy('duration', 'DESC')
			.getRawMany();
		if (employees.length > 0) {
			const employeeIds = pluck(employees, 'id');

			/**
			 * Weekly Member Activity
			 */
			const weekTimeQuery = this.timeSlotRepository.createQueryBuilder('time_slot');

			let weekTimeQueryString: string;
			switch (this.configService.dbConnectionOptions.type) {
				case databaseTypes.sqlite:
				case databaseTypes.betterSqlite3:
					weekTimeQueryString = `COALESCE(ROUND(SUM((julianday(COALESCE("timeLogs"."stoppedAt", datetime('now'))) - julianday("timeLogs"."startedAt")) * 86400) / COUNT("${weekTimeQuery.alias}"."id")), 0)`;
					break;
				case databaseTypes.postgres:
					weekTimeQueryString = `COALESCE(ROUND(SUM(extract(epoch from (COALESCE("timeLogs"."stoppedAt", NOW()) - "timeLogs"."startedAt"))) / COUNT("${weekTimeQuery.alias}"."id")), 0)`;
					break;
				case databaseTypes.mysql:
					weekTimeQueryString = p(`COALESCE(ROUND(SUM(TIMESTAMPDIFF(SECOND, "timeLogs"."startedAt", COALESCE("timeLogs"."stoppedAt", NOW()))) / COUNT("${weekTimeQuery.alias}"."id")), 0)`);
					break;
				default:
					throw Error(`cannot create statistic query due to unsupported database type: ${this.configService.dbConnectionOptions.type}`);
			}

			weekTimeQuery
				.select(weekTimeQueryString, `week_duration`)
				.addSelect(p(`COALESCE(SUM("${weekTimeQuery.alias}"."overall"), 0)`), `overall`)
				.addSelect(p(`COALESCE(SUM("${weekTimeQuery.alias}"."duration"), 0)`), `duration`)
				.addSelect(p(`COUNT("${weekTimeQuery.alias}"."id")`), `time_slot_count`)
				.addSelect(`${weekTimeQuery.alias}.employeeId`, 'employeeId')
				.innerJoin(`${weekTimeQuery.alias}.timeLogs`, 'timeLogs')
				.andWhere(
					new Brackets((qb: WhereExpressionBuilder) => {
						qb.andWhere(p(`"${weekTimeQuery.alias}"."tenantId" = :tenantId`), { tenantId });
						qb.andWhere(p(`"${weekTimeQuery.alias}"."organizationId" = :organizationId`), { organizationId });
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
					})
				)
				.groupBy(`timeLogs.id`)
				.addGroupBy(`${weekTimeQuery.alias}.employeeId`);

			let weekTimeSlots: any = await weekTimeQuery.getRawMany();

			weekTimeSlots = mapObject(groupBy(weekTimeSlots, 'employeeId'), (values, employeeId) => {
				const weekDuration = reduce(pluck(values, 'week_duration'), ArraySum, 0);
				const weekPercentage = (
					(reduce(pluck(values, 'overall'), ArraySum, 0) * 100) /
					(reduce(pluck(values, 'duration'), ArraySum, 0))
				);
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
			let dayTimeQuery = this.timeSlotRepository.createQueryBuilder('time_slot');

			let dayTimeQueryString: string;
			switch (this.configService.dbConnectionOptions.type) {
				case databaseTypes.sqlite:
				case databaseTypes.betterSqlite3:
					dayTimeQueryString = `COALESCE(ROUND(SUM((julianday(COALESCE("timeLogs"."stoppedAt", datetime('now'))) - julianday("timeLogs"."startedAt")) * 86400) / COUNT("${dayTimeQuery.alias}"."id")), 0)`;
					break;
				case databaseTypes.postgres:
					dayTimeQueryString = `COALESCE(ROUND(SUM(extract(epoch from (COALESCE("timeLogs"."stoppedAt", NOW()) - "timeLogs"."startedAt"))) / COUNT("${dayTimeQuery.alias}"."id")), 0)`;
					break;
				case databaseTypes.mysql:
					dayTimeQueryString = p(`COALESCE(ROUND(SUM(TIMESTAMPDIFF(SECOND, "timeLogs"."startedAt", COALESCE("timeLogs"."stoppedAt", NOW()))) / COUNT("${dayTimeQuery.alias}"."id")), 0)`);
					break;
				default:
					throw Error(`cannot create statistic query due to unsupported database type: ${this.configService.dbConnectionOptions.type}`);
			}

			dayTimeQuery
				.select(dayTimeQueryString, `today_duration`)
				.addSelect(p(`COALESCE(SUM("${dayTimeQuery.alias}"."overall"), 0)`), `overall`)
				.addSelect(p(`COALESCE(SUM("${dayTimeQuery.alias}"."duration"), 0)`), `duration`)
				.addSelect(p(`COUNT("${dayTimeQuery.alias}"."id")`), `time_slot_count`)
				.addSelect(`${dayTimeQuery.alias}.employeeId`, 'employeeId')
				.innerJoin(`${dayTimeQuery.alias}.timeLogs`, 'timeLogs')
				.andWhere(
					new Brackets((qb: WhereExpressionBuilder) => {
						qb.andWhere(p(`"${dayTimeQuery.alias}"."tenantId" = :tenantId`), { tenantId });
						qb.andWhere(p(`"${dayTimeQuery.alias}"."organizationId" = :organizationId`), { organizationId });
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
							qb.andWhere(p(`"${dayTimeQuery.alias}"."employeeId" IN(:...employeeIds)`), {
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
					})
				)
				.groupBy(`timeLogs.id`)
				.addGroupBy(`${dayTimeQuery.alias}.employeeId`);

			let dayTimeSlots: any = await dayTimeQuery.getRawMany();
			dayTimeSlots = mapObject(groupBy(dayTimeSlots, 'employeeId'), (values, employeeId) => {
				const todayDuration = reduce(pluck(values, 'today_duration'), ArraySum, 0);
				const todayPercentage = (
					(reduce(pluck(values, 'overall'), ArraySum, 0) * 100) /
					(reduce(pluck(values, 'duration'), ArraySum, 0))
				);
				return {
					employeeId,
					duration: todayDuration,
					overall: todayPercentage
				};
			});
			dayTimeSlots = chain(dayTimeSlots)
				.map((dayTimeSlot: any) => {
					if (dayTimeSlot && dayTimeSlot.overall) {
						dayTimeSlot.overall = parseFloat(
							dayTimeSlot.overall as string
						).toFixed(1);
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

				let weekHoursQueryString: string;
				switch (this.configService.dbConnectionOptions.type) {
					case databaseTypes.sqlite:
					case databaseTypes.betterSqlite3:
						weekHoursQueryString = `COALESCE(ROUND(SUM((julianday(COALESCE("timeLogs"."stoppedAt", datetime('now'))) - julianday("timeLogs"."startedAt")) * 86400)), 0)`;
						break;
					case databaseTypes.postgres:
						weekHoursQueryString = `COALESCE(ROUND(SUM(extract(epoch from (COALESCE("timeLogs"."stoppedAt", NOW()) - "timeLogs"."startedAt")))), 0)`;
						break;
					case databaseTypes.mysql:
						weekHoursQueryString = p(`COALESCE(ROUND(SUM(TIMESTAMPDIFF(SECOND, "timeLogs"."startedAt", COALESCE("timeLogs"."stoppedAt", NOW())))), 0)`);
						break;
					default:
						throw Error(`cannot create statistic query due to unsupported database type: ${this.configService.dbConnectionOptions.type}`);
				}

				const weekHoursQuery = this.employeeRepository.createQueryBuilder();
				weekHoursQuery
					.innerJoin(`${weekHoursQuery.alias}.timeLogs`, 'timeLogs')
					.innerJoin(`timeLogs.timeSlots`, 'time_slot')
					.select(weekHoursQueryString, `duration`)
					.addSelect(
						// -- why we minus 1 if MySQL is selected, Sunday DOW in postgres is 0, in MySQL is 1
						// -- in case no database type is selected we return "0" as the DOW
						isSqlite() || isBetterSqlite3() ? `(strftime('%w', timeLogs.startedAt))`
							: isPostgres() ? 'EXTRACT(DOW FROM "timeLogs"."startedAt")'
								: isMySQL() ? p('DayOfWeek("timeLogs"."startedAt") - 1') : '0'
						, 'day'
					)
					.andWhere(p(`"${weekHoursQuery.alias}"."id" = :memberId`), { memberId: member.id })
					.andWhere(
						new Brackets((qb: WhereExpressionBuilder) => {
							qb.andWhere(p(`"${weekHoursQuery.alias}"."tenantId" = :tenantId`), { tenantId });
							qb.andWhere(p(`"${weekHoursQuery.alias}"."organizationId" = :organizationId`), { organizationId });
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
								qb.andWhere(p(`"timeLogs"."employeeId" IN (:...employeeIds)`), {
									employeeIds
								});
							}
							if (isNotEmpty(projectIds)) {
								qb.andWhere(p(`"timeLogs"."projectId" IN (:...projectIds)`), {
									projectIds
								});
							}
						})
					)
					.addGroupBy(
						isSqlite() || isBetterSqlite3() ? `(strftime('%w', timeLogs.startedAt))`
							: isPostgres() ? 'EXTRACT(DOW FROM "timeLogs"."startedAt")'
								: isMySQL() ? p('DayOfWeek("timeLogs"."startedAt") - 1') : '0'
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
		let { employeeIds = [], projectIds = [] } = request;

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

		const query = this.timeLogRepository.createQueryBuilder('time_log');

		let queryString: string;
		switch (this.configService.dbConnectionOptions.type) {
			case databaseTypes.sqlite:
			case databaseTypes.betterSqlite3:
				queryString = `COALESCE(ROUND(SUM((julianday(COALESCE("${query.alias}"."stoppedAt", datetime('now'))) - julianday("${query.alias}"."startedAt")) * 86400) / COUNT("time_slot"."id")), 0)`;
				break;
			case databaseTypes.postgres:
				queryString = `COALESCE(ROUND(SUM(extract(epoch from (COALESCE("${query.alias}"."stoppedAt", NOW()) - "${query.alias}"."startedAt"))) / COUNT("time_slot"."id")), 0)`;
				break;
			case databaseTypes.mysql:
				queryString = p(`COALESCE(ROUND(SUM(TIMESTAMPDIFF(SECOND, "${query.alias}"."startedAt", COALESCE("${query.alias}"."stoppedAt", NOW()))) / COUNT("time_slot"."id")), 0)`);
				break;
			default:
				throw Error(`cannot create statistic query due to unsupported database type: ${this.configService.dbConnectionOptions.type}`);
		}

		query
			.select(p(`"project"."name"`), "name")
			.addSelect(p(`"project"."id"`), "projectId")
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
					})
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
				} as IProjectsStatistics
			})
			.value()
			.splice(0, 5);

		const totalDurationQuery = this.timeLogRepository.createQueryBuilder('time_log');

		let totalDurationQueryString: string;
		switch (this.configService.dbConnectionOptions.type) {
			case databaseTypes.sqlite:
			case databaseTypes.betterSqlite3:
				totalDurationQueryString = `COALESCE(ROUND(SUM((julianday(COALESCE("${totalDurationQuery.alias}"."stoppedAt", datetime('now'))) - julianday("${totalDurationQuery.alias}"."startedAt")) * 86400)), 0)`;
				break;
			case databaseTypes.postgres:
				totalDurationQueryString = `COALESCE(ROUND(SUM(extract(epoch from (COALESCE("${totalDurationQuery.alias}"."stoppedAt", NOW()) - "${totalDurationQuery.alias}"."startedAt")))), 0)`;
				break;
			case databaseTypes.mysql:
				totalDurationQueryString = p(`COALESCE(ROUND(SUM(TIMESTAMPDIFF(SECOND, "${totalDurationQuery.alias}"."startedAt", COALESCE("${totalDurationQuery.alias}"."stoppedAt", NOW())))), 0)`);
				break;
			default:
				throw Error(`cannot create statistic query due to unsupported database type: ${this.configService.dbConnectionOptions.type}`);
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
					qb.andWhere(p(`"${totalDurationQuery.alias}"."organizationId" = :organizationId`), { organizationId });
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
				})
			);
		const totalDuration = await totalDurationQuery.getRawOne();
		projects = projects.map((project: IProjectsStatistics) => {
			project.durationPercentage = parseFloat(
				parseFloat(
					(project.duration * 100) / totalDuration.duration + ''
				).toFixed(2)
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
		let { employeeIds = [], projectIds = [], taskIds = [], defaultRange, unitOfTime, todayEnd, todayStart } = request;

		const user = RequestContext.currentUser();
		const tenantId = RequestContext.currentTenantId() || request.tenantId;

		let start: string | Date;
		let end: string | Date;

		if (startDate && endDate) {
			const range = getDateRangeFormat(
				moment.utc(startDate),
				moment.utc(endDate)
			);
			start = range.start;
			end = range.end;
		} else {
			if (typeof defaultRange === 'boolean' && defaultRange) {
				const range = getDateRangeFormat(
					moment().startOf(unitOfTime || 'week').utc(),
					moment().endOf(unitOfTime || 'week').utc()
				);
				start = range.start;
				end = range.end;
			}
		}

		/*
		 *  Get employees id of the organization or get current employee id
		 */
		if (
			user &&
			user.employeeId &&
			(onlyMe ||
				!RequestContext.hasPermission(
					PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
				))
		) {
			if (
				isNotEmpty(organizationTeamId) ||
				RequestContext.hasPermission(
					PermissionsEnum.ORG_MEMBER_LAST_LOG_VIEW
				)
			) {
				employeeIds = [...employeeIds];
			} else {
				employeeIds = [user.employeeId];
			}
		}

		if (todayStart && todayEnd) {
			const range = getDateRangeFormat(
				moment.utc(todayStart),
				moment.utc(todayEnd)
			);
			todayStart = range.start;
			todayEnd = range.end;
		} else {
			if (typeof defaultRange === 'boolean' && defaultRange) {
				const range = getDateRangeFormat(
					moment()
						.startOf(unitOfTime || 'week')
						.utc(),
					moment()
						.endOf(unitOfTime || 'week')
						.utc()
				);
				todayStart = range.start;
				todayEnd = range.end;
			}
		}

		const todayQuery = this.timeLogRepository.createQueryBuilder();

		let todayQueryString: string;
		switch (this.configService.dbConnectionOptions.type) {
			case databaseTypes.sqlite:
			case databaseTypes.betterSqlite3:
				todayQueryString = `COALESCE(ROUND(SUM((julianday(COALESCE("${todayQuery.alias}"."stoppedAt", datetime('now'))) - julianday("${todayQuery.alias}"."startedAt")) * 86400) / COUNT("time_slot"."id")), 0)`;
				break;
			case databaseTypes.postgres:
				todayQueryString = `COALESCE(ROUND(SUM(extract(epoch from (COALESCE("${todayQuery.alias}"."stoppedAt", NOW()) - "${todayQuery.alias}"."startedAt"))) / COUNT("time_slot"."id")), 0)`;
				break;
			case databaseTypes.mysql:
				todayQueryString = p(`COALESCE(ROUND(SUM(TIMESTAMPDIFF(SECOND, "${todayQuery.alias}"."startedAt", COALESCE("${todayQuery.alias}"."stoppedAt", NOW()))) / COUNT("time_slot"."id")), 0)`);
				break;
			default:
				throw Error(`cannot create statistic query due to unsupported database type: ${this.configService.dbConnectionOptions.type}`);
		}

		todayQuery
			.select(p(`"task"."title"`), 'title')
			.addSelect(p(`"task"."id"`), 'taskId')
			.addSelect(p(`"${todayQuery.alias}"."updatedAt"`), 'updatedAt')
			.addSelect(todayQueryString, `today_duration`)
			.innerJoin(`${todayQuery.alias}.task`, 'task')
			.innerJoin(`${todayQuery.alias}.timeSlots`, 'time_slot')
			.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					if (todayStart && todayEnd) {
						qb.andWhere(p(`"${todayQuery.alias}"."startedAt" BETWEEN :todayStart AND :todayEnd`), {
							todayStart,
							todayEnd
						});
						qb.andWhere(p(`"time_slot"."startedAt" BETWEEN :todayStart AND :todayEnd`), {
							todayStart,
							todayEnd
						});
					}
				})
			)
			.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					qb.andWhere(p(`"${todayQuery.alias}"."tenantId" = :tenantId`), { tenantId });
					qb.andWhere(p(`"${todayQuery.alias}"."organizationId" = :organizationId`), { organizationId });
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
						qb.andWhere(p(`"${todayQuery.alias}"."employeeId" IN (:...employeeIds)`), {
							employeeIds
						});
						qb.andWhere(p(`"time_slot"."employeeId" IN (:...employeeIds)`), {
							employeeIds
						});
					}
					if (isNotEmpty(projectIds)) {
						qb.andWhere(p(`"${todayQuery.alias}"."projectId" IN (:...projectIds)`), {
							projectIds
						});
					}
					if (isNotEmpty(taskIds)) {
						qb.andWhere(p(`"${todayQuery.alias}"."taskId" IN (:...taskIds)`), {
							taskIds
						});
					}
					if (isNotEmpty(organizationTeamId)) {
						qb.andWhere(p(`"${todayQuery.alias}"."organizationTeamId" = :organizationTeamId`), {
							organizationTeamId
						});
					}
				})
			)
			.groupBy(p(`"${todayQuery.alias}"."id"`))
			.addGroupBy(p(`"task"."id"`))
			.orderBy(p(`"${todayQuery.alias}"."updatedAt"`), 'DESC');

		const todayStatistics = await todayQuery.getRawMany();

		const query = this.timeLogRepository.createQueryBuilder();

		let queryString: string;
		switch (this.configService.dbConnectionOptions.type) {
			case databaseTypes.sqlite:
			case databaseTypes.betterSqlite3:
				queryString = `COALESCE(ROUND(SUM((julianday(COALESCE("${query.alias}"."stoppedAt", datetime('now'))) - julianday("${query.alias}"."startedAt")) * 86400) / COUNT("time_slot"."id")), 0)`;
				break;
			case databaseTypes.postgres:
				queryString = `COALESCE(ROUND(SUM(extract(epoch from (COALESCE("${query.alias}"."stoppedAt", NOW()) - "${query.alias}"."startedAt"))) / COUNT("time_slot"."id")), 0)`;
				break;
			case databaseTypes.mysql:
				queryString = p(`COALESCE(ROUND(SUM(TIMESTAMPDIFF(SECOND, "${query.alias}"."startedAt", COALESCE("${query.alias}"."stoppedAt", NOW()))) / COUNT("time_slot"."id")), 0)`);
				break;
			default:
				throw Error(`cannot create statistic query due to unsupported database type: ${this.configService.dbConnectionOptions.type}`);
		}

		query
			.select(p(`"task"."title"`), "title")
			.addSelect(p(`"task"."id"`), "taskId")
			.addSelect(p(`"${query.alias}"."updatedAt"`), 'updatedAt')
			.addSelect(queryString, `duration`)
			.innerJoin(`${query.alias}.task`, 'task')
			.innerJoin(`${query.alias}.timeSlots`, 'time_slot')
			.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					if (start && end) {
						qb.andWhere(p(`"${query.alias}"."startedAt" BETWEEN :start AND :end`), {
							start,
							end
						});
						qb.andWhere(p(`"time_slot"."startedAt" BETWEEN :start AND :end`), {
							start,
							end
						});
					}
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
					}
					if (isNotEmpty(taskIds)) {
						qb.andWhere(p(`"${query.alias}"."taskId" IN (:...taskIds)`), {
							taskIds
						});
					}
					if (isNotEmpty(organizationTeamId)) {
						qb.andWhere(p(`"${query.alias}"."organizationTeamId" = :organizationTeamId`), {
							organizationTeamId
						});
					}
				})
			)
			.groupBy(p(`"${query.alias}"."id"`))
			.addGroupBy(p(`"task"."id"`))
			.orderBy(p(`"${todayQuery.alias}"."updatedAt"`), 'DESC');
		const statistics = await query.getRawMany();
		const mergedStatistics = _.map(statistics, (statistic) => {
			const updatedAt = String(statistic.updatedAt);
			return _.extend(
				{
					today_duration: 0,
					...statistic,
					updatedAt,
				},
				_.findWhere(
					todayStatistics.map((today) => ({
						...today,
						updatedAt: String(today.updatedAt),
					})),
					{
						taskId: statistic.taskId,
						updatedAt,
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
		if (isNotEmpty(take)) { tasks = tasks.splice(0, take); }

		const totalDurationQuery = this.timeLogRepository.createQueryBuilder();

		let totalDurationQueryString: string;
		switch (this.configService.dbConnectionOptions.type) {
			case databaseTypes.sqlite:
			case databaseTypes.betterSqlite3:
				totalDurationQueryString = `COALESCE(ROUND(SUM((julianday(COALESCE("${totalDurationQuery.alias}"."stoppedAt", datetime('now'))) - julianday("${totalDurationQuery.alias}"."startedAt")) * 86400)), 0)`;
				break;
			case databaseTypes.postgres:
				totalDurationQueryString = `COALESCE(ROUND(SUM(extract(epoch from (COALESCE("${totalDurationQuery.alias}"."stoppedAt", NOW()) - "${totalDurationQuery.alias}"."startedAt")))), 0)`;
				break;
			case databaseTypes.mysql:
				totalDurationQueryString = p(`COALESCE(ROUND(SUM(TIMESTAMPDIFF(SECOND, "${totalDurationQuery.alias}"."startedAt", COALESCE("${totalDurationQuery.alias}"."stoppedAt", NOW())))), 0)`);
				break;
			default:
				throw Error(`cannot create statistic query due to unsupported database type: ${this.configService.dbConnectionOptions.type}`);
		}

		totalDurationQuery
			.select(totalDurationQueryString, `duration`)
			.innerJoin(`${totalDurationQuery.alias}.task`, 'task')
			.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					if (start && end) {
						qb.andWhere(p(`"${totalDurationQuery.alias}"."startedAt" BETWEEN :start AND :end`), {
							start,
							end
						});
					}
				})
			)
			.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					qb.andWhere(p(`"${totalDurationQuery.alias}"."tenantId" = :tenantId`), { tenantId });
					qb.andWhere(p(`"${totalDurationQuery.alias}"."organizationId" = :organizationId`), { organizationId });
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
					}
					if (isNotEmpty(organizationTeamId)) {
						qb.andWhere(p(`"${totalDurationQuery.alias}"."organizationTeamId" = :organizationTeamId`), {
							organizationTeamId
						});
					}
				})
			);
		const totalDuration = await totalDurationQuery.getRawOne();
		tasks = tasks.map((task: any) => {
			task.durationPercentage = parseFloat(
				parseFloat(
					(task.duration * 100) / totalDuration.duration + ''
				).toFixed(2)
			);
			return task;
		});
		return tasks || [];
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
		let { employeeIds = [], projectIds = [] } = request;

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

		const query = this.timeLogRepository.createQueryBuilder("time_log");
		query.innerJoin(`${query.alias}.timeSlots`, 'timeSlots');
		query.leftJoinAndSelect(`${query.alias}.project`, 'project');
		query.leftJoinAndSelect(`${query.alias}.employee`, 'employee');
		query.leftJoinAndSelect(`employee.user`, 'user');
		query.setFindOptions({
			take: 5,
			order: {
				startedAt: "DESC"
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
				})
			);
		});
		const timeLogs = await query.getMany();

		const mappedTimeLogs: IManualTimesStatistics[] = timeLogs.map((timeLog: ITimeLog): IManualTimesStatistics => ({
			id: timeLog.id,
			startedAt: timeLog.startedAt,
			duration: timeLog.duration,
			user: { ...pick(timeLog.employee.user, ['name', 'imageUrl']) },
			project: { ...pick(timeLog.project, ['name', 'imageUrl']) },
			employeeId: timeLog.employee.id,
		}));

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
		let { employeeIds = [], projectIds = [] } = request;

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

		const query = this.activityRepository.createQueryBuilder();
		let queryString;

		switch (this.configService.dbConnectionOptions.type) {
			case databaseTypes.sqlite:
			case databaseTypes.betterSqlite3:
				queryString = `datetime("${query.alias}"."date" || ' ' || "${query.alias}"."time") Between :start AND :end`;
				break;
			case databaseTypes.postgres:
				queryString = `concat("${query.alias}"."date", ' ', "${query.alias}"."time")::timestamp Between :start AND :end`;
				break;
			case databaseTypes.mysql:
				queryString = p(`CONCAT("${query.alias}"."date", ' ', "${query.alias}"."time") BETWEEN :start AND :end`);
				break;
			default:
				throw Error(`cannot create statistic query due to unsupported database type: ${this.configService.dbConnectionOptions.type}`);
		}

		query
			.select(p(`COUNT("${query.alias}"."id")`), `sessions`)
			.addSelect(p(`SUM("${query.alias}"."duration")`), `duration`)
			.addSelect(p(`"${query.alias}"."title"`), `title`)
			.innerJoin(`${query.alias}.timeSlot`, 'time_slot')
			.innerJoin(`time_slot.timeLogs`, 'time_log')
			.addGroupBy(p(`"${query.alias}"."title"`))
			.andWhere(
				new Brackets((qb) => {
					qb.andWhere(queryString, { start, end });
				})
			)
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
						qb.andWhere(p(`"${query.alias}"."employeeId" IN (:...employeeIds)`), {
							employeeIds
						});
					}
					if (isNotEmpty(projectIds)) {
						qb.andWhere(p(`"${query.alias}"."projectId" IN (:...projectIds)`), {
							projectIds
						});
					}
				})
			)
			.orderBy(p(`"duration"`), 'DESC')
			.limit(5);
		let activities: IActivitiesStatistics[] = await query.getRawMany();

		/*
		* Fetch total duration of the week for calculate duration percentage
		*/
		const totalDurationQuery = this.activityRepository.createQueryBuilder();
		let totalDurationQueryString: string;

		switch (this.configService.dbConnectionOptions.type) {
			case databaseTypes.sqlite:
			case databaseTypes.betterSqlite3:
				totalDurationQueryString = `datetime("${totalDurationQuery.alias}"."date" || ' ' || "${totalDurationQuery.alias}"."time") Between :start AND :end`;
				break;
			case databaseTypes.postgres:
				totalDurationQueryString = `concat("${totalDurationQuery.alias}"."date", ' ', "${totalDurationQuery.alias}"."time")::timestamp Between :start AND :end`;
				break;
			case databaseTypes.mysql:
				totalDurationQueryString = p(`CONCAT("${totalDurationQuery.alias}"."date", ' ', "${totalDurationQuery.alias}"."time") BETWEEN :start AND :end`);
				break;
			default:
				throw Error(`cannot create statistic query due to unsupported database type: ${this.configService.dbConnectionOptions.type}`);
		}

		totalDurationQuery
			.select(p(`SUM("${totalDurationQuery.alias}"."duration")`), `duration`)
			.innerJoin(`${totalDurationQuery.alias}.timeSlot`, 'time_slot')
			.innerJoin(`time_slot.timeLogs`, 'time_log')
			.andWhere(
				new Brackets((qb) => {
					qb.andWhere(totalDurationQueryString, { start, end });
				})
			)
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
					qb.andWhere(p(`"${totalDurationQuery.alias}"."organizationId" = :organizationId`), { organizationId });
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
						qb.andWhere(p(`"${totalDurationQuery.alias}"."projectId" IN (:...projectIds)`), {
							projectIds
						});
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
		let { employeeIds = [], projectIds = [] } = request;

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

		const query = this.timeLogRepository.createQueryBuilder();
		query.innerJoin(`${query.alias}.employee`, 'employee');
		query.innerJoin(`${query.alias}.timeSlots`, 'time_slot');
		query.innerJoin(`employee.user`, "user");
		query.select(p(`"${query.alias}"."employeeId"`), "id");
		query.addSelect(p(`MAX("${query.alias}"."startedAt")`), "startedAt");
		query.addSelect(p(`"user"."imageUrl"`), "user_image_url");
		query.addSelect(p(`CONCAT("user"."firstName", ' ', "user"."lastName")`), 'user_name');
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
			})
		);
		query.groupBy(p(`"${query.alias}"."employeeId"`));
		query.addGroupBy(p(`"user"."id"`));
		query.addOrderBy(p(`"startedAt"`), "DESC");
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

			const query = this.timeSlotRepository.createQueryBuilder();
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
	 * Get employees count who worked in this week.
	 *
	 * @param request
	 * @returns
	 */
	private async getEmployeeWorkedCounts(request: IGetCountsStatistics) {
		const query = this.timeLogRepository.createQueryBuilder('time_log');
		query.select(p(`"${query.alias}"."employeeId"`), 'employeeId');
		query.innerJoin(`${query.alias}.employee`, 'employee');
		query.innerJoin(`${query.alias}.timeSlots`, 'time_slot');
		query.andWhere(
			new Brackets((where: WhereExpressionBuilder) => {
				this.getFilterQuery(query, where, request);
			})
		)
		query.groupBy(p(`"${query.alias}"."employeeId"`));
		const employees = await query.getRawMany();
		return employees.length;
	}

	/**
	 * Get projects count who worked in this week.
	 *
	 * @param request
	 * @returns
	 */
	private async getProjectWorkedCounts(request: IGetCountsStatistics) {
		const query = this.timeLogRepository.createQueryBuilder('time_log');
		query.select(p(`"${query.alias}"."projectId"`), 'projectId');
		query.innerJoin(`${query.alias}.employee`, 'employee');
		query.innerJoin(`${query.alias}.project`, 'project');
		query.innerJoin(`${query.alias}.timeSlots`, 'time_slot');
		query.andWhere(
			new Brackets((where: WhereExpressionBuilder) => {
				this.getFilterQuery(query, where, request);
			})
		)
		query.groupBy(p(`"${query.alias}"."projectId"`));
		const projects = await query.getRawMany();
		return projects.length;
	}

	/**
	 * GET filter common query request
	 *
	 * @param query
	 * @param qb
	 * @param request
	 * @returns
	 */
	private getFilterQuery(
		query: SelectQueryBuilder<TimeLog>,
		qb: WhereExpressionBuilder,
		request: IGetCountsStatistics
	) {
		const { organizationId, startDate, endDate, employeeIds = [], projectIds = [] } = request;
		const tenantId = RequestContext.currentTenantId() || request.tenantId;

		const { start, end } = getDateRangeFormat(
			moment.utc(startDate || moment().startOf('week')),
			moment.utc(endDate || moment().endOf('week'))
		);

		qb.andWhere(
			new Brackets((qb: WhereExpressionBuilder) => {
				qb.andWhere(p(`"${query.alias}"."tenantId" = :tenantId`), { tenantId });
				qb.andWhere(p(`"${query.alias}"."organizationId" = :organizationId`), { organizationId });
			})
		);
		qb.andWhere(
			new Brackets((qb: WhereExpressionBuilder) => {
				qb.andWhere(p(`"${query.alias}"."startedAt" BETWEEN :startDate AND :endDate`), {
					startDate: start,
					endDate: end
				});
				qb.andWhere(p(`"time_slot"."startedAt" BETWEEN :startDate AND :endDate`), {
					startDate: start,
					endDate: end
				});
			})
		);
		qb.andWhere(
			new Brackets((qb: WhereExpressionBuilder) => {
				if (isNotEmpty(request.activityLevel)) {
					/**
					 * Activity Level should be 0-100%
					 * So, we have convert it into 10 minutes TimeSlot by multiply by 6
					 */
					const { activityLevel } = request;
					const startLevel = (activityLevel.start * 6);
					const endLevel = (activityLevel.end * 6);

					qb.andWhere(p(`"time_slot"."overall" BETWEEN :startLevel AND :endLevel`), {
						startLevel,
						endLevel
					});
				}
				if (isNotEmpty(request.logType)) {
					const { logType } = request;
					qb.andWhere(p(`"${query.alias}"."logType" IN (:...logType)`), {
						logType
					});
				}
				if (isNotEmpty(request.source)) {
					const { source } = request;
					qb.andWhere(p(`"${query.alias}"."source" IN (:...source)`), {
						source
					});
				}
			})
		);
		qb.andWhere(
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
				}
			})
		);
		return qb;
	}
}
