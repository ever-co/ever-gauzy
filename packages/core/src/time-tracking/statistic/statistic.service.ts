import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Brackets, SelectQueryBuilder, WhereExpressionBuilder } from 'typeorm';
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
import { RequestContext } from '../../core/context';
import { ArraySum, isNotEmpty } from '@gauzy/common';
import { ConfigService } from '@gauzy/config';
import {
	Activity,
	Employee,
	OrganizationProject,
	Task,
	TimeLog,
	TimeSlot
} from './../../core/entities/internal';
import { getDateFormat } from './../../core/utils';

@Injectable()
export class StatisticService {
	constructor(
		@InjectRepository(OrganizationProject)
		private readonly organizationProjectsRepository: Repository<OrganizationProject>,

		@InjectRepository(Task)
		private readonly taskRepository: Repository<Task>,

		@InjectRepository(TimeSlot)
		private readonly timeSlotRepository: Repository<TimeSlot>,

		@InjectRepository(Employee)
		private readonly employeeRepository: Repository<Employee>,

		@InjectRepository(Activity)
		private readonly activityRepository: Repository<Activity>,

		@InjectRepository(TimeLog)
		private readonly timeLogRepository: Repository<TimeLog>,

		private readonly configService: ConfigService
	) {}

	/**
	 * GET Time Tracking Dashboard Counts Statistics
	 * 
	 * @param request 
	 * @returns 
	 */
	async getCounts(request: IGetCountsStatistics): Promise<ICountsStatistics> {
		const {
			employeeId,
			organizationId,
			startDate,
			endDate,
			projectId,
			logType = [],
			source = []
		} = request;
		console.log(request, 'Get Counts Statistic Request');

		const user = RequestContext.currentUser();
		const tenantId = RequestContext.currentTenantId();

		const { start, end } = (startDate && endDate) ?
								getDateFormat(
									moment.utc(startDate),
									moment.utc(endDate)
								) : 
								getDateFormat(
									moment().startOf('day').utc(),
									moment().endOf('day').utc()
								);
		console.log({ start, end }, 'Weekly Time Date Range For Counts Statistics');
		/*
		 *  Get employees id of the organization or get current employee id
		 */
		let employeeIds = [];
		if (
			(user.employeeId && request.onlyMe) ||
			!RequestContext.hasPermission(
				PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
			)
		) {
			employeeIds = [user.employeeId];
		} else {
			employeeIds = await this.getEmployeesIds(
				organizationId,
				tenantId,
				employeeId
			);
		}

		// convert projectId String to Array
		let projectIds: string[] = [];
		if (typeof projectId === 'string') {
			projectIds.push(projectId);
		} else {
			projectIds = projectId;
		}

		/*
		 *  Get employees count who worked in this week.
		 */
		const employeesCountQuery = this.employeeRepository.createQueryBuilder();
		const employeesCount = await employeesCountQuery
			.innerJoin(`${employeesCountQuery.alias}.timeLogs`, 'timeLogs')
			.innerJoin(`timeLogs.timeSlots`, 'timeSlots')
			.andWhere(`"${employeesCountQuery.alias}"."tenantId" = :tenantId`, { tenantId })
			.andWhere(`"${employeesCountQuery.alias}"."organizationId" = :organizationId`, { organizationId })
			.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					qb.andWhere(`"timeLogs"."startedAt" BETWEEN :startDate AND :endDate`, {
						startDate: start,
						endDate: end
					});
					/**
					 * If Employee Selected
					 */
					if (isNotEmpty(employeeIds)) {
						qb.andWhere(`"timeLogs"."employeeId" IN (:...employeeIds)`, {
							employeeIds
						});
						qb.andWhere(`"timeSlots"."employeeId" IN (:...employeeIds)`, {
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
					if (request.activityLevel) {
						/**
						 * Activity Level should be 0-100%
						 * So, we have convert it into 10 minutes TimeSlot by multiply by 6
						 */
						const { activityLevel } = request;
						const startLevel = (activityLevel.start * 6);
						const endLevel = (activityLevel.end * 6);
				
						qb.andWhere(`"timeSlots"."overall" BETWEEN :startLevel AND :endLevel`, {
							startLevel,
							endLevel
						});
					}
					/**
					 * If LogType Selected
					 */
					if (isNotEmpty(logType)) {
						qb.andWhere(`"timeLogs"."logType" IN (:...logType)`, {
							logType
						});
					}
					/**
					 * If Source Selected
					 */
					if (isNotEmpty(source)) {
						qb.andWhere(`"timeLogs"."source" IN (:...source)`, {
							source
						});
					}
				})
			)
			.getCount();

		/*
		 *  Get projects count who worked in this week.
		 */
		const projectsCountQuery = this.organizationProjectsRepository.createQueryBuilder();
		const projectsCount = await projectsCountQuery
			.innerJoin(`${projectsCountQuery.alias}.timeLogs`, 'timeLogs')
			.innerJoin(`timeLogs.timeSlots`, 'timeSlots')
			.andWhere(`"${projectsCountQuery.alias}"."tenantId" = :tenantId`, { tenantId })
			.andWhere(`"${projectsCountQuery.alias}"."organizationId" = :organizationId`, { organizationId })
			.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					qb.andWhere(`"timeLogs"."startedAt" BETWEEN :startDate AND :endDate`, {
						startDate: start,
						endDate: end
					});
					/**
					 * If Employee Selected
					 */
					if (isNotEmpty(employeeIds)) {
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
					if (request.activityLevel) {
						/**
						 * Activity Level should be 0-100%
						 * So, we have convert it into 10 minutes TimeSlot by multiply by 6
						 */
						const { activityLevel } = request;
						const startLevel = (activityLevel.start * 6);
						const endLevel = (activityLevel.end * 6);
				
						qb.andWhere(`"timeSlots"."overall" BETWEEN :startLevel AND :endLevel`, {
							startLevel,
							endLevel
						});
					}
					/**
					 * If LogType Selected
					 */
					if (isNotEmpty(logType)) {
						qb.andWhere(`"timeLogs"."logType" IN (:...logType)`, {
							logType
						});
					}
					/**
					 * If Source Selected
					 */
					if (isNotEmpty(source)) {
						qb.andWhere(`"timeLogs"."source" IN (:...source)`, {
							source
						});
					}
				})
			)
			.getCount();

		/*
		 * Get average activity and total duration of the work for the week.
		 */
		let weekActivities = {
			overall: 0,
			duration: 0
		};
		if (isNotEmpty(employeeIds)) {
			const query = this.timeSlotRepository.createQueryBuilder();
			const weekTimeStatistics = await query
				.innerJoin(`${query.alias}.timeLogs`, 'timeLogs')
				.select(
					`${
						this.configService.dbConnectionOptions.type === 'sqlite'
							? `COALESCE((SUM((julianday(COALESCE("timeLogs"."stoppedAt", datetime('now'))) - julianday("timeLogs"."startedAt")) * 86400) / COUNT("${query.alias}"."id")), 0)`
							: `COALESCE((SUM(extract(epoch from (COALESCE("timeLogs"."stoppedAt", NOW()) - "timeLogs"."startedAt"))) / COUNT("${query.alias}"."id")), 0)`
					}`,
					`week_duration`
				)
				.addSelect(`COALESCE(SUM("${query.alias}"."overall"), 0)`, `overall`)
				.addSelect(`COALESCE(SUM("${query.alias}"."duration"), 0)`, `duration`)
				.addSelect(`COUNT("${query.alias}"."id")`, `time_slot_count`)
				.andWhere(`"${query.alias}"."tenantId" = :tenantId`, { tenantId })
				.andWhere(`"${query.alias}"."organizationId" = :organizationId`, { organizationId })
				.andWhere(
					new Brackets((qb: WhereExpressionBuilder) => {
						qb.andWhere(`"timeLogs"."startedAt" BETWEEN :startDate AND :endDate`, {
							startDate: start,
							endDate: end
						});
						/**
						 * If Employee Selected
						 */
						qb.andWhere(`"${query.alias}"."employeeId" IN (:...employeeIds)`, {
							employeeIds
						});
						/**
						 * If Project Selected
						 */
						if (isNotEmpty(projectIds)) {
							qb.andWhere(`"timeLogs"."projectId" IN (:...projectIds)`, {
								projectIds
							});
						}
						if (request.activityLevel) {
							/**
							 * Activity Level should be 0-100%
							 * So, we have convert it into 10 minutes TimeSlot by multiply by 6
							 */
							const { activityLevel } = request;
							const startLevel = (activityLevel.start * 6);
							const endLevel = (activityLevel.end * 6);
					
							qb.andWhere(`"${query.alias}"."overall" BETWEEN :startLevel AND :endLevel`, {
								startLevel,
								endLevel
							});
						}
						/**
						 * If LogType Selected
						 */
						if (isNotEmpty(logType)) {
							qb.andWhere(`"timeLogs"."logType" IN (:...logType)`, {
								logType
							});
						}
						/**
						 * If Source Selected
						 */
						if (isNotEmpty(source)) {
							qb.andWhere(`"timeLogs"."source" IN (:...source)`, {
								source
							});
						}
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
		}

		/*
		 * Get average activity and total duration of the work for today.
		 */
		let todayActivities = {
			overall: 0,
			duration: 0
		};

		if (isNotEmpty(employeeIds)) {
			const { start: startToday, end: endToday } = getDateFormat(
				moment().startOf('day').utc(),
				moment().endOf('day').utc()
			);
			console.log({ startToday, endToday }, 'Today Time Date Range For Counts Statistics');
			const query = this.timeSlotRepository.createQueryBuilder();
			const todayTimeStatistics = await query
				.innerJoin(`${query.alias}.timeLogs`, 'timeLogs')
				.select(
					`${
						this.configService.dbConnectionOptions.type === 'sqlite'
							? `COALESCE((SUM((julianday(COALESCE("timeLogs"."stoppedAt", datetime('now'))) - julianday("timeLogs"."startedAt")) * 86400) / COUNT("${query.alias}"."id")), 0)`
							: `COALESCE((SUM(extract(epoch from (COALESCE("timeLogs"."stoppedAt", NOW()) - "timeLogs"."startedAt"))) / COUNT("${query.alias}"."id")), 0)`
					}`,
					`today_duration`
				)
				.addSelect(`COALESCE(SUM("${query.alias}"."overall"), 0)`, `overall`)
				.addSelect(`COALESCE(SUM("${query.alias}"."duration"), 0)`, `duration`)
				.addSelect(`COUNT("${query.alias}"."id")`, `time_slot_count`)
				.andWhere(`"${query.alias}"."tenantId" = :tenantId`, { tenantId })
				.andWhere(`"${query.alias}"."organizationId" = :organizationId`, { organizationId })
				.andWhere(
					new Brackets((qb: WhereExpressionBuilder) => {
						qb.andWhere(`"timeLogs"."startedAt" BETWEEN :startDate AND :endDate`, {
							startDate: startToday,
							endDate: endToday
						});
						/**
						 * If Employee Selected
						 */
						qb.andWhere(`"${query.alias}"."employeeId" IN (:...employeeIds)`, {
							employeeIds
						});
						/**
						 * If Project Selected
						 */
						if (isNotEmpty(projectIds)) {
							qb.andWhere(`"timeLogs"."projectId" IN (:...projectIds)`, {
								projectIds
							});
						}
						if (request.activityLevel) {
							/**
							 * Activity Level should be 0-100%
							 * So, we have convert it into 10 minutes TimeSlot by multiply by 6
							 */
							const { activityLevel } = request;
							const startLevel = (activityLevel.start * 6);
							const endLevel = (activityLevel.end * 6);
					
							qb.andWhere(`"${query.alias}"."overall" BETWEEN :startLevel AND :endLevel`, {
								startLevel,
								endLevel
							});
						}
						/**
						 * If LogType Selected
						 */
						if (isNotEmpty(logType)) {
							qb.andWhere(`"timeLogs"."logType" IN (:...logType)`, {
								logType
							});
						}
						/**
						 * If Source Selected
						 */
						if (isNotEmpty(source)) {
							qb.andWhere(`"timeLogs"."source" IN (:...source)`, {
								source
							});
						}
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
		}
		return {
			employeesCount,
			projectsCount,
			weekActivities: parseFloat(
				parseFloat(weekActivities.overall + '').toFixed(1)
			),
			weekDuration: Math.round(weekActivities.duration),
			todayActivities: parseFloat(
				parseFloat(todayActivities.overall + '').toFixed(1)
			),
			todayDuration: Math.round(todayActivities.duration)
		};
	}

	/**
	 * GET Time Tracking Dashboard Worked Members Statistics
	 * 
	 * @param request 
	 * @returns 
	 */
	async getMembers(request: IGetMembersStatistics): Promise<IMembersStatistics[]> {
		const {
			employeeId,
			organizationId,
			projectId,
			startDate,
			endDate
		} = request;
		console.log(request, 'Get Members Statistic Request');

		const user = RequestContext.currentUser();
		const tenantId = RequestContext.currentTenantId();

		const { start: weeklyStart, end: weeklyEnd } = (startDate && endDate) ?
									getDateFormat(
										moment.utc(startDate),
										moment.utc(endDate)
									) :
									getDateFormat(
										moment().startOf('day').utc(),
										moment().endOf('day').utc()
									);
		console.log({ weeklyStart, weeklyEnd }, 'Weekly Time Date Range For Members Statistics');
		/*
		 *  Get employees id of the organization or get current employee id
		 */
		let employeeIds = [];
		if (
			user.employeeId ||
			!RequestContext.hasPermission(
				PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
			)
		) {
			employeeIds = [user.employeeId];
		} else {
			employeeIds = await this.getEmployeesIds(
				organizationId,
				tenantId,
				employeeId
			);
		}

		// convert projectId String to Array
		let projectIds: string[] = [];
		if (typeof projectId === 'string') {
			projectIds.push(projectId);
		} else {
			projectIds = projectId;
		}

		const query = this.employeeRepository.createQueryBuilder();
		let employees: IMembersStatistics[] = await query
			.select(`"${query.alias}".id`)
			.addSelect(`("user"."firstName" || ' ' ||  "user"."lastName")`, 'user_name')
			.addSelect(`"user"."imageUrl"`, 'user_image_url')
			.addSelect(
				`${
					this.configService.dbConnectionOptions.type === 'sqlite'
						? `COALESCE(SUM((julianday(COALESCE("timeLogs"."stoppedAt", datetime('now'))) - julianday("timeLogs"."startedAt")) * 86400), 0)`
						: `COALESCE(SUM(extract(epoch from (COALESCE("timeLogs"."stoppedAt", NOW()) - "timeLogs"."startedAt"))), 0)`
				}`,
				`duration`
			)
			.innerJoin(`${query.alias}.user`, 'user')
			.innerJoin(`${query.alias}.timeLogs`, 'timeLogs')
			.innerJoin(`timeLogs.timeSlots`, 'timeSlots')
			.andWhere(`"${query.alias}"."tenantId" = :tenantId`, { tenantId })
			.andWhere(`"${query.alias}"."organizationId" = :organizationId`, { organizationId })
			.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					qb.andWhere(`"timeLogs"."startedAt" BETWEEN :weeklyStart AND :weeklyEnd`, {
						weeklyStart,
						weeklyEnd
					});
					/**
					 * If Employee Selected
					 */
					qb.andWhere(`"${query.alias}"."id" IN(:...employeeIds)`, {
						employeeIds
					})
					.andWhere(`"timeLogs"."employeeId" IN(:...employeeIds)`, {
						employeeIds
					});

					/**
					 * If Project Selected
					 */
					if (isNotEmpty(projectIds)) {
						qb.andWhere(`"timeLogs"."projectId" IN (:...projectIds)`, {
							projectIds
						});
					}
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
					`${
						this.configService.dbConnectionOptions.type === 'sqlite'
							? `COALESCE((SUM((julianday(COALESCE("timeLogs"."stoppedAt", datetime('now'))) - julianday("timeLogs"."startedAt")) * 86400) / COUNT("${weekTimeQuery.alias}"."id")), 0)`
							: `COALESCE((SUM(extract(epoch from (COALESCE("timeLogs"."stoppedAt", NOW()) - "timeLogs"."startedAt"))) / COUNT("${weekTimeQuery.alias}"."id")), 0)`
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
						/**
						 * If Employee Selected
						 */
						if (isNotEmpty(employeeIds)) {
							qb.andWhere(`"${weekTimeQuery.alias}"."employeeId" IN(:...employeeIds)`, {
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
					`${
						this.configService.dbConnectionOptions.type === 'sqlite'
							? `COALESCE((SUM((julianday(COALESCE("timeLogs"."stoppedAt", datetime('now'))) - julianday("timeLogs"."startedAt")) * 86400) / COUNT("${dayTimeQuery.alias}"."id")), 0)`
							: `COALESCE((SUM(extract(epoch from (COALESCE("timeLogs"."stoppedAt", NOW()) - "timeLogs"."startedAt"))) / COUNT("${dayTimeQuery.alias}"."id")), 0)`
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
						const { start: startToday, end: endToday } = getDateFormat(
							moment().startOf('day').utc(),
							moment().endOf('day').utc()
						);
						console.log({ startToday, endToday }, 'Daily Time Date Range For Members Statistics');
						qb.where(`"timeLogs"."startedAt" BETWEEN :startToday AND :endToday`, {
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
						}
						/**
						 * If Project Selected
						 */
						if (isNotEmpty(projectIds)) {
							qb.andWhere(`"timeLogs"."projectId" IN(:...projectIds)`, {
								projectIds
							});
						}
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
					.innerJoin(`timeLogs.timeSlots`, 'timeSlots')
					.select(
						`${
							this.configService.dbConnectionOptions.type ===
							'sqlite'
								? `COALESCE(SUM((julianday(COALESCE("timeLogs"."stoppedAt", datetime('now'))) - julianday("timeLogs"."startedAt")) * 86400), 0)`
								: `COALESCE(SUM(extract(epoch from (COALESCE("timeLogs"."stoppedAt", NOW()) - "timeLogs"."startedAt"))), 0)`
						}`,
						`duration`
					)
					.addSelect(
						`${
							this.configService.dbConnectionOptions.type ===
							'sqlite'
								? `(strftime('%w', timeLogs.startedAt))`
								: 'EXTRACT(DOW FROM "timeLogs"."startedAt")'
						}`,
						'day'
					)
					.andWhere(`"${weekHoursQuery.alias}"."id" = :memberId`, { memberId: member.id })
					.andWhere(`"timeLogs"."startedAt" BETWEEN :weeklyStart AND :weeklyEnd`, {
						weeklyStart,
						weeklyEnd
					})
					.andWhere(`"${weekHoursQuery.alias}"."tenantId" = :tenantId`, { tenantId })
					.andWhere(`"${weekHoursQuery.alias}"."organizationId" = :organizationId`, { organizationId })

				// project filter query
				if (isNotEmpty(projectIds)) {
					weekHoursQuery.andWhere(`"timeLogs"."projectId" IN (:...projectIds)`, {
						projectIds
					});
				}

				member.weekHours = await weekHoursQuery
					.addGroupBy(
						`${
							this.configService.dbConnectionOptions.type ===
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
		const {
			employeeId,
			organizationId,
			projectId,
			startDate,
			endDate
		} = request;
		console.log(request, 'Get Projects Statistic Request');
		
		const user = RequestContext.currentUser();
		const tenantId = RequestContext.currentTenantId();
		const { start, end } = (startDate && endDate) ?
								getDateFormat(
									moment.utc(startDate),
									moment.utc(endDate)
								) :
								getDateFormat(
									moment().startOf('day').utc(),
									moment().endOf('day').utc()
								);
		console.log({ start, end }, 'Weekly Time Date Range For Projects Statistics');
		const query = this.organizationProjectsRepository.createQueryBuilder();
		query
			.select(`"${query.alias}".*`)
			.addSelect(
				`${
					this.configService.dbConnectionOptions.type === 'sqlite'
						? `COALESCE(SUM((julianday(COALESCE("timeLogs"."stoppedAt", datetime('now'))) - julianday("timeLogs"."startedAt")) * 86400), 0)`
						: `COALESCE(SUM(extract(epoch from (COALESCE("timeLogs"."stoppedAt", NOW()) - "timeLogs"."startedAt"))), 0)`
				}`,
				`duration`
			)
			.innerJoin(`${query.alias}.timeLogs`, 'timeLogs');
		/*
		 *  Get employees id of the organization or get current employee id
		 */
		let employeeIds = [];
		if (
			(user.employeeId && request.onlyMe) ||
			!RequestContext.hasPermission(
				PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
			)
		) {
			const employeeId = user.employeeId;
			employeeIds = [employeeId];
		} else {
			employeeIds = await this.getEmployeesIds(
				organizationId,
				tenantId,
				employeeId
			);
		}

		// convert projectId String to Array
		let projectIds: string[] = [];
		if (typeof projectId === 'string') {
			projectIds.push(projectId);
		} else {
			projectIds = projectId;
		}

		if (isNotEmpty(employeeIds)) {
			query
				.andWhere(`"timeLogs"."employeeId" IN(:...employeeId)`, {
					employeeId: employeeIds
				})
				.andWhere(`"timeLogs"."startedAt" BETWEEN :start AND :end`, {
					start,
					end
				})
				.andWhere(
					`"${query.alias}"."organizationId" = :organizationId`,
					{ organizationId }
				)
				.andWhere(`"${query.alias}"."tenantId" = :tenantId`, {
					tenantId
				});

			// project filter query
			if (isNotEmpty(projectIds)) {
				query.andWhere(`"timeLogs"."projectId" IN (:...projectIds)`, {
					projectIds
				});
			}

			let projects: IProjectsStatistics[] = await query
				.orderBy('duration', 'DESC')
				.addGroupBy(`"${query.alias}"."id"`)
				.limit(5)
				.getRawMany();

			const totalDurationQuery = this.organizationProjectsRepository.createQueryBuilder();
			totalDurationQuery
				.select(
					`${
						this.configService.dbConnectionOptions.type === 'sqlite'
							? `COALESCE(SUM((julianday(COALESCE("timeLogs"."stoppedAt", datetime('now'))) - julianday("timeLogs"."startedAt")) * 86400), 0)`
							: `COALESCE(SUM(extract(epoch from (COALESCE("timeLogs"."stoppedAt", NOW()) - "timeLogs"."startedAt"))), 0)`
					}`,
					`duration`
				)
				.innerJoin(`${totalDurationQuery.alias}.timeLogs`, 'timeLogs')
				.where(
					`"${totalDurationQuery.alias}"."organizationId" = :organizationId`,
					{ organizationId }
				)
				.andWhere(
					`"${totalDurationQuery.alias}"."tenantId" = :tenantId`,
					{
						tenantId
					}
				);

			// project filter query
			if (isNotEmpty(projectIds)) {
				totalDurationQuery.andWhere(
					`"timeLogs"."projectId" IN (:...projectIds)`,
					{
						projectIds
					}
				);
			}

			totalDurationQuery
				.andWhere(`"timeLogs"."employeeId" IN(:...employeeId)`, {
					employeeId: employeeIds
				})
				.andWhere(`"timeLogs"."startedAt" BETWEEN :start AND :end`, {
					start,
					end
				});
			const totalDuration = await totalDurationQuery.getRawOne();

			projects = projects.map((project) => {
				project.durationPercentage = parseFloat(
					parseFloat(
						(project.duration * 100) / totalDuration.duration + ''
					).toFixed(2)
				);
				return project;
			});
			return projects;
		}
		return [];
	}

	/**
	 * GET Time Tracking Dashboard Tasks Statistics
	 * 
	 * @param request 
	 * @returns 
	 */
	async getTasks(request: IGetTasksStatistics) {
		const {
			employeeId,
			organizationId,
			projectId,
			startDate,
			endDate
		} = request;
		console.log(request, 'Get Tasks Statistic Request');

		const user = RequestContext.currentUser();
		const tenantId = RequestContext.currentTenantId();
		const { start, end } = (startDate && endDate) ?
								getDateFormat(
									moment.utc(startDate),
									moment.utc(endDate)
								) :
								getDateFormat(
									moment().startOf('day').utc(),
									moment().endOf('day').utc()
								);
		console.log({ start, end }, 'Weekly Time Date Range For Tasks Statistics');
		/*
		 *  Get employees id of the organization or get current employee id
		 */
		let employeeIds = [];
		if (
			(user.employeeId && request.onlyMe) ||
			!RequestContext.hasPermission(
				PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
			)
		) {
			employeeIds = [user.employeeId];
		} else {
			employeeIds = await this.getEmployeesIds(
				organizationId,
				tenantId,
				employeeId
			);
		}

		// convert projectId String to Array
		let projectIds: string[] = [];
		if (typeof projectId === 'string') {
			projectIds.push(projectId);
		} else {
			projectIds = projectId;
		}

		if (employeeIds.length > 0) {
			const query = this.taskRepository.createQueryBuilder();
			query
				.select(`"${query.alias}".*`)
				.addSelect(
					`${
						this.configService.dbConnectionOptions.type === 'sqlite'
							? `COALESCE(SUM((julianday(COALESCE("timeLogs"."stoppedAt", datetime('now'))) - julianday("timeLogs"."startedAt")) * 86400), 0)`
							: `COALESCE(SUM(extract(epoch from (COALESCE("timeLogs"."stoppedAt", NOW()) - "timeLogs"."startedAt"))), 0)`
					}`,
					`duration`
				)
				.innerJoin(`${query.alias}.project`, 'project')
				.innerJoin(`${query.alias}.timeLogs`, 'timeLogs')
				.andWhere(`"timeLogs"."employeeId" IN(:...employeeId)`, {
					employeeId: employeeIds
				})
				.andWhere(`"timeLogs"."startedAt" BETWEEN :start AND :end`, {
					start,
					end
				})
				.andWhere(`"${query.alias}"."tenantId" = :tenantId`, {
					tenantId
				})
				.andWhere(
					`"${query.alias}"."organizationId" = :organizationId`,
					{
						organizationId
					}
				)
				.orderBy('duration', 'DESC')
				.addGroupBy(`"${query.alias}"."id"`)
				.limit(5);

			// project filter query
			if (isNotEmpty(projectIds)) {
				query.andWhere(`"timeLogs"."projectId" IN (:...projectIds)`, {
					projectIds
				});
			}

			let tasks: ITask[] = await query.getRawMany();

			const totalDurationQuery = this.taskRepository.createQueryBuilder();
			totalDurationQuery
				.select(
					`${
						this.configService.dbConnectionOptions.type === 'sqlite'
							? `COALESCE(SUM((julianday(COALESCE("timeLogs"."stoppedAt", datetime('now'))) - julianday("timeLogs"."startedAt")) * 86400), 0)`
							: `COALESCE(SUM(extract(epoch from (COALESCE("timeLogs"."stoppedAt", NOW()) - "timeLogs"."startedAt"))), 0)`
					}`,
					`duration`
				)
				.innerJoin(`${totalDurationQuery.alias}.timeLogs`, 'timeLogs')
				.andWhere(`"timeLogs"."employeeId" IN(:...employeeId)`, {
					employeeId: employeeIds
				})
				.andWhere(`"timeLogs"."startedAt" BETWEEN :start AND :end`, {
					start,
					end
				})
				.andWhere(`"${query.alias}"."tenantId" = :tenantId`, {
					tenantId
				})
				.andWhere(
					`"${query.alias}"."organizationId" = :organizationId`,
					{ organizationId }
				);

			// project filter query
			if (isNotEmpty(projectIds)) {
				totalDurationQuery.andWhere(
					`"timeLogs"."projectId" IN (:...projectIds)`,
					{
						projectIds
					}
				);
			}
			const totalDuration = await totalDurationQuery.getRawOne();
			tasks = tasks.map((task: any) => {
				task.durationPercentage = parseFloat(
					parseFloat(
						(task.duration * 100) / totalDuration.duration + ''
					).toFixed(2)
				);
				return task;
			});
			return tasks;
		} else {
			return [];
		}
	}

	/**
	 * GET Time Tracking Dashboard Manual Time Logs Statistics
	 * 
	 * @param request 
	 * @returns 
	 */
	async manualTimes(request: IGetManualTimesStatistics): Promise<IManualTimesStatistics[]> {
		const {
			employeeId,
			organizationId,
			projectId,
			startDate,
			endDate
		} = request;
		console.log(request, 'Get Manual Times Statistic Request');

		const user = RequestContext.currentUser();
		const tenantId = RequestContext.currentTenantId();
		const { start, end } = (startDate && endDate) ?
								getDateFormat(
									moment.utc(startDate),
									moment.utc(endDate)
								) :
								getDateFormat(
									moment().startOf('day').utc(),
									moment().endOf('day').utc()
								);
		console.log({ start, end }, 'Weekly Time Date Range For Manual Times Statistics');
		/*
		 *  Get employees id of the organization or get current employee id
		 */
		let employeeIds = [];
		if (
			(user.employeeId && request.onlyMe) ||
			!RequestContext.hasPermission(
				PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
			)
		) {
			employeeIds = [user.employeeId];
		} else {
			employeeIds = await this.getEmployeesIds(
				organizationId,
				tenantId,
				employeeId
			);
		}

		// convert projectId String to Array
		let projectIds: string[] = [];
		if (typeof projectId === 'string') {
			projectIds.push(projectId);
		} else {
			projectIds = projectId;
		}

		if (employeeIds.length > 0) {
			const timeLogs = await this.timeLogRepository.find({
				join: {
					alias: 'time_log',
					innerJoin: {
						timeSlots: 'time_log.timeSlots'
					}
				},
				relations: [
					'project',
					'employee',
					'employee.user',
					'timeSlots'
				],
				where: (qb: SelectQueryBuilder<TimeLog>) => {
					qb.where({
						employeeId: In(employeeIds),
						logType: TimeLogType.MANUAL
					});
					qb.andWhere(
						`"${qb.alias}"."startedAt" BETWEEN :start AND :end`,
						{ start, end }
					);
					qb.andWhere(
						`"${qb.alias}"."organizationId" = :organizationId`,
						{ organizationId }
					);
					qb.andWhere(`"${qb.alias}"."tenantId" = :tenantId`, {
						tenantId
					});

					// project filter query
					if (isNotEmpty(projectIds)) {
						qb.andWhere(
							`"${qb.alias}"."projectId" IN (:...projectIds)`,
							{
								projectIds
							}
						);
					}
				},
				take: 5,
				order: {
					startedAt: 'DESC'
				}
			});

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
			return mappedTimeLogs;
		} else {
			return [];
		}
	}

	/**
	 * GET Time Tracking Dashboard Activities Statistics
	 * 
	 * @param request 
	 * @returns 
	 */
	async getActivities(request: IGetActivitiesStatistics): Promise<IActivitiesStatistics[]> {
		const {
			employeeId,
			organizationId,
			projectId,
			startDate,
			endDate
		} = request;

		const user = RequestContext.currentUser();
		const tenantId = RequestContext.currentTenantId();
		const { start, end } = (startDate && endDate) ?
								getDateFormat(
									moment.utc(startDate),
									moment.utc(endDate)
								) :
								getDateFormat(
									moment().startOf('day').utc(),
									moment().endOf('day').utc()
								);
		console.log({ start, end }, 'Weekly Time Date Range For Activities Statistics');
		/*
		 *  Get employees id of the organization or get current employee id
		 */
		let employeeIds = [];
		if (
			(user.employeeId && request.onlyMe) ||
			!RequestContext.hasPermission(
				PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
			)
		) {
			employeeIds = [user.employeeId];
		} else {
			employeeIds = await this.getEmployeesIds(
				organizationId,
				tenantId,
				employeeId
			);
		}

		// convert projectId String to Array
		let projectIds: string[] = [];
		if (typeof projectId === 'string') {
			projectIds.push(projectId);
		} else {
			projectIds = projectId;
		}

		if (employeeIds.length > 0) {
			const query = this.activityRepository.createQueryBuilder();
			query
				.innerJoin(`${query.alias}.timeSlot`, 'timeSlot')
				.select(`COUNT("${query.alias}"."id")`, `sessions`)
				.addSelect(`SUM("${query.alias}"."duration")`, `duration`)
				.addSelect(`"${query.alias}"."title"`, `title`)
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
				.andWhere(`"${query.alias}"."employeeId" IN(:...employeeId)`, {
					employeeId: employeeIds
				})
				.andWhere(`"${query.alias}"."tenantId" = :tenantId`, {
					tenantId
				})
				.andWhere(`"${query.alias}"."organizationId" = :organizationId`, {
					organizationId
				})
				.orderBy(`"duration"`, 'DESC')
				.limit(5);

			// project filter query
			if (isNotEmpty(projectIds)) {
				query.andWhere(
					`"${query.alias}"."projectId" IN (:...projectIds)`,
					{
						projectIds
					}
				);
			}

			let activities: IActivitiesStatistics[] = await query.getRawMany();

			/*
			 * Fetch total duration of the week for calculate duration percentage
			 */
			const totalDurationQuery = this.activityRepository.createQueryBuilder();
			totalDurationQuery
				.innerJoin(`${totalDurationQuery.alias}.timeSlot`, 'timeSlot')
				.select(
					`SUM("${totalDurationQuery.alias}"."duration")`,
					`duration`
				)
				.andWhere(
					`"${totalDurationQuery.alias}"."employeeId" IN(:...employeeId)`,
					{ employeeId: employeeIds }
				)
				.andWhere(
					new Brackets((qb) => {
						if (
							this.configService.dbConnectionOptions.type ===
							'sqlite'
						) {
							qb.andWhere(
								`datetime("${totalDurationQuery.alias}"."date" || ' ' || "${totalDurationQuery.alias}"."time") Between :start AND :end`,
								{ start, end }
							);
						} else {
							qb.andWhere(
								`concat("${totalDurationQuery.alias}"."date", ' ', "${totalDurationQuery.alias}"."time")::timestamp Between :start AND :end`,
								{ start, end }
							);
						}
					})
				)
				.andWhere(`"${totalDurationQuery.alias}"."tenantId" = :tenantId`, {
					tenantId
				})
				.andWhere(`"${totalDurationQuery.alias}"."organizationId" = :organizationId`, {
					organizationId
				});

			// project filter query
			if (isNotEmpty(projectIds)) {
				totalDurationQuery.andWhere(
					`"${totalDurationQuery.alias}"."projectId" IN (:...projectIds)`,
					{
						projectIds
					}
				);
			}

			const totalDuration = await totalDurationQuery.getRawOne();
			activities = activities.map((activity) => {
				activity.durationPercentage =
					(activity.duration * 100) / totalDuration.duration;
				return activity;
			});

			return activities;
		} else {
			return [];
		}
	}

	/**
	 * GET Time Tracking Dashboard Time Slots Statistics
	 * 
	 * @param request 
	 * @returns 
	 */
	async getEmployeeTimeSlots(request: IGetTimeSlotStatistics): Promise<ITimeSlotStatistics[]> {
		const {
			employeeId,
			organizationId,
			projectId,
			startDate,
			endDate
		} = request;
		console.log(request, 'Get TimeSlot Statistic Request');

		const user = RequestContext.currentUser();
		const tenantId = RequestContext.currentTenantId();
		const { start, end } = (startDate && endDate) ?
								getDateFormat(
									moment.utc(startDate),
									moment.utc(endDate)
								) :
								getDateFormat(
									moment().startOf('day').utc(),
									moment().endOf('day').utc()
								);
		console.log({ start, end }, 'Weekly Time Date Range For Employee TimeSlots Statistics');

		/*
		 *  Get employees id of the organization or get current employee id
		 */
		let employeeIds = [];
		if (
			(user.employeeId && request.onlyMe) ||
			!RequestContext.hasPermission(
				PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
			)
		) {
			employeeIds = [user.employeeId];
		} else {
			employeeIds = await this.getEmployeesIds(
				organizationId,
				tenantId,
				employeeId
			);
		}

		/**
		 * GET project filter IDs
		 */
		let projectIds: string[] = [];
		if (typeof projectId === 'string') {
			projectIds.push(projectId);
		} else {
			projectIds = projectId;
		}

		const query = this.timeLogRepository.createQueryBuilder('time_log');
		query.select(`"time_log"."employeeId"`, "id");
		query.addSelect(`MAX("${query.alias}"."startedAt")`, "startedAt");
		query.addSelect(`"user"."imageUrl"`, "user_image_url");
		query.addSelect(`("user"."firstName" || ' ' ||  "user"."lastName")`, "user_name");
		query.innerJoin(`${query.alias}.employee`, 'employee');
		query.innerJoin(`employee.user`, "user");
		query.andWhere(
			new Brackets((qb: WhereExpressionBuilder) => { 
				qb.andWhere(`"${query.alias}"."startedAt" BETWEEN :start AND :end`, {
					start,
					end
				});
				qb.andWhere(`"${query.alias}"."organizationId" = :organizationId`, {
					organizationId
				})
				qb.andWhere(`"${query.alias}"."tenantId" = :tenantId`, {
					tenantId
				})
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

			employee.timeSlots = await this.timeSlotRepository.find({
				join: {
					alias: 'time_slot',
					leftJoin: {
						employee: 'time_slot.employee'
					},
					innerJoinAndSelect: {
						timeLogs: 'time_slot.timeLogs'
					}
				},
				relations: [
					'employee', 'employee.user', 'screenshots'
				],
				where: (qb: SelectQueryBuilder<TimeSlot>) => {
					const { id: employeeId } = employee;
					qb.andWhere(`"${qb.alias}"."employeeId" = :employeeId`, {
						employeeId
					});
					qb.andWhere(`"${qb.alias}"."organizationId" = :organizationId`, {
						organizationId
					});
					qb.andWhere(`"${qb.alias}"."tenantId" = :tenantId`, {
						tenantId
					});
					qb.andWhere(`"timeLogs"."startedAt" BETWEEN :start AND :end`, {
						start,
						end
					});
					// project filter query
					if (isNotEmpty(projectIds)) {
						qb.andWhere(`"timeLogs"."projectId" IN (:...projectIds)`, {
							projectIds
						});
					}
				},
				take: 3,
				order: {
					startedAt: 'DESC'
				}
			});
		}
		return employees;
	}

	private async getEmployeesIds(
		organizationId: string,
		tenantId: string,
		employeeId?: string
	) {
		const query = this.employeeRepository.createQueryBuilder('employee');
		query.select(['id']);

		if (isNotEmpty(employeeId)) {
			query.andWhere('"id" = :employeeId', { employeeId });
		} else {
			query
				.andWhere('"organizationId" = :organizationId', {
					organizationId
				})
				.andWhere('"tenantId" = :tenantId', { tenantId });
		}

		const employees = await query.getRawMany();
		return pluck(employees, 'id');
	}
}
