import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, SelectQueryBuilder, WhereExpressionBuilder } from 'typeorm';
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
	ITimeLog
} from '@gauzy/contracts';
import { ArraySum, isNotEmpty } from '@gauzy/common';
import { ConfigService, DatabaseTypeEnum, isBetterSqlite3, isMySQL, isPostgres, isSqlite } from '@gauzy/config';
import { concateUserNameExpression, getTasksDurationQueryString, getTasksTodayDurationQueryString, getTasksTotalDurationQueryString } from './statistic.helper';
import { prepareSQLQuery as p } from './../../database/database.helper';
import { RequestContext } from '../../core/context';
import { TimeLog, TimeSlot } from './../../core/entities/internal';
import { getDateRangeFormat } from './../../core/utils';
import { TypeOrmTimeSlotRepository } from '../../time-tracking/time-slot/repository/type-orm-time-slot.repository';
import { MikroOrmTimeSlotRepository } from '../../time-tracking/time-slot/repository/mikro-orm-time-slot.repository';
import { TypeOrmEmployeeRepository } from '../../employee/repository/type-orm-employee.repository';
import { MikroOrmEmployeeRepository } from '../../employee/repository/mikro-orm-employee.repository';
import { MikroOrmActivityRepository, TypeOrmActivityRepository } from '../activity/repository';
import { MikroOrmTimeLogRepository, TypeOrmTimeLogRepository } from '../time-log/repository';

