import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets, SelectQueryBuilder, WhereExpressionBuilder } from 'typeorm';
import { reduce, pluck, pick, mapObject, groupBy, chain } from 'underscore';
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
	ITask
} from '@gauzy/contracts';
import { ArraySum, isNotEmpty } from '@gauzy/common';
import { ConfigService } from '@gauzy/config';
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

		@InjectRepository(Employee)
		private readonly employeeRepository: Repository<Employee>,

		@InjectRepository(Activity)
		private readonly activityRepository: Repository<Activity>,

		@InjectRepository(TimeLog)
		private readonly timeLogRepository: Repository<TimeLog>,

		private readonly configService: ConfigService
	) { }

	/**
	 * GET Time Tracking Dashboard Counts Statistics
	 *
	 * @param request
	 * @returns
	 */
	async getCounts(request: IGetCountsStatistics): Promise<ICountsStatistics> {
		const {
			organizationId,
			startDate,
			endDate,
			todayStart,
			todayEnd
		} = request;
		let { employeeIds = [], projectIds = [] } = request;

		const user = RequestContext.currentUser();
		const tenantId = RequestContext.currentTenantId() || request.tenantId;

		const { start, end } = (startDate && endDate) ?
			getDateRangeFormat(
				moment.utc(startDate),
				moment.utc(endDate)
			) :
			getDateRangeFormat(
				moment().startOf('week').utc(),
				moment().endOf('week').utc()
			);
		/*
		 *  Get employees id of the organization or get current employee id
		 */
		if (
			(user.employeeId && request.onlyMe) ||
			(
				!RequestContext.hasPermission(
					PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
				)
				&& user.employeeId
			)
		) {
			employeeIds = [user.employeeId];
		} else {
			employeeIds = await this.getEmployeesIds(
				organizationId,
				employeeIds,
				tenantId
			);
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
		const weekTimeStatistics = await weekQuery
			.innerJoin(`${weekQuery.alias}.timeLogs`, 'timeLogs')
			.select(
				`${this.configService.dbConnectionOptions.type === 'sqlite'
					? `COALESCE(ROUND(SUM((julianday(COALESCE("timeLogs"."stoppedAt", datetime('now'))) - julianday("timeLogs"."startedAt")) * 86400) / COUNT("${weekQuery.alias}"."id")), 0)`
					: `COALESCE(ROUND(SUM(extract(epoch from (COALESCE("timeLogs"."stoppedAt", NOW()) - "timeLogs"."startedAt"))) / COUNT("${weekQuery.alias}"."id")), 0)`
				}`,
				`week_duration`
			)
			.addSelect(`COALESCE(SUM("${weekQuery.alias}"."overall"), 0)`, `overall`)
			.addSelect(`COALESCE(SUM("${weekQuery.alias}"."duration"), 0)`, `duration`)
			.addSelect(`COUNT("${weekQuery.alias}"."id")`, `time_slot_count`)
			.andWhere(`"${weekQuery.alias}"."tenantId" = :tenantId`, { tenantId })
			.andWhere(`"${weekQuery.alias}"."organizationId" = :organizationId`, { organizationId })
			.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					qb.andWhere(`"timeLogs"."startedAt" BETWEEN :startDate AND :endDate`, {
						startDate: start,
						endDate: end
					});
					qb.andWhere(`"${weekQuery.alias}"."startedAt" BETWEEN :startDate AND :endDate`, {
						startDate: start,
						endDate: end
					});
					/**
					 * If Employee Selected
					 */
					if (isNotEmpty(employeeIds)) {
						qb.andWhere(`"${weekQuery.alias}"."employeeId" IN (:...employeeIds)`, {
							employeeIds
						});
						qb.andWhere(`"timeLogs"."employeeId" IN (:...employeeIds)`, {
							employeeIds
						});
					}
					/**
					 * If Project Selected
					 */
					if (isNotEmpty(projectIds)) {
						qb.andWhere(`"timeLogs"."projectId" IN (:...projectIds)`, {
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

						qb.andWhere(`"${weekQuery.alias}"."overall" BETWEEN :startLevel AND :endLevel`, {
							startLevel,
							endLevel
						});
					}
					/**
					 * If LogType Selected
					 */
					if (isNotEmpty(request.logType)) {
						const { logType } = request;
						qb.andWhere(`"timeLogs"."logType" IN (:...logType)`, {
							logType
						});
					}
					/**
					 * If Source Selected
					 */
					if (isNotEmpty(request.source)) {
						const { source } = request;
						qb.andWhere(`"timeLogs"."source" IN (:...source)`, {
							source
						});
					}
					qb.andWhere(
						new Brackets((qb: WhereExpressionBuilder) => {
							qb.andWhere(`"timeLogs"."tenantId" = :tenantId`, { tenantId });
							qb.andWhere(`"timeLogs"."organizationId" = :organizationId`, { organizationId });
							qb.andWhere(`"timeLogs"."deletedAt" IS NULL`);
						})
					);
				})
			)
			.groupBy(`"timeLogs"."id"`)
			.getRawMany();

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

		const { start: startToday, end: endToday } = (todayStart && todayEnd) ?
			getDateRangeFormat(
				moment.utc(todayStart),
				moment.utc(todayEnd)
			) :
			getDateRangeFormat(
				moment().startOf('day').utc(),
				moment().endOf('day').utc()
			);

		const todayQuery = this.timeSlotRepository.createQueryBuilder();
		const todayTimeStatistics = await todayQuery
			.innerJoin(`${todayQuery.alias}.timeLogs`, 'timeLogs')
			.select(
				`${this.configService.dbConnectionOptions.type === 'sqlite'
					? `COALESCE(ROUND(SUM((julianday(COALESCE("timeLogs"."stoppedAt", datetime('now'))) - julianday("timeLogs"."startedAt")) * 86400) / COUNT("${todayQuery.alias}"."id")), 0)`
					: `COALESCE(ROUND(SUM(extract(epoch from (COALESCE("timeLogs"."stoppedAt", NOW()) - "timeLogs"."startedAt"))) / COUNT("${todayQuery.alias}"."id")), 0)`
				}`,
				`today_duration`
			)
			.addSelect(`COALESCE(SUM("${todayQuery.alias}"."overall"), 0)`, `overall`)
			.addSelect(`COALESCE(SUM("${todayQuery.alias}"."duration"), 0)`, `duration`)
			.addSelect(`COUNT("${todayQuery.alias}"."id")`, `time_slot_count`)
			.andWhere(`"${todayQuery.alias}"."tenantId" = :tenantId`, { tenantId })
			.andWhere(`"${todayQuery.alias}"."organizationId" = :organizationId`, { organizationId })
			.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					qb.andWhere(`"timeLogs"."startedAt" BETWEEN :startDate AND :endDate`, {
						startDate: startToday,
						endDate: endToday
					});
					qb.andWhere(`"${todayQuery.alias}"."startedAt" BETWEEN :startDate AND :endDate`, {
						startDate: startToday,
						endDate: endToday
					});
					/**
					 * If Employee Selected
					 */
					if (isNotEmpty(employeeIds)) {
						qb.andWhere(`"timeLogs"."employeeId" IN (:...employeeIds)`, {
							employeeIds
						});
						qb.andWhere(`"${todayQuery.alias}"."employeeId" IN (:...employeeIds)`, {
							employeeIds
						});
					}
					/**
					 * If Project Selected
					 */
					if (isNotEmpty(projectIds)) {
						qb.andWhere(`"timeLogs"."projectId" IN (:...projectIds)`, {
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

						qb.andWhere(`"${todayQuery.alias}"."overall" BETWEEN :startLevel AND :endLevel`, {
							startLevel,
							endLevel
						});
					}
					/**
					 * If LogType Selected
					 */
					if (isNotEmpty(request.logType)) {
						const { logType } = request;
						qb.andWhere(`"timeLogs"."logType" IN (:...logType)`, {
							logType
						});
					}
					/**
					 * If Source Selected
					 */
					if (isNotEmpty(request.source)) {
						const { source } = request;
						qb.andWhere(`"timeLogs"."source" IN (:...source)`, {
							source
						});
					}
					qb.andWhere(
						new Brackets((qb: WhereExpressionBuilder) => {
							qb.andWhere(`"timeLogs"."tenantId" = :tenantId`, { tenantId });
							qb.andWhere(`"timeLogs"."organizationId" = :organizationId`, { organizationId });
							qb.andWhere(`"timeLogs"."deletedAt" IS NULL`);
						})
					);
				})
			)
			.groupBy(`"timeLogs"."id"`)
			.getRawMany();

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
			weekActivities: parseFloat(
				parseFloat(weekActivities.overall + '').toFixed(2)
			),
			weekDuration: weekActivities.duration,
			todayActivities: parseFloat(
				parseFloat(todayActivities.overall + '').toFixed(2)
			),
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
		const {
			organizationId,
			startDate,
			endDate,
			todayStart,
			todayEnd
		} = request;
		let { employeeIds = [], projectIds = [] } = request;

		const user = RequestContext.currentUser();
		const tenantId = RequestContext.currentTenantId() || request.tenantId;

		const { start: weeklyStart, end: weeklyEnd } = (startDate && endDate) ?
			getDateRangeFormat(
				moment.utc(startDate),
				moment.utc(endDate)
			) :
			getDateRangeFormat(
				moment().startOf('week').utc(),
				moment().endOf('week').utc()
			);
		/*
		 *  Get employees id of the organization or get current employee id
		 */
		if (
			(user.employeeId) ||
			(
				!RequestContext.hasPermission(
					PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
				)
				&& user.employeeId
			)
		) {
			employeeIds = [user.employeeId];
		} else {
			employeeIds = await this.getEmployeesIds(
				organizationId,
				employeeIds,
				tenantId
			);
		}

		const query = this.employeeRepository.createQueryBuilder();
		let employees: IMembersStatistics[] = await query
			.select(`"${query.alias}".id`)
			.addSelect(`("user"."firstName" || ' ' ||  "user"."lastName")`, 'user_name')
			.addSelect(`"user"."imageUrl"`, 'user_image_url')
			.addSelect(
				`${this.configService.dbConnectionOptions.type === 'sqlite'
					? `COALESCE(ROUND(SUM((julianday(COALESCE("timeLogs"."stoppedAt", datetime('now'))) - julianday("timeLogs"."startedAt")) * 86400)), 0)`
					: `COALESCE(ROUND(SUM(extract(epoch from (COALESCE("timeLogs"."stoppedAt", NOW()) - "timeLogs"."startedAt")))), 0)`
				}`,
				`duration`
			)
			.innerJoin(`${query.alias}.user`, 'user')
			.innerJoin(`${query.alias}.timeLogs`, 'timeLogs')
			.innerJoin(`timeLogs.timeSlots`, 'time_slot')
			.andWhere(`"${query.alias}"."tenantId" = :tenantId`, { tenantId })
			.andWhere(`"${query.alias}"."organizationId" = :organizationId`, { organizationId })
			.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					qb.andWhere(`"timeLogs"."startedAt" BETWEEN :weeklyStart AND :weeklyEnd`, {
						weeklyStart,
						weeklyEnd
					});
					qb.andWhere(`"time_slot"."startedAt" BETWEEN :weeklyStart AND :weeklyEnd`, {
						weeklyStart,
						weeklyEnd
					});
					/**
					 * If Employee Selected
					 */
					if (isNotEmpty(employeeIds)) {
						qb.andWhere(`"${query.alias}"."id" IN(:...employeeIds)`, {
							employeeIds
						})
							.andWhere(`"timeLogs"."employeeId" IN(:...employeeIds)`, {
								employeeIds
							});
					}
					/**
					 * If Project Selected
					 */
					if (isNotEmpty(projectIds)) {
						qb.andWhere(`"timeLogs"."projectId" IN (:...projectIds)`, {
							projectIds
						});
					}
					qb.andWhere(
						new Brackets((qb: WhereExpressionBuilder) => {
							qb.andWhere(`"timeLogs"."tenantId" = :tenantId`, { tenantId });
							qb.andWhere(`"timeLogs"."organizationId" = :organizationId`, { organizationId });
							qb.andWhere(`"timeLogs"."deletedAt" IS NULL`);
						})
					);
				})
			)
			.addGroupBy(`"${query.alias}"."id"`)
			.addGroupBy(`"user"."id"`)
			.orderBy('duration', 'DESC')
			.getRawMany();

		if (employees.length > 0) {
			const employeeIds = pluck(employees, 'id');

			/**
			 * Weekly Member Activity
			 */
			const weekTimeQuery = this.timeSlotRepository.createQueryBuilder('time_slot');
			weekTimeQuery
				.select(
					`${this.configService.dbConnectionOptions.type === 'sqlite'
						? `COALESCE(ROUND(SUM((julianday(COALESCE("timeLogs"."stoppedAt", datetime('now'))) - julianday("timeLogs"."startedAt")) * 86400) / COUNT("${weekTimeQuery.alias}"."id")), 0)`
						: `COALESCE(ROUND(SUM(extract(epoch from (COALESCE("timeLogs"."stoppedAt", NOW()) - "timeLogs"."startedAt"))) / COUNT("${weekTimeQuery.alias}"."id")), 0)`
					}`,
					`week_duration`
				)
				.addSelect(`COALESCE(SUM("${weekTimeQuery.alias}"."overall"), 0)`, `overall`)
				.addSelect(`COALESCE(SUM("${weekTimeQuery.alias}"."duration"), 0)`, `duration`)
				.addSelect(`COUNT("${weekTimeQuery.alias}"."id")`, `time_slot_count`)
				.addSelect(`${weekTimeQuery.alias}.employeeId`, 'employeeId')
				.innerJoin(`${weekTimeQuery.alias}.timeLogs`, 'timeLogs')
				.andWhere(`"${weekTimeQuery.alias}"."tenantId" = :tenantId`, { tenantId })
				.andWhere(`"${weekTimeQuery.alias}"."organizationId" = :organizationId`, { organizationId })
				.andWhere(
					new Brackets((qb: WhereExpressionBuilder) => {
						qb.andWhere(`"timeLogs"."startedAt" BETWEEN :weeklyStart AND :weeklyEnd`, {
							weeklyStart,
							weeklyEnd
						});
						qb.andWhere(`"${weekTimeQuery.alias}"."startedAt" BETWEEN :weeklyStart AND :weeklyEnd`, {
							weeklyStart,
							weeklyEnd
						});
						/**
						 * If Employee Selected
						 */
						if (isNotEmpty(employeeIds)) {
							qb.andWhere(`"${weekTimeQuery.alias}"."employeeId" IN(:...employeeIds)`, {
								employeeIds
							});
							qb.andWhere(`"timeLogs"."employeeId" IN(:...employeeIds)`, {
								employeeIds
							});
						}
						/**
						 * If Project Selected
						 */
						if (isNotEmpty(projectIds)) {
							qb.andWhere(`"timeLogs"."projectId" IN(:...projectIds)`, {
								projectIds
							});
						}
						qb.andWhere(
							new Brackets((qb: WhereExpressionBuilder) => {
								qb.andWhere(`"timeLogs"."tenantId" = :tenantId`, { tenantId });
								qb.andWhere(`"timeLogs"."organizationId" = :organizationId`, { organizationId });
								qb.andWhere(`"timeLogs"."deletedAt" IS NULL`);
							})
						);
					})
				)
				.groupBy(`timeLogs.id`)
				.addGroupBy(`${weekTimeQuery.alias}.employeeId`);

			let weekTimeSlots: any = await weekTimeQuery.getRawMany();
			weekTimeSlots = mapObject(
				groupBy(weekTimeSlots, 'employeeId'),
				function (values, employeeId) {
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
				}
			);
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
			dayTimeQuery
				.select(
					`${this.configService.dbConnectionOptions.type === 'sqlite'
						? `COALESCE(ROUND(SUM((julianday(COALESCE("timeLogs"."stoppedAt", datetime('now'))) - julianday("timeLogs"."startedAt")) * 86400) / COUNT("${dayTimeQuery.alias}"."id")), 0)`
						: `COALESCE(ROUND(SUM(extract(epoch from (COALESCE("timeLogs"."stoppedAt", NOW()) - "timeLogs"."startedAt"))) / COUNT("${dayTimeQuery.alias}"."id")), 0)`
					}`,
					`today_duration`
				)
				.addSelect(`COALESCE(SUM("${dayTimeQuery.alias}"."overall"), 0)`, `overall`)
				.addSelect(`COALESCE(SUM("${dayTimeQuery.alias}"."duration"), 0)`, `duration`)
				.addSelect(`COUNT("${dayTimeQuery.alias}"."id")`, `time_slot_count`)
				.addSelect(`${dayTimeQuery.alias}.employeeId`, 'employeeId')
				.innerJoin(`${dayTimeQuery.alias}.timeLogs`, 'timeLogs')
				.andWhere(`"${dayTimeQuery.alias}"."tenantId" = :tenantId`, { tenantId })
				.andWhere(`"${dayTimeQuery.alias}"."organizationId" = :organizationId`, { organizationId })
				.andWhere(
					new Brackets((qb: WhereExpressionBuilder) => {
						const { start: startToday, end: endToday } = (todayStart && todayEnd) ?
							getDateRangeFormat(
								moment.utc(todayStart),
								moment.utc(todayEnd)
							) :
							getDateRangeFormat(
								moment().startOf('day').utc(),
								moment().endOf('day').utc()
							);

						qb.where(`"timeLogs"."startedAt" BETWEEN :startToday AND :endToday`, {
							startToday,
							endToday
						});
						qb.andWhere(`"${dayTimeQuery.alias}"."startedAt" BETWEEN :startToday AND :endToday`, {
							startToday,
							endToday
						});
						/**
						 * If Employee Selected
						 */
						if (isNotEmpty(employeeIds)) {
							qb.andWhere(`"${dayTimeQuery.alias}"."employeeId" IN(:...employeeIds)`, {
								employeeIds
							});
							qb.andWhere(`"timeLogs"."employeeId" IN(:...employeeIds)`, {
								employeeIds
							});
						}
						/**
						 * If Project Selected
						 */
						if (isNotEmpty(projectIds)) {
							qb.andWhere(`"timeLogs"."projectId" IN(:...projectIds)`, {
								projectIds
							});
						}
						qb.andWhere(
							new Brackets((qb: WhereExpressionBuilder) => {
								qb.andWhere(`"timeLogs"."tenantId" = :tenantId`, { tenantId });
								qb.andWhere(`"timeLogs"."organizationId" = :organizationId`, { organizationId });
								qb.andWhere(`"timeLogs"."deletedAt" IS NULL`);
							})
						);
					})
				)
				.groupBy(`timeLogs.id`)
				.addGroupBy(`${dayTimeQuery.alias}.employeeId`);

			let dayTimeSlots: any = await dayTimeQuery.getRawMany();
			dayTimeSlots = mapObject(
				groupBy(dayTimeSlots, 'employeeId'),
				function (values, employeeId) {
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
				}
			);
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

				const weekHoursQuery = this.employeeRepository.createQueryBuilder();
				weekHoursQuery
					.innerJoin(`${weekHoursQuery.alias}.timeLogs`, 'timeLogs')
					.innerJoin(`timeLogs.timeSlots`, 'time_slot')
					.select(
						`${this.configService.dbConnectionOptions.type ===
							'sqlite'
							? `COALESCE(ROUND(SUM((julianday(COALESCE("timeLogs"."stoppedAt", datetime('now'))) - julianday("timeLogs"."startedAt")) * 86400)), 0)`
							: `COALESCE(ROUND(SUM(extract(epoch from (COALESCE("timeLogs"."stoppedAt", NOW()) - "timeLogs"."startedAt")))), 0)`
						}`,
						`duration`
					)
					.addSelect(
						`${this.configService.dbConnectionOptions.type ===
							'sqlite'
							? `(strftime('%w', timeLogs.startedAt))`
							: 'EXTRACT(DOW FROM "timeLogs"."startedAt")'
						}`,
						'day'
					)
					.andWhere(`"${weekHoursQuery.alias}"."id" = :memberId`, { memberId: member.id })
					.andWhere(`"${weekHoursQuery.alias}"."tenantId" = :tenantId`, { tenantId })
					.andWhere(`"${weekHoursQuery.alias}"."organizationId" = :organizationId`, { organizationId })
					.andWhere(
						new Brackets((qb: WhereExpressionBuilder) => {
							qb.andWhere(`"timeLogs"."startedAt" BETWEEN :weeklyStart AND :weeklyEnd`, {
								weeklyStart,
								weeklyEnd
							});
							qb.andWhere(`"time_slot"."startedAt" BETWEEN :weeklyStart AND :weeklyEnd`, {
								weeklyStart,
								weeklyEnd
							});
							qb.andWhere(`"timeLogs"."tenantId" = :tenantId`, { tenantId });
							qb.andWhere(`"timeLogs"."organizationId" = :organizationId`, { organizationId });
							qb.andWhere(`"timeLogs"."deletedAt" IS NULL`);
						})
					)
					.andWhere(
						new Brackets((qb: WhereExpressionBuilder) => {
							if (isNotEmpty(employeeIds)) {
								qb.andWhere(`"timeLogs"."employeeId" IN (:...employeeIds)`, {
									employeeIds
								});
							}
							if (isNotEmpty(projectIds)) {
								qb.andWhere(`"timeLogs"."projectId" IN (:...projectIds)`, {
									projectIds
								});
							}
						})
					);
				member.weekHours = await weekHoursQuery
					.addGroupBy(
						`${this.configService.dbConnectionOptions.type ===
							'sqlite'
							? `(strftime('%w', timeLogs.startedAt))`
							: 'EXTRACT(DOW FROM "timeLogs"."startedAt")'
						}`
					)
					.getRawMany();
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
		const { start, end } = (startDate && endDate) ?
			getDateRangeFormat(
				moment.utc(startDate),
				moment.utc(endDate)
			) :
			getDateRangeFormat(
				moment().startOf('week').utc(),
				moment().endOf('week').utc()
			);

		/*
		*  Get employees id of the organization or get current employee id
		*/
		if (
			(user.employeeId && request.onlyMe) ||
			(
				!RequestContext.hasPermission(
					PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
				)
				&& user.employeeId
			)
		) {
			employeeIds = [user.employeeId];
		} else {
			employeeIds = await this.getEmployeesIds(
				organizationId,
				employeeIds,
				tenantId
			);
		}

		const query = this.timeLogRepository.createQueryBuilder('time_log');
		query
			.select(`"project"."name"`, "name")
			.addSelect(`"project"."id"`, "projectId")
			.addSelect(
				`${this.configService.dbConnectionOptions.type === 'sqlite'
					? `COALESCE(ROUND(SUM((julianday(COALESCE("${query.alias}"."stoppedAt", datetime('now'))) - julianday("${query.alias}"."startedAt")) * 86400) / COUNT("time_slot"."id")), 0)`
					: `COALESCE(ROUND(SUM(extract(epoch from (COALESCE("${query.alias}"."stoppedAt", NOW()) - "${query.alias}"."startedAt"))) / COUNT("time_slot"."id")), 0)`
				}`,
				`duration`
			)
			.innerJoin(`${query.alias}.project`, 'project')
			.innerJoin(`${query.alias}.timeSlots`, 'time_slot')
			.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					qb.andWhere(`"${query.alias}"."startedAt" BETWEEN :start AND :end`, {
						start,
						end
					});
					qb.andWhere(`"time_slot"."startedAt" BETWEEN :start AND :end`, {
						start,
						end
					})
				})
			)
			.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					qb.andWhere(`"${query.alias}"."tenantId" = :tenantId`, { tenantId });
					qb.andWhere(`"${query.alias}"."organizationId" = :organizationId`, { organizationId });
					qb.andWhere(`"${query.alias}"."deletedAt" IS NULL`);
				})
			)
			.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					qb.andWhere(`"time_slot"."tenantId" = :tenantId`, { tenantId });
					qb.andWhere(`"time_slot"."organizationId" = :organizationId`, { organizationId });
				})
			)
			.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					if (isNotEmpty(employeeIds)) {
						qb.andWhere(`"${query.alias}"."employeeId" IN (:...employeeIds)`, {
							employeeIds
						});
						qb.andWhere(`"time_slot"."employeeId" IN (:...employeeIds)`, {
							employeeIds
						});
					}
					if (isNotEmpty(projectIds)) {
						qb.andWhere(`"${query.alias}"."projectId" IN (:...projectIds)`, {
							projectIds
						});
						qb.andWhere(`"project"."id" IN (:...projectIds)`, {
							projectIds
						});
					}
				})
			)
			.groupBy(`"${query.alias}"."id"`)
			.addGroupBy(`"project"."id"`)
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
		totalDurationQuery
			.select(
				`${this.configService.dbConnectionOptions.type === 'sqlite'
					? `COALESCE(ROUND(SUM((julianday(COALESCE("${totalDurationQuery.alias}"."stoppedAt", datetime('now'))) - julianday("${totalDurationQuery.alias}"."startedAt")) * 86400)), 0)`
					: `COALESCE(ROUND(SUM(extract(epoch from (COALESCE("${totalDurationQuery.alias}"."stoppedAt", NOW()) - "${totalDurationQuery.alias}"."startedAt")))), 0)`
				}`,
				`duration`
			)
			.innerJoin(`${totalDurationQuery.alias}.project`, 'project')
			.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					qb.andWhere(`"${totalDurationQuery.alias}"."startedAt" BETWEEN :start AND :end`, {
						start,
						end
					});
				})
			)
			.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					qb.andWhere(`"${totalDurationQuery.alias}"."tenantId" = :tenantId`, { tenantId });
					qb.andWhere(`"${totalDurationQuery.alias}"."organizationId" = :organizationId`, { organizationId });
					qb.andWhere(`"${totalDurationQuery.alias}"."deletedAt" IS NULL`);
				})
			)
			.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					if (isNotEmpty(employeeIds)) {
						qb.andWhere(`"${totalDurationQuery.alias}"."employeeId" IN (:...employeeIds)`, {
							employeeIds
						});
					}
					if (isNotEmpty(projectIds)) {
						qb.andWhere(`"${totalDurationQuery.alias}"."projectId" IN (:...projectIds)`, {
							projectIds
						});
						qb.andWhere(`"project"."id" IN (:...projectIds)`, {
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
		let { employeeIds = [], projectIds = [], taskIds = [], defaultRange, unitOfTime } = request;

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
		if ((user && user.employeeId) && (onlyMe || !RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE))) {
			if (isNotEmpty(organizationTeamId)) {
				employeeIds = [...employeeIds];
			} else {
				employeeIds = [user.employeeId];
			}
		} else {
			employeeIds = await this.getEmployeesIds(
				organizationId,
				employeeIds,
				tenantId
			);
		}

		const query = this.timeLogRepository.createQueryBuilder();
		query
			.select(`"task"."title"`, "title")
			.addSelect(`"task"."id"`, "taskId")
			.addSelect(
				`${this.configService.dbConnectionOptions.type === 'sqlite'
					? `COALESCE(ROUND(SUM((julianday(COALESCE("${query.alias}"."stoppedAt", datetime('now'))) - julianday("${query.alias}"."startedAt")) * 86400) / COUNT("time_slot"."id")), 0)`
					: `COALESCE(ROUND(SUM(extract(epoch from (COALESCE("${query.alias}"."stoppedAt", NOW()) - "${query.alias}"."startedAt"))) / COUNT("time_slot"."id")), 0)`
				}`,
				`duration`
			)
			.innerJoin(`${query.alias}.task`, 'task')
			.innerJoin(`${query.alias}.timeSlots`, 'time_slot')
			.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					if (start && end) {
						qb.andWhere(`"${query.alias}"."startedAt" BETWEEN :start AND :end`, {
							start,
							end
						});
						qb.andWhere(`"time_slot"."startedAt" BETWEEN :start AND :end`, {
							start,
							end
						});
					}
				})
			)
			.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					qb.andWhere(`"${query.alias}"."tenantId" = :tenantId`, { tenantId });
					qb.andWhere(`"${query.alias}"."organizationId" = :organizationId`, { organizationId });
					qb.andWhere(`"${query.alias}"."deletedAt" IS NULL`);
				})
			)
			.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					qb.andWhere(`"time_slot"."tenantId" = :tenantId`, { tenantId });
					qb.andWhere(`"time_slot"."organizationId" = :organizationId`, { organizationId });
				})
			)
			.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					if (isNotEmpty(employeeIds)) {
						qb.andWhere(`"${query.alias}"."employeeId" IN (:...employeeIds)`, {
							employeeIds
						});
						qb.andWhere(`"time_slot"."employeeId" IN (:...employeeIds)`, {
							employeeIds
						});
					}
					if (isNotEmpty(projectIds)) {
						qb.andWhere(`"${query.alias}"."projectId" IN (:...projectIds)`, {
							projectIds
						});
					}
					if (isNotEmpty(taskIds)) {
						qb.andWhere(`"${query.alias}"."taskId" IN (:...taskIds)`, {
							taskIds
						});
					}
					if (isNotEmpty(organizationTeamId)) {
						qb.andWhere(`"${query.alias}"."organizationTeamId" = :organizationTeamId`, {
							organizationTeamId
						});
					}
				})
			)
			.groupBy(`"${query.alias}"."id"`)
			.addGroupBy(`"task"."id"`)
			.orderBy('duration', 'DESC');
		let statistics: ITask[] = await query.getRawMany();

		let tasks: ITask[] = chain(statistics)
			.groupBy('taskId')
			.map((tasks: ITask[], taskId) => {
				const [task] = tasks;
				return {
					title: task.title,
					id: taskId,
					duration: reduce(pluck(tasks, 'duration'), ArraySum, 0)
				} as ITask
			})
			.value();
		if (isNotEmpty(take)) { tasks = tasks.splice(0, take); }

		const totalDurationQuery = this.timeLogRepository.createQueryBuilder();
		totalDurationQuery
			.select(
				`${this.configService.dbConnectionOptions.type === 'sqlite'
					? `COALESCE(ROUND(SUM((julianday(COALESCE("${totalDurationQuery.alias}"."stoppedAt", datetime('now'))) - julianday("${totalDurationQuery.alias}"."startedAt")) * 86400)), 0)`
					: `COALESCE(ROUND(SUM(extract(epoch from (COALESCE("${totalDurationQuery.alias}"."stoppedAt", NOW()) - "${totalDurationQuery.alias}"."startedAt")))), 0)`
				}`,
				`duration`
			)
			.innerJoin(`${totalDurationQuery.alias}.task`, 'task')
			.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					if (start && end) {
						qb.andWhere(`"${totalDurationQuery.alias}"."startedAt" BETWEEN :start AND :end`, {
							start,
							end
						});
					}
				})
			)
			.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					qb.andWhere(`"${totalDurationQuery.alias}"."tenantId" = :tenantId`, { tenantId });
					qb.andWhere(`"${totalDurationQuery.alias}"."organizationId" = :organizationId`, { organizationId });
					qb.andWhere(`"${totalDurationQuery.alias}"."deletedAt" IS NULL`);
				})
			)
			.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					if (isNotEmpty(employeeIds)) {
						qb.andWhere(`"${totalDurationQuery.alias}"."employeeId" IN (:...employeeIds)`, {
							employeeIds
						});
					}
					if (isNotEmpty(projectIds)) {
						qb.andWhere(`"${totalDurationQuery.alias}"."projectId" IN (:...projectIds)`, {
							projectIds
						});
					}
					if (isNotEmpty(organizationTeamId)) {
						qb.andWhere(`"${totalDurationQuery.alias}"."organizationTeamId" = :organizationTeamId`, {
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
		const { organizationId, startDate, endDate } = request;
		let { employeeIds = [], projectIds = [] } = request;

		const user = RequestContext.currentUser();
		const tenantId = RequestContext.currentTenantId() || request.tenantId;
		const { start, end } = (startDate && endDate) ?
			getDateRangeFormat(
				moment.utc(startDate),
				moment.utc(endDate)
			) :
			getDateRangeFormat(
				moment().startOf('week').utc(),
				moment().endOf('week').utc()
			);
		/*
		 *  Get employees id of the organization or get current employee id
		 */
		if (
			(user.employeeId && request.onlyMe) ||
			(
				!RequestContext.hasPermission(
					PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
				)
				&& user.employeeId
			)
		) {
			employeeIds = [user.employeeId];
		} else {
			employeeIds = await this.getEmployeesIds(
				organizationId,
				employeeIds,
				tenantId
			);
		}

		const query = this.timeLogRepository.createQueryBuilder('time_log');
		query.setFindOptions({
			join: {
				alias: 'time_log',
				innerJoin: {
					time_slots: 'time_log.timeSlots'
				}
			},
			relations: {
				project: true,
				timeSlots: true,
				employee: {
					user: true
				}
			},
			take: 5,
			order: {
				startedAt: 'DESC'
			}
		});
		query.where((qb: SelectQueryBuilder<TimeLog>) => {
			qb.andWhere(
				new Brackets((web: WhereExpressionBuilder) => {
					web.andWhere(`"${qb.alias}"."logType" = :logType`, {
						logType: TimeLogType.MANUAL
					});
					web.andWhere(`"${qb.alias}"."startedAt" BETWEEN :start AND :end`, {
						start,
						end
					});
					web.andWhere(`"time_slots"."startedAt" BETWEEN :start AND :end`, {
						start,
						end
					});
				})
			);
			qb.andWhere(
				new Brackets((web: WhereExpressionBuilder) => {
					web.andWhere(`"${qb.alias}"."tenantId" = :tenantId`, { tenantId });
					web.andWhere(`"${qb.alias}"."organizationId" = :organizationId`, { organizationId });
					web.andWhere(`"${qb.alias}"."deletedAt" IS NULL`);
				})
			);
			qb.andWhere(
				new Brackets((web: WhereExpressionBuilder) => {
					if (isNotEmpty(employeeIds)) {
						web.andWhere(`"${qb.alias}"."employeeId" IN (:...employeeIds)`, {
							employeeIds
						});
					}
					if (isNotEmpty(projectIds)) {
						web.andWhere(`"${qb.alias}"."projectId" IN (:...projectIds)`, {
							projectIds
						});
					}
				})
			);
		});
		const timeLogs = await query.getMany();
		const mappedTimeLogs: IManualTimesStatistics[] = timeLogs.map(
			(timeLog) => {
				return {
					id: timeLog.id,
					startedAt: timeLog.startedAt,
					duration: timeLog.duration,
					user: pick(timeLog.employee.user, ['name', 'imageUrl']),
					project: pick(timeLog.project, ['name']),
					employeeId: timeLog.employee.id
				} as IManualTimesStatistics;
			}
		);
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

		const { start, end } = (startDate && endDate) ?
			getDateRangeFormat(
				moment.utc(startDate),
				moment.utc(endDate)
			) :
			getDateRangeFormat(
				moment().startOf('week').utc(),
				moment().endOf('week').utc()
			);
		/*
		 *  Get employees id of the organization or get current employee id
		 */
		if (
			(user.employeeId && request.onlyMe) ||
			(
				!RequestContext.hasPermission(
					PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
				)
				&& user.employeeId
			)
		) {
			employeeIds = [user.employeeId];
		} else {
			employeeIds = await this.getEmployeesIds(
				organizationId,
				employeeIds,
				tenantId
			);
		}

		const query = this.activityRepository.createQueryBuilder();
		query
			.select(`COUNT("${query.alias}"."id")`, `sessions`)
			.addSelect(`SUM("${query.alias}"."duration")`, `duration`)
			.addSelect(`"${query.alias}"."title"`, `title`)
			.innerJoin(`${query.alias}.timeSlot`, 'time_slot')
			.innerJoin(`time_slot.timeLogs`, 'time_log')
			.addGroupBy(`"${query.alias}"."title"`)
			.andWhere(
				new Brackets((qb) => {
					if (
						this.configService.dbConnectionOptions.type ===
						'sqlite'
					) {
						qb.andWhere(
							`datetime("${query.alias}"."date" || ' ' || "${query.alias}"."time") Between :start AND :end`,
							{ start, end }
						);
					} else {
						qb.andWhere(
							`concat("${query.alias}"."date", ' ', "${query.alias}"."time")::timestamp Between :start AND :end`,
							{ start, end }
						);
					}
				})
			)
			.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					qb.andWhere(`"time_log"."startedAt" BETWEEN :startDate AND :endDate`, {
						startDate: start,
						endDate: end
					});
					qb.andWhere(`"time_slot"."startedAt" BETWEEN :startDate AND :endDate`, {
						startDate: start,
						endDate: end
					});
				})
			)
			.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					qb.andWhere(`"${query.alias}"."tenantId" = :tenantId`, { tenantId });
					qb.andWhere(`"${query.alias}"."organizationId" = :organizationId`, { organizationId });
				})
			)
			.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					qb.andWhere(`"time_log"."tenantId" = :tenantId`, { tenantId });
					qb.andWhere(`"time_log"."organizationId" = :organizationId`, { organizationId });
					qb.andWhere(`"time_log"."deletedAt" IS NULL`);
				})
			)
			.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					if (isNotEmpty(employeeIds)) {
						qb.andWhere(`"${query.alias}"."employeeId" IN (:...employeeIds)`, {
							employeeIds
						});
					}
					if (isNotEmpty(projectIds)) {
						qb.andWhere(`"${query.alias}"."projectId" IN (:...projectIds)`, {
							projectIds
						});
					}
				})
			)
			.orderBy(`"duration"`, 'DESC')
			.limit(5);
		let activities: IActivitiesStatistics[] = await query.getRawMany();

		/*
		* Fetch total duration of the week for calculate duration percentage
		*/
		const totalDurationQuery = this.activityRepository.createQueryBuilder();
		totalDurationQuery
			.select(`SUM("${totalDurationQuery.alias}"."duration")`, `duration`)
			.innerJoin(`${totalDurationQuery.alias}.timeSlot`, 'time_slot')
			.innerJoin(`time_slot.timeLogs`, 'time_log')
			.andWhere(
				new Brackets((qb) => {
					if (
						this.configService.dbConnectionOptions.type ===
						'sqlite'
					) {
						qb.andWhere(`datetime("${totalDurationQuery.alias}"."date" || ' ' || "${totalDurationQuery.alias}"."time") Between :start AND :end`, {
							start,
							end
						});
					} else {
						qb.andWhere(`concat("${totalDurationQuery.alias}"."date", ' ', "${totalDurationQuery.alias}"."time")::timestamp Between :start AND :end`, {
							start,
							end
						});
					}
				})
			)
			.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					qb.andWhere(`"time_log"."startedAt" BETWEEN :startDate AND :endDate`, {
						startDate: start,
						endDate: end
					});
					qb.andWhere(`"time_slot"."startedAt" BETWEEN :startDate AND :endDate`, {
						startDate: start,
						endDate: end
					});
				})
			)
			.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					qb.andWhere(`"${totalDurationQuery.alias}"."tenantId" = :tenantId`, { tenantId });
					qb.andWhere(`"${totalDurationQuery.alias}"."organizationId" = :organizationId`, { organizationId });
				})
			)
			.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					qb.andWhere(`"time_log"."tenantId" = :tenantId`, { tenantId });
					qb.andWhere(`"time_log"."organizationId" = :organizationId`, { organizationId });
					qb.andWhere(`"time_log"."deletedAt" IS NULL`);
				})
			)
			.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					if (isNotEmpty(employeeIds)) {
						qb.andWhere(`"${totalDurationQuery.alias}"."employeeId" IN (:...employeeIds)`, {
							employeeIds
						});
					}
					if (isNotEmpty(projectIds)) {
						qb.andWhere(`"${totalDurationQuery.alias}"."projectId" IN (:...projectIds)`, {
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
		const { organizationId, startDate, endDate } = request;
		let { employeeIds = [], projectIds = [] } = request;

		const user = RequestContext.currentUser();
		const tenantId = RequestContext.currentTenantId() || request.tenantId;

		const { start, end } = (startDate && endDate) ?
			getDateRangeFormat(
				moment.utc(startDate),
				moment.utc(endDate)
			) :
			getDateRangeFormat(
				moment().startOf('week').utc(),
				moment().endOf('week').utc()
			);

		/*
		 *  Get employees id of the organization or get current employee id
		 */
		if (
			(user.employeeId && request.onlyMe) ||
			(
				!RequestContext.hasPermission(
					PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
				)
				&& user.employeeId
			)
		) {
			employeeIds = [user.employeeId];
		} else {
			employeeIds = await this.getEmployeesIds(
				organizationId,
				employeeIds,
				tenantId
			);
		}

		const query = this.timeLogRepository.createQueryBuilder('time_log');
		query.select(`"time_log"."employeeId"`, "id");
		query.addSelect(`MAX("${query.alias}"."startedAt")`, "startedAt");
		query.addSelect(`"user"."imageUrl"`, "user_image_url");
		query.addSelect(`("user"."firstName" || ' ' ||  "user"."lastName")`, "user_name");
		query.innerJoin(`${query.alias}.employee`, 'employee');
		query.innerJoin(`${query.alias}.timeSlots`, 'time_slot');
		query.innerJoin(`employee.user`, "user");
		query.andWhere(
			new Brackets((qb: WhereExpressionBuilder) => {
				qb.andWhere(`"${query.alias}"."tenantId" = :tenantId`, { tenantId });
				qb.andWhere(`"${query.alias}"."organizationId" = :organizationId`, { organizationId });
				qb.andWhere(`"${query.alias}"."deletedAt" IS NULL`);
			})
		);
		query.andWhere(
			new Brackets((qb: WhereExpressionBuilder) => {
				qb.andWhere(`"${query.alias}"."startedAt" BETWEEN :start AND :end`, {
					start,
					end
				});
				qb.andWhere(`"time_slot"."startedAt" BETWEEN :start AND :end`, {
					start,
					end
				});
			})
		);
		query.andWhere(
			new Brackets((qb: WhereExpressionBuilder) => {
				if (isNotEmpty(employeeIds)) {
					qb.andWhere(`"${query.alias}"."employeeId" IN (:...employeeIds)`, {
						employeeIds
					});
				}
				if (isNotEmpty(projectIds)) {
					qb.andWhere(`"${query.alias}"."projectId" IN (:...projectIds)`, {
						projectIds
					});
				}
			})
		);
		query.groupBy(`"${query.alias}"."employeeId"`);
		query.addGroupBy(`"user"."id"`);
		query.addOrderBy(`"startedAt"`, "DESC");
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

			const query = this.timeSlotRepository.createQueryBuilder('time_slot');
			query.setFindOptions({
				select: {
					employee: {
						id: true,
						userId: true,
						user: {
							id: true,
							firstName: true,
							lastName: true,
							imageUrl: true
						}
					}
				},
				join: {
					alias: 'time_slot',
					leftJoin: {
						employee: 'time_slot.employee'
					},
					innerJoinAndSelect: {
						timeLogs: 'time_slot.timeLogs'
					}
				},
				relations: {
					employee: {
						user: true
					},
					screenshots: true
				},
				take: 9,
				order: {
					startedAt: 'DESC'
				}
			});
			query.where((qb: SelectQueryBuilder<TimeSlot>) => {
				qb.andWhere(
					new Brackets((web: WhereExpressionBuilder) => {
						const { id: employeeId } = employee;
						web.andWhere(`"${qb.alias}"."employeeId" = :employeeId`, { employeeId });
						web.andWhere(`"${qb.alias}"."organizationId" = :organizationId`, { organizationId });
						web.andWhere(`"${qb.alias}"."tenantId" = :tenantId`, { tenantId });
					})
				);
				qb.andWhere(
					new Brackets((web: WhereExpressionBuilder) => {
						web.andWhere(`"timeLogs"."startedAt" BETWEEN :start AND :end`, {
							start,
							end
						});
						web.andWhere(`"${qb.alias}"."startedAt" BETWEEN :start AND :end`, {
							start,
							end
						});
						web.andWhere(`"timeLogs"."tenantId" = :tenantId`, { tenantId });
						web.andWhere(`"timeLogs"."organizationId" = :organizationId`, { organizationId });
						web.andWhere(`"timeLogs"."deletedAt" IS NULL`);
					})
				);
				qb.andWhere(
					new Brackets((web: WhereExpressionBuilder) => {
						if (isNotEmpty(projectIds)) {
							web.andWhere(`"timeLogs"."projectId" IN (:...projectIds)`, {
								projectIds
							});
						}
					})
				);
			});
			employee.timeSlots = await query.getMany();
		}
		return employees;
	}

	private async getEmployeesIds(
		organizationId: string,
		employeeIds: string[],
		tenantId = RequestContext.currentTenantId()
	) {
		const query = this.employeeRepository.createQueryBuilder('employee');
		query
			.select(['id'])
			.andWhere('"organizationId" = :organizationId', { organizationId })
			.andWhere('"tenantId" = :tenantId', { tenantId });

		if (isNotEmpty(employeeIds)) {
			query.andWhere(`"${query.alias}"."id" IN (:...employeeIds)`, {
				employeeIds
			});
		}
		const employees = await query.getRawMany();
		return pluck(employees, 'id');
	}

	/**
	 * Get employees count who worked in this week.
	 *
	 * @param request
	 * @returns
	 */
	private async getEmployeeWorkedCounts(request: IGetCountsStatistics) {
		const query = this.timeLogRepository.createQueryBuilder('time_log');
		query.select(`"${query.alias}"."employeeId"`, 'employeeId');
		query.innerJoin(`${query.alias}.employee`, 'employee');
		query.innerJoin(`${query.alias}.timeSlots`, 'time_slot');
		query.andWhere(
			new Brackets((where: WhereExpressionBuilder) => {
				this.getFilterQuery(query, where, request);
			})
		)
		query.groupBy(`"${query.alias}"."employeeId"`);
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
		query.select(`"${query.alias}"."projectId"`, 'projectId');
		query.innerJoin(`${query.alias}.employee`, 'employee');
		query.innerJoin(`${query.alias}.project`, 'project');
		query.innerJoin(`${query.alias}.timeSlots`, 'time_slot');
		query.andWhere(
			new Brackets((where: WhereExpressionBuilder) => {
				this.getFilterQuery(query, where, request);
			})
		)
		query.groupBy(`"${query.alias}"."projectId"`);
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
		const {
			organizationId,
			startDate,
			endDate,
			employeeIds = [],
			projectIds = []
		} = request;
		const tenantId = RequestContext.currentTenantId() || request.tenantId;

		const { start, end } = (startDate && endDate) ?
			getDateRangeFormat(
				moment.utc(startDate),
				moment.utc(endDate)
			) :
			getDateRangeFormat(
				moment().startOf('week').utc(),
				moment().endOf('week').utc()
			);
		qb.andWhere(
			new Brackets((qb: WhereExpressionBuilder) => {
				qb.andWhere(`"${query.alias}"."tenantId" = :tenantId`, { tenantId });
				qb.andWhere(`"${query.alias}"."organizationId" = :organizationId`, { organizationId });
				qb.andWhere(`"${query.alias}"."deletedAt" IS NULL`);
			})
		);
		qb.andWhere(
			new Brackets((qb: WhereExpressionBuilder) => {
				qb.andWhere(`"${query.alias}"."startedAt" BETWEEN :startDate AND :endDate`, {
					startDate: start,
					endDate: end
				});
				qb.andWhere(`"time_slot"."startedAt" BETWEEN :startDate AND :endDate`, {
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

					qb.andWhere(`"time_slot"."overall" BETWEEN :startLevel AND :endLevel`, {
						startLevel,
						endLevel
					});
				}
				if (isNotEmpty(request.logType)) {
					const { logType } = request;
					qb.andWhere(`"${query.alias}"."logType" IN (:...logType)`, {
						logType
					});
				}
				if (isNotEmpty(request.source)) {
					const { source } = request;
					qb.andWhere(`"${query.alias}"."source" IN (:...source)`, {
						source
					});
				}
			})
		);
		qb.andWhere(
			new Brackets((qb: WhereExpressionBuilder) => {
				if (isNotEmpty(employeeIds)) {
					qb.andWhere(`"${query.alias}"."employeeId" IN (:...employeeIds)`, {
						employeeIds
					});
					qb.andWhere(`"time_slot"."employeeId" IN (:...employeeIds)`, {
						employeeIds
					});
				}
				if (isNotEmpty(projectIds)) {
					qb.andWhere(`"${query.alias}"."projectId" IN (:...projectIds)`, {
						projectIds
					});
				}
			})
		);
		return qb;
	}
}