@Injectable()
export class StatisticService {
	constructor(
		@InjectRepository(TimeSlot)
		private readonly typeOrmTimeSlotRepository: TypeOrmTimeSlotRepository,
		readonly mikroOrmTimeSlotRepository: MikroOrmTimeSlotRepository,
		private readonly typeOrmEmployeeRepository: TypeOrmEmployeeRepository,
		readonly mikroEmployeeRepository: MikroOrmEmployeeRepository,
		readonly typeOrmActivityRepository: TypeOrmActivityRepository,
		readonly mikroOrmActivityRepository: MikroOrmActivityRepository,
		private readonly typeOrmTimeLogRepository: TypeOrmTimeLogRepository,
		readonly mikroOrmTimeLogRepository: MikroOrmTimeLogRepository,
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
		const weekQuery = this.typeOrmTimeSlotRepository.createQueryBuilder();

		let weekQueryString: string;
		switch (this.configService.dbConnectionOptions.type) {
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
				weekQueryString = `COALESCE(ROUND(SUM((julianday(COALESCE("timeLogs"."stoppedAt", datetime('now'))) - julianday("timeLogs"."startedAt")) * 86400) / COUNT("${weekQuery.alias}"."id")), 0)`;
				break;
			case DatabaseTypeEnum.postgres:
				weekQueryString = `COALESCE(ROUND(SUM(extract(epoch from (COALESCE("timeLogs"."stoppedAt", NOW()) - "timeLogs"."startedAt"))) / COUNT("${weekQuery.alias}"."id")), 0)`;
				break;
			case DatabaseTypeEnum.mysql:
				weekQueryString = p(
					`COALESCE(ROUND(SUM(TIMESTAMPDIFF(SECOND, "timeLogs"."startedAt", COALESCE("timeLogs"."stoppedAt", NOW()))) / COUNT("${weekQuery.alias}"."id")), 0)`
				);
				break;
			default:
				throw Error(
					`cannot create statistic query due to unsupported database type: ${this.configService.dbConnectionOptions.type}`
				);
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
						const startLevel = activityLevel.start * 6;
						const endLevel = activityLevel.end * 6;

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
		const weekPercentage =
			(reduce(pluck(weekTimeStatistics, 'overall'), ArraySum, 0) * 100) /
			reduce(pluck(weekTimeStatistics, 'duration'), ArraySum, 0);

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

		const todayQuery = this.typeOrmTimeSlotRepository.createQueryBuilder();

		let todayQueryString: string;
		switch (this.configService.dbConnectionOptions.type) {
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
				todayQueryString = `COALESCE(ROUND(SUM((julianday(COALESCE("timeLogs"."stoppedAt", datetime('now'))) - julianday("timeLogs"."startedAt")) * 86400) / COUNT("${todayQuery.alias}"."id")), 0)`;
				break;
			case DatabaseTypeEnum.postgres:
				todayQueryString = `COALESCE(ROUND(SUM(extract(epoch from (COALESCE("timeLogs"."stoppedAt", NOW()) - "timeLogs"."startedAt"))) / COUNT("${todayQuery.alias}"."id")), 0)`;
				break;
			case DatabaseTypeEnum.mysql:
				todayQueryString = p(
					`COALESCE(ROUND(SUM(TIMESTAMPDIFF(SECOND, "timeLogs"."startedAt", COALESCE("timeLogs"."stoppedAt", NOW()))) / COUNT("${todayQuery.alias}"."id")), 0)`
				);
				break;
			default:
				throw Error(
					`cannot create statistic query due to unsupported database type: ${this.configService.dbConnectionOptions.type}`
				);
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
						const startLevel = activityLevel.start * 6;
						const endLevel = activityLevel.end * 6;

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
		const todayPercentage =
			(reduce(pluck(todayTimeStatistics, 'overall'), ArraySum, 0) * 100) /
			reduce(pluck(todayTimeStatistics, 'duration'), ArraySum, 0);

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
		if (user.employeeId || (!hasChangeSelectedEmployeePermission && user.employeeId)) {
			employeeIds = [user.employeeId];
		}

		let queryString: string;
		switch (this.configService.dbConnectionOptions.type) {
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
				queryString = `COALESCE(ROUND(SUM((julianday(COALESCE("timeLogs"."stoppedAt", datetime('now'))) - julianday("timeLogs"."startedAt")) * 86400)), 0)`;
				break;
			case DatabaseTypeEnum.postgres:
				queryString = `COALESCE(ROUND(SUM(extract(epoch from (COALESCE("timeLogs"."stoppedAt", NOW()) - "timeLogs"."startedAt")))), 0)`;
				break;
			case DatabaseTypeEnum.mysql:
				queryString = p(
					`COALESCE(ROUND(SUM(TIMESTAMPDIFF(SECOND, "timeLogs"."startedAt", COALESCE("timeLogs"."stoppedAt", NOW())))), 0)`
				);
				break;
			default:
				throw Error(
					`cannot create statistic query due to unsupported database type: ${this.configService.dbConnectionOptions.type}`
				);
		}

		const query = this.typeOrmEmployeeRepository.createQueryBuilder();
		let employees: IMembersStatistics[] = await query
			.select(p(`"${query.alias}".id`))
			// Builds a SELECT statement for the "user_name" column based on the database type.
			.addSelect(p(`${concateUserNameExpression(this.configService.dbConnectionOptions.type)}`), 'user_name')
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
			const weekTimeQuery = this.typeOrmTimeSlotRepository.createQueryBuilder('time_slot');

			let weekTimeQueryString: string;
			switch (this.configService.dbConnectionOptions.type) {
				case DatabaseTypeEnum.sqlite:
				case DatabaseTypeEnum.betterSqlite3:
					weekTimeQueryString = `COALESCE(ROUND(SUM((julianday(COALESCE("timeLogs"."stoppedAt", datetime('now'))) - julianday("timeLogs"."startedAt")) * 86400) / COUNT("${weekTimeQuery.alias}"."id")), 0)`;
					break;
				case DatabaseTypeEnum.postgres:
					weekTimeQueryString = `COALESCE(ROUND(SUM(extract(epoch from (COALESCE("timeLogs"."stoppedAt", NOW()) - "timeLogs"."startedAt"))) / COUNT("${weekTimeQuery.alias}"."id")), 0)`;
					break;
				case DatabaseTypeEnum.mysql:
					weekTimeQueryString = p(
						`COALESCE(ROUND(SUM(TIMESTAMPDIFF(SECOND, "timeLogs"."startedAt", COALESCE("timeLogs"."stoppedAt", NOW()))) / COUNT("${weekTimeQuery.alias}"."id")), 0)`
					);
					break;
				default:
					throw Error(
						`cannot create statistic query due to unsupported database type: ${this.configService.dbConnectionOptions.type}`
					);
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

			let dayTimeQueryString: string;
			switch (this.configService.dbConnectionOptions.type) {
				case DatabaseTypeEnum.sqlite:
				case DatabaseTypeEnum.betterSqlite3:
					dayTimeQueryString = `COALESCE(ROUND(SUM((julianday(COALESCE("timeLogs"."stoppedAt", datetime('now'))) - julianday("timeLogs"."startedAt")) * 86400) / COUNT("${dayTimeQuery.alias}"."id")), 0)`;
					break;
				case DatabaseTypeEnum.postgres:
					dayTimeQueryString = `COALESCE(ROUND(SUM(extract(epoch from (COALESCE("timeLogs"."stoppedAt", NOW()) - "timeLogs"."startedAt"))) / COUNT("${dayTimeQuery.alias}"."id")), 0)`;
					break;
				case DatabaseTypeEnum.mysql:
					dayTimeQueryString = p(
						`COALESCE(ROUND(SUM(TIMESTAMPDIFF(SECOND, "timeLogs"."startedAt", COALESCE("timeLogs"."stoppedAt", NOW()))) / COUNT("${dayTimeQuery.alias}"."id")), 0)`
					);
					break;
				default:
					throw Error(
						`cannot create statistic query due to unsupported database type: ${this.configService.dbConnectionOptions.type}`
					);
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

				let weekHoursQueryString: string;
				switch (this.configService.dbConnectionOptions.type) {
					case DatabaseTypeEnum.sqlite:
					case DatabaseTypeEnum.betterSqlite3:
						weekHoursQueryString = `COALESCE(ROUND(SUM((julianday(COALESCE("timeLogs"."stoppedAt", datetime('now'))) - julianday("timeLogs"."startedAt")) * 86400)), 0)`;
						break;
					case DatabaseTypeEnum.postgres:
						weekHoursQueryString = `COALESCE(ROUND(SUM(extract(epoch from (COALESCE("timeLogs"."stoppedAt", NOW()) - "timeLogs"."startedAt")))), 0)`;
						break;
					case DatabaseTypeEnum.mysql:
						weekHoursQueryString = p(
							`COALESCE(ROUND(SUM(TIMESTAMPDIFF(SECOND, "timeLogs"."startedAt", COALESCE("timeLogs"."stoppedAt", NOW())))), 0)`
						);
						break;
					default:
						throw Error(
							`cannot create statistic query due to unsupported database type: ${this.configService.dbConnectionOptions.type}`
						);
				}

				const weekHoursQuery = this.typeOrmEmployeeRepository.createQueryBuilder();
				weekHoursQuery
					.innerJoin(`${weekHoursQuery.alias}.timeLogs`, 'timeLogs')
					.innerJoin(`timeLogs.timeSlots`, 'time_slot')
					.select(weekHoursQueryString, `duration`)
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

		const query = this.typeOrmTimeLogRepository.createQueryBuilder('time_log');

		let queryString: string;
		switch (this.configService.dbConnectionOptions.type) {
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
				throw Error(
					`cannot create statistic query due to unsupported database type: ${this.configService.dbConnectionOptions.type}`
				);
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
		switch (this.configService.dbConnectionOptions.type) {
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
				throw Error(
					`cannot create statistic query due to unsupported database type: ${this.configService.dbConnectionOptions.type}`
				);
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
		const { projectIds = [], taskIds = [], defaultRange, unitOfTime } = request;
		let { employeeIds = [], todayEnd, todayStart } = request;

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
		} else if (defaultRange) {
			const unit = unitOfTime || 'week';
			const range = getDateRangeFormat(
				moment().startOf(unit).utc(),
				moment().endOf(unit).utc()
			);
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
			const unit = unitOfTime || 'day';
			const range = getDateRangeFormat(
				moment().startOf(unit).utc(),
				moment().endOf(unit).utc()
			);
			todayStart = range.start;
			todayEnd = range.end;
		}

		// Retrieves the database type from the configuration service.
		const dbType = this.configService.dbConnectionOptions.type;

		/**
		 * Today Statistics
		 */
		const todayQuery = this.typeOrmTimeLogRepository.createQueryBuilder();
		todayQuery.select(p(`"task"."title"`), 'title');
		todayQuery.addSelect(p(`"task"."id"`), 'taskId');
		todayQuery.addSelect(p(`"${todayQuery.alias}"."updatedAt"`), 'updatedAt');
		todayQuery.addSelect(getTasksTodayDurationQueryString(dbType, todayQuery.alias), `today_duration`);
		todayQuery.innerJoin(`${todayQuery.alias}.task`, 'task');
		todayQuery.innerJoin(`${todayQuery.alias}.timeSlots`, 'time_slot');

		// Combine tenant and organization ID conditions
		todayQuery.andWhere(
			p(
				`("${todayQuery.alias}"."tenantId" = :tenantId AND ` +
				`"${todayQuery.alias}"."organizationId" = :organizationId) AND ` +
				`("time_slot"."tenantId" = :tenantId AND "time_slot"."organizationId" = :organizationId)`
			),
			{ tenantId, organizationId }
		);

		// Add conditions based on today's start and end time
		if (todayStart && todayEnd) {
			todayQuery.andWhere(p(`"${todayQuery.alias}"."startedAt" BETWEEN :todayStart AND :todayEnd`), { todayStart, todayEnd });
			todayQuery.andWhere(p(`"time_slot"."startedAt" BETWEEN :todayStart AND :todayEnd`), { todayStart, todayEnd });
		}

		if (isNotEmpty(employeeIds)) {
			todayQuery.andWhere(
				p(
					`("${todayQuery.alias}"."employeeId" IN (:...employeeIds) ` +
					`AND "time_slot"."employeeId" IN (:...employeeIds))`
				),
				{ employeeIds }
			);
		}

		if (isNotEmpty(projectIds)) {
			todayQuery.andWhere(p(`"${todayQuery.alias}"."projectId" IN (:...projectIds)`), { projectIds });
		}

		if (isNotEmpty(taskIds)) {
			todayQuery.andWhere(p(`"${todayQuery.alias}"."taskId" IN (:...taskIds)`), { taskIds });
		}

		if (isNotEmpty(organizationTeamId)) {
			todayQuery.andWhere(p(`"${todayQuery.alias}"."organizationTeamId" = :organizationTeamId`), { organizationTeamId });
		}

		todayQuery.groupBy(p(`"${todayQuery.alias}"."id"`))
		todayQuery.addGroupBy(p(`"task"."id"`))
		todayQuery.orderBy(p(`"${todayQuery.alias}"."updatedAt"`), 'DESC');

		console.log(todayQuery.getQueryAndParameters(), 'Get Today Statistics Query');
		const todayStatistics = await todayQuery.getRawMany();

		/**
		 * Get Time Range Statistics
		 */
		const query = this.typeOrmTimeLogRepository.createQueryBuilder();
		query.select(p(`"task"."title"`), 'title');
		query.addSelect(p(`"task"."id"`), 'taskId');
		query.addSelect(p(`"${query.alias}"."updatedAt"`), 'updatedAt');
		query.addSelect(getTasksDurationQueryString(dbType, query.alias), `duration`);
		query.innerJoin(`${query.alias}.task`, 'task');
		query.innerJoin(`${query.alias}.timeSlots`, 'time_slot');

		// Combine tenant and organization ID conditions
		query.andWhere(
			p(
				`("${query.alias}"."tenantId" = :tenantId AND ` +
				`"${query.alias}"."organizationId" = :organizationId) AND ` +
				`("time_slot"."tenantId" = :tenantId AND ` +
				`"time_slot"."organizationId" = :organizationId)`
			),
			{ tenantId, organizationId }
		);

		if (start && end) {
			query.andWhere(p(`"${query.alias}"."startedAt" BETWEEN :start AND :end AND "time_slot"."startedAt" BETWEEN :start AND :end`), { start, end });
		}

		if (isNotEmpty(employeeIds)) {
			query.andWhere(p(`"${query.alias}"."employeeId" IN (:...employeeIds) AND "time_slot"."employeeId" IN (:...employeeIds)`), { employeeIds });
		}

		if (isNotEmpty(projectIds)) {
			query.andWhere(p(`"${query.alias}"."projectId" IN (:...projectIds)`), { projectIds });
		}

		if (isNotEmpty(taskIds)) {
			query.andWhere(p(`"${query.alias}"."taskId" IN (:...taskIds)`), { taskIds });
		}

		if (isNotEmpty(organizationTeamId)) {
			query.andWhere(p(`"${query.alias}"."organizationTeamId" = :organizationTeamId`), { organizationTeamId });
		}

		query.groupBy(p(`"${query.alias}"."id"`));
		query.addGroupBy(p(`"task"."id"`));
		query.orderBy(p(`"${todayQuery.alias}"."updatedAt"`), 'DESC');

		console.log(query.getQueryAndParameters(), 'Get Statistics Query');
		const statistics = await query.getRawMany();

		/**
		 * Get Tasks Total Durtion
		 */
		const totalDurationQuery = this.typeOrmTimeLogRepository.createQueryBuilder();
		totalDurationQuery.select(getTasksTotalDurationQueryString(dbType, totalDurationQuery.alias), 'duration');
		totalDurationQuery.innerJoin(`${totalDurationQuery.alias}.task`, 'task');
		totalDurationQuery.andWhere({ tenantId, organizationId });

		if (start && end) {
			totalDurationQuery.andWhere(p(`"${totalDurationQuery.alias}"."startedAt" BETWEEN :start AND :end`), {
				start,
				end
			});
		}
		if (isNotEmpty(employeeIds)) {
			totalDurationQuery.andWhere(p(`"${totalDurationQuery.alias}"."employeeId" IN (:...employeeIds)`), { employeeIds });
		}
		if (isNotEmpty(projectIds)) {
			totalDurationQuery.andWhere(p(`"${totalDurationQuery.alias}"."projectId" IN (:...projectIds)`), { projectIds });
		}
		if (isNotEmpty(organizationTeamId)) {
			totalDurationQuery.andWhere(p(`"${totalDurationQuery.alias}"."organizationTeamId" = :organizationTeamId`), { organizationTeamId });
		}

		console.log(totalDurationQuery.getQueryAndParameters(), 'Get Total Duration Query');
		const totalDuration = await totalDurationQuery.getRawOne();

		// ------------------------------------------------

		console.log('Find Statistics length: ', statistics.length);
		console.log('Find Today Statistics length: ', todayStatistics.length);
		console.log('Find Total Duration: ', totalDuration.duration);

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
				acc[taskId] = { duration: 0, todayDuration: 0, title: stat.title };
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
				employeeId: timeLog.employee.id
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

		const query = this.typeOrmActivityRepository.createQueryBuilder();
		let queryString;

		switch (this.configService.dbConnectionOptions.type) {
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
				queryString = `datetime("${query.alias}"."date" || ' ' || "${query.alias}"."time") Between :start AND :end`;
				break;
			case DatabaseTypeEnum.postgres:
				queryString = `CONCAT("${query.alias}"."date", ' ', "${query.alias}"."time")::timestamp Between :start AND :end`;
				break;
			case DatabaseTypeEnum.mysql:
				queryString = p(
					`CONCAT("${query.alias}"."date", ' ', "${query.alias}"."time") BETWEEN :start AND :end`
				);
				break;
			default:
				throw Error(
					`cannot create statistic query due to unsupported database type: ${this.configService.dbConnectionOptions.type}`
				);
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
		const totalDurationQuery = this.typeOrmActivityRepository.createQueryBuilder();
		let totalDurationQueryString: string;

		switch (this.configService.dbConnectionOptions.type) {
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
				totalDurationQueryString = `datetime("${totalDurationQuery.alias}"."date" || ' ' || "${totalDurationQuery.alias}"."time") Between :start AND :end`;
				break;
			case DatabaseTypeEnum.postgres:
				totalDurationQueryString = `CONCAT("${totalDurationQuery.alias}"."date", ' ', "${totalDurationQuery.alias}"."time")::timestamp Between :start AND :end`;
				break;
			case DatabaseTypeEnum.mysql:
				totalDurationQueryString = p(
					`CONCAT("${totalDurationQuery.alias}"."date", ' ', "${totalDurationQuery.alias}"."time") BETWEEN :start AND :end`
				);
				break;
			default:
				throw Error(
					`cannot create statistic query due to unsupported database type: ${this.configService.dbConnectionOptions.type}`
				);
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

		const query = this.typeOrmTimeLogRepository.createQueryBuilder();
		query.innerJoin(`${query.alias}.employee`, 'employee');
		query.innerJoin(`${query.alias}.timeSlots`, 'time_slot');
		query.innerJoin(`employee.user`, 'user');
		query.select(p(`"${query.alias}"."employeeId"`), 'id');
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
			})
		);
		query.groupBy(p(`"${query.alias}"."employeeId"`));
		query.addGroupBy(p(`"user"."id"`));
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
		const query = this.typeOrmTimeLogRepository.createQueryBuilder('time_log');
		query.select(p(`"${query.alias}"."employeeId"`), 'employeeId');
		query.innerJoin(`${query.alias}.employee`, 'employee');
		query.innerJoin(`${query.alias}.timeSlots`, 'time_slot');
		query.andWhere(
			new Brackets((where: WhereExpressionBuilder) => {
				this.getFilterQuery(query, where, request);
			})
		);
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
		const query = this.typeOrmTimeLogRepository.createQueryBuilder('time_log');
		query.select(p(`"${query.alias}"."projectId"`), 'projectId');
		query.innerJoin(`${query.alias}.employee`, 'employee');
		query.innerJoin(`${query.alias}.project`, 'project');
		query.innerJoin(`${query.alias}.timeSlots`, 'time_slot');
		query.andWhere(
			new Brackets((where: WhereExpressionBuilder) => {
				this.getFilterQuery(query, where, request);
			})
		);
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
					const startLevel = activityLevel.start * 6;
					const endLevel = activityLevel.end * 6;

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
