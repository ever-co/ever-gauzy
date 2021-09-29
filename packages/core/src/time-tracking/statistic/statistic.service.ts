import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Brackets, SelectQueryBuilder } from 'typeorm';
import * as _ from 'underscore';
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
	TimeLogType
} from '@gauzy/contracts';
import { RequestContext } from '../../core/context';
import { average, ArraySum, isNotEmpty } from '@gauzy/common';
import { ConfigService } from '@gauzy/config';
import {
	Activity,
	Employee,
	OrganizationProject,
	Task,
	TimeLog,
	TimeSlot
} from './../../core/entities/internal';
import { getDateRange } from './../../core/utils';

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

	async getCounts(request: IGetCountsStatistics): Promise<ICountsStatistics> {
		const {
			employeeId,
			organizationId,
			startDate,
			endDate,
			date = new Date(),
			projectId,
			logType = [],
			source = []
		} = request;

		let { start, end } = getDateRange(date, 'week');
		if (startDate && endDate) {
			const range = getDateRange(startDate, endDate);
			start = range['start'];
			end = range['end'];
		}

		const user = RequestContext.currentUser();
		const tenantId = user.tenantId;

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
		employeesCountQuery
			.innerJoin(`${employeesCountQuery.alias}.timeLogs`, 'timeLogs')
			.innerJoin(`timeLogs.timeSlots`, 'timeSlots');

		if (isNotEmpty(employeeIds)) {
			employeesCountQuery
				.where({
					id: In(employeeIds)
				})
				.andWhere(`"timeLogs"."startedAt" BETWEEN :start AND :end`, {
					start,
					end
				});
		}

		// project filter query
		if (isNotEmpty(projectIds)) {
			employeesCountQuery.andWhere(
				`"timeLogs"."projectId" IN (:...projectIds)`,
				{
					projectIds
				}
			);
		}

		if (isNotEmpty(logType)) {
			employeesCountQuery.andWhere(
				`"timeLogs"."logType" IN (:...logType)`,
				{
					logType
				}
			);
		}

		if (isNotEmpty(source)) {
			employeesCountQuery.andWhere(
				`"timeLogs"."source" IN (:...source)`,
				{
					source
				}
			);
		}

		const employeesCount = await employeesCountQuery
			.andWhere(`"${employeesCountQuery.alias}"."tenantId" = :tenantId`, {
				tenantId
			})
			.andWhere(
				`"${employeesCountQuery.alias}"."organizationId" = :organizationId`,
				{
					organizationId
				}
			)
			.getCount();

		/*
		 *  Get projects count who worked in this week.
		 */
		const projectsCountQuery = this.organizationProjectsRepository.createQueryBuilder();
		projectsCountQuery
			.innerJoin(`${projectsCountQuery.alias}.timeLogs`, 'timeLogs')
			.innerJoin(`timeLogs.timeSlots`, 'timeSlots');

		if (isNotEmpty(employeeIds)) {
			projectsCountQuery
				.where(`"timeLogs"."employeeId" IN (:...employeeId)`, {
					employeeId: employeeIds
				})
				.andWhere(`"timeLogs"."startedAt" BETWEEN :start AND :end`, {
					start,
					end
				});
		}

		// project filter query
		if (isNotEmpty(projectIds)) {
			projectsCountQuery.andWhere(
				`"timeLogs"."projectId" IN (:...projectIds)`,
				{
					projectIds
				}
			);
		}

		if (isNotEmpty(logType)) {
			projectsCountQuery.andWhere(
				`"timeLogs"."logType" IN (:...logType)`,
				{
					logType
				}
			);
		}

		if (isNotEmpty(source)) {
			projectsCountQuery.andWhere(`"timeLogs"."source" IN (:...source)`, {
				source
			});
		}

		const projectsCount = await projectsCountQuery
			.andWhere(`"${projectsCountQuery.alias}"."tenantId" = :tenantId`, {
				tenantId
			})
			.andWhere(
				`"${projectsCountQuery.alias}"."organizationId" = :organizationId`,
				{
					organizationId
				}
			)
			.getCount();

		/*
		 * Get average activity and total duration of the work for the week.
		 */
		let weekActivities = {
			overall: 0,
			duration: 0
		};
		if (employeeIds.length > 0) {
			const query = this.timeSlotRepository.createQueryBuilder(
				'time_slot'
			);
			query
				.innerJoinAndSelect(`${query.alias}.timeLogs`, 'timeLogs')
				.select(
					`${
						this.configService.dbConnectionOptions.type === 'sqlite'
							? `COALESCE((SUM((julianday(COALESCE("timeLogs"."stoppedAt", datetime('now'))) - julianday("timeLogs"."startedAt")) * 86400) / COUNT("${query.alias}"."id")), 0)`
							: `COALESCE((SUM(extract(epoch from (COALESCE("timeLogs"."stoppedAt", NOW()) - "timeLogs"."startedAt"))) / COUNT("${query.alias}"."id")), 0)`
					}`,
					`duration`
				)
				.addSelect(`AVG("${query.alias}"."overall")`, `overall`)
				.addSelect(`COUNT("${query.alias}"."id")`, `count`)
				.andWhere(`"${query.alias}"."employeeId" IN(:...employeeIds)`, {
					employeeIds
				})
				.andWhere(`"${query.alias}"."tenantId" = :tenantId`, {
					tenantId
				})
				.andWhere(
					`"${query.alias}"."organizationId" = :organizationId`,
					{ organizationId }
				)
				.andWhere(`"timeLogs"."startedAt" BETWEEN :start AND :end`, {
					start,
					end
				})
				.groupBy(`"timeLogs"."id"`);

			// project filter query
			if (isNotEmpty(projectIds)) {
				query.andWhere(`"timeLogs"."projectId" IN (:...projectIds)`, {
					projectIds
				});
			}

			if (isNotEmpty(logType)) {
				query.andWhere(`"timeLogs"."logType" IN (:...logType)`, {
					logType
				});
			}

			if (isNotEmpty(source)) {
				query.andWhere(`"timeLogs"."source" IN (:...source)`, {
					source
				});
			}

			const weekTimeStatistics = await query.getRawMany();
			const duration = _.reduce(
				_.pluck(weekTimeStatistics, 'duration'),
				ArraySum,
				0
			);
			const overall = average(weekTimeStatistics, 'overall');

			weekActivities['duration'] = duration;
			weekActivities['overall'] = overall;
		}

		/*
		 * Get average activity and total duration of the work for today.
		 */
		let todayActivities = {
			overall: 0,
			duration: 0
		};

		if (employeeIds.length > 0) {
			let { start, end } = getDateRange();
			const query = this.timeSlotRepository.createQueryBuilder(
				'time_slot'
			);
			query
				.innerJoin(`${query.alias}.timeLogs`, 'timeLogs')
				.select(
					`${
						this.configService.dbConnectionOptions.type === 'sqlite'
							? `COALESCE((SUM((julianday(COALESCE("timeLogs"."stoppedAt", datetime('now'))) - julianday("timeLogs"."startedAt")) * 86400) / COUNT("${query.alias}"."id")), 0)`
							: `COALESCE((SUM(extract(epoch from (COALESCE("timeLogs"."stoppedAt", NOW()) - "timeLogs"."startedAt"))) / COUNT("${query.alias}"."id")), 0)`
					}`,
					`duration`
				)
				.addSelect(`AVG("${query.alias}"."overall")`, `overall`)
				.addSelect(`COUNT("${query.alias}"."id")`, `count`)
				.andWhere(`"${query.alias}"."employeeId" IN(:...employeeIds)`, {
					employeeIds
				})
				.andWhere(`"${query.alias}"."tenantId" = :tenantId`, {
					tenantId
				})
				.andWhere(
					`"${query.alias}"."organizationId" = :organizationId`,
					{ organizationId }
				)
				.andWhere(`"timeLogs"."startedAt" BETWEEN :start AND :end`, {
					start,
					end
				})
				.groupBy(`"timeLogs"."id"`);

			// project filter query
			if (isNotEmpty(projectIds)) {
				query.andWhere(`"timeLogs"."projectId" IN (:...projectIds)`, {
					projectIds
				});
			}

			if (isNotEmpty(logType)) {
				query.andWhere(`"timeLogs"."logType" IN (:...logType)`, {
					logType
				});
			}

			if (isNotEmpty(source)) {
				query.andWhere(`"timeLogs"."source" IN (:...source)`, {
					source
				});
			}

			const todayTimeStatistics = await query.getRawMany();
			const duration = _.reduce(
				_.pluck(todayTimeStatistics, 'duration'),
				ArraySum,
				0
			);
			const overall = average(todayTimeStatistics, 'overall');

			todayActivities['duration'] = duration;
			todayActivities['overall'] = overall;
		}

		return {
			employeesCount,
			projectsCount,
			weekActivities: parseFloat(
				parseFloat(weekActivities.overall + '').toFixed(1)
			),
			weekDuration: weekActivities.duration,
			todayActivities: parseFloat(
				parseFloat(todayActivities.overall + '').toFixed(1)
			),
			todayDuration: todayActivities.duration
		};
	}

	async getMembers(request: IGetMembersStatistics): Promise<IMembersStatistics[]> {
		const {
			employeeId,
			organizationId,
			date = new Date(),
			projectId
		} = request;
		const tenantId = RequestContext.currentTenantId();
		const user = RequestContext.currentUser();
		const { start, end } = getDateRange(date, 'week');

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
		query
			.select(`"${query.alias}".id`)
			.addSelect(
				`("user"."firstName" || ' ' ||  "user"."lastName")`,
				'user_name'
			)
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
			.andWhere(`"${query.alias}"."organizationId" = :organizationId`, {
				organizationId
			})
			.andWhere(`"${query.alias}"."tenantId" = :tenantId`, { tenantId })
			.andWhere(`"timeLogs"."startedAt" BETWEEN :start AND :end`, {
				start,
				end
			});

		if (isNotEmpty(employeeIds)) {
			query
				.andWhere(`"${query.alias}"."id" IN(:...employeeIds)`, {
					employeeIds
				})
				.andWhere(`"timeLogs"."employeeId" IN(:...employeeIds)`, {
					employeeIds
				});
		}

		// project filter query
		if (isNotEmpty(projectIds)) {
			query.andWhere(`"timeLogs"."projectId" IN (:...projectIds)`, {
				projectIds
			});
		}

		let employees: IMembersStatistics[] = await query
			.addGroupBy(`"${query.alias}"."id"`)
			.addGroupBy(`"user"."id"`)
			.orderBy('duration', 'DESC')
			.limit(5)
			.getRawMany();

		if (employees.length > 0) {
			const employeeIds = _.pluck(employees, 'id');

			let weekTimeQuery = this.timeSlotRepository.createQueryBuilder(
				'time_slot'
			);
			weekTimeQuery
				.innerJoin(`${weekTimeQuery.alias}.timeLogs`, 'timeLogs')
				.select(
					`${
						this.configService.dbConnectionOptions.type === 'sqlite'
							? `COALESCE((SUM((julianday(COALESCE("timeLogs"."stoppedAt", datetime('now'))) - julianday("timeLogs"."startedAt")) * 86400) / COUNT("${weekTimeQuery.alias}"."id")), 0)`
							: `COALESCE((SUM(extract(epoch from (COALESCE("timeLogs"."stoppedAt", NOW()) - "timeLogs"."startedAt"))) / COUNT("${weekTimeQuery.alias}"."id")), 0)`
					}`,
					`duration`
				)
				.addSelect(`AVG("${weekTimeQuery.alias}"."overall")`, `overall`)
				.addSelect(`COUNT("${weekTimeQuery.alias}"."id")`, `count`)
				.addSelect(`${weekTimeQuery.alias}.employeeId`, 'employeeId')
				.andWhere(
					`"${weekTimeQuery.alias}"."employeeId" IN(:...employeeIds)`,
					{
						employeeIds
					}
				)
				.andWhere(`"timeLogs"."startedAt" BETWEEN :start AND :end`, {
					start,
					end
				})
				.andWhere(
					`"${weekTimeQuery.alias}"."organizationId" = :organizationId`,
					{ organizationId }
				)
				.andWhere(`"${weekTimeQuery.alias}"."tenantId" = :tenantId`, {
					tenantId
				})
				.groupBy(`timeLogs.id`)
				.addGroupBy(`${weekTimeQuery.alias}.employeeId`);

			// project filter query
			if (isNotEmpty(projectIds)) {
				weekTimeQuery.andWhere(
					`"timeLogs"."projectId" IN (:...projectIds)`,
					{
						projectIds
					}
				);
			}

			let weekTimeSlots: any = await weekTimeQuery.getRawMany();
			weekTimeSlots = _.mapObject(
				_.groupBy(weekTimeSlots, 'employeeId'),
				function (values, employeeId) {
					const duration = _.reduce(
						_.pluck(values, 'duration'),
						ArraySum,
						0
					);
					const overall = average(values, 'overall');
					return {
						employeeId,
						duration,
						overall
					};
				}
			);
			weekTimeSlots = _.chain(weekTimeSlots)
				.map((weekTimeSlot: any) => {
					if (weekTimeSlot && weekTimeSlot.overall) {
						weekTimeSlot.overall = parseFloat(
							weekTimeSlot.overall as string
						).toFixed(1);
					}
					return weekTimeSlot;
				})
				.indexBy('employeeId')
				.value();

			let dayTimeQuery = this.timeSlotRepository.createQueryBuilder(
				'time_slot'
			);
			dayTimeQuery
				.innerJoin(`${dayTimeQuery.alias}.timeLogs`, 'timeLogs')
				.select(
					`${
						this.configService.dbConnectionOptions.type === 'sqlite'
							? `COALESCE((SUM((julianday(COALESCE("timeLogs"."stoppedAt", datetime('now'))) - julianday("timeLogs"."startedAt")) * 86400) / COUNT("${dayTimeQuery.alias}"."id")), 0)`
							: `COALESCE((SUM(extract(epoch from (COALESCE("timeLogs"."stoppedAt", NOW()) - "timeLogs"."startedAt"))) / COUNT("${dayTimeQuery.alias}"."id")), 0)`
					}`,
					`duration`
				)
				.addSelect(`AVG("${dayTimeQuery.alias}"."overall")`, `overall`)
				.addSelect(`COUNT("${dayTimeQuery.alias}"."id")`, `count`)
				.addSelect(`${dayTimeQuery.alias}.employeeId`, 'employeeId')
				.andWhere(
					`"${dayTimeQuery.alias}"."employeeId" IN(:...employeeIds)`,
					{
						employeeIds
					}
				)
				.andWhere(
					new Brackets((qb) => {
						const { start, end } = getDateRange();
						qb.where(
							`"timeLogs"."startedAt" BETWEEN :start AND :end`,
							{
								start,
								end
							}
						);
					})
				)
				.andWhere(
					`"${dayTimeQuery.alias}"."organizationId" = :organizationId`,
					{ organizationId }
				)
				.andWhere(`"${dayTimeQuery.alias}"."tenantId" = :tenantId`, {
					tenantId
				})
				.groupBy(`timeLogs.id`)
				.addGroupBy(`${dayTimeQuery.alias}.employeeId`);

			// project filter query
			if (isNotEmpty(projectIds)) {
				dayTimeQuery.andWhere(
					`"timeLogs"."projectId" IN (:...projectIds)`,
					{
						projectIds
					}
				);
			}

			let dayTimeSlots: any = await weekTimeQuery.getRawMany();
			dayTimeSlots = _.mapObject(
				_.groupBy(dayTimeSlots, 'employeeId'),
				function (values, employeeId) {
					const duration = _.reduce(
						_.pluck(values, 'duration'),
						ArraySum,
						0
					);
					const overall = average(values, 'overall');
					return {
						employeeId,
						duration,
						overall
					};
				}
			);
			dayTimeSlots = _.chain(dayTimeSlots)
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
					.where({ id: member.id })
					.andWhere(
						`"timeLogs"."startedAt" BETWEEN :start AND :end`,
						{ start, end }
					)
					.andWhere(
						`"${weekHoursQuery.alias}"."tenantId" = :tenantId`,
						{ tenantId }
					);

				// project filter query
				if (isNotEmpty(projectIds)) {
					weekHoursQuery.andWhere(
						`"timeLogs"."projectId" IN (:...projectIds)`,
						{
							projectIds
						}
					);
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

	async getProjects(request: IGetProjectsStatistics): Promise<IProjectsStatistics[]> {
		const user = RequestContext.currentUser();
		const tenantId = RequestContext.currentTenantId();
		const {
			employeeId,
			organizationId,
			date = new Date(),
			projectId
		} = request;
		const { start, end } = getDateRange(date, 'week');

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
		 *  Get employees id of the orginization or get current employe id
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

	async getTasks(request: IGetTasksStatistics) {
		const user = RequestContext.currentUser();
		const tenantId = user.tenantId;
		const {
			employeeId,
			organizationId,
			date = new Date(),
			projectId
		} = request;
		const { start, end } = getDateRange(date, 'week');

		/*
		 *  Get employees id of the orginization or get current employe id
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
				.innerJoin(`${query.alias}.project`, 'project')
				.select(`"${query.alias}".*`)
				.addSelect(
					`${
						this.configService.dbConnectionOptions.type === 'sqlite'
							? `COALESCE(SUM((julianday(COALESCE("timeLogs"."stoppedAt", datetime('now'))) - julianday("timeLogs"."startedAt")) * 86400), 0)`
							: `COALESCE(SUM(extract(epoch from (COALESCE("timeLogs"."stoppedAt", NOW()) - "timeLogs"."startedAt"))), 0)`
					}`,
					`duration`
				)
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

			let tasks = await query.getRawMany();

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
			tasks = tasks.map((task) => {
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

	async manualTimes(request: IGetManualTimesStatistics) {
		const date = request.date || new Date();
		const user = RequestContext.currentUser();
		const tenantId = user.tenantId;
		const { employeeId, organizationId, projectId } = request;
		const { start, end } = getDateRange(date, 'week');

		/*
		 *  Get employees id of the orginization or get current employe id
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

			const mapedTimeLogs: IManualTimesStatistics[] = timeLogs.map(
				(timeLog) => {
					return {
						id: timeLog.id,
						startedAt: timeLog.startedAt,
						duration: timeLog.duration,
						user: _.pick(timeLog.employee.user, [
							'name',
							'imageUrl'
						]),
						project: _.pick(timeLog.employee.user, ['name']),
						employeeId: timeLog.employee.id
					} as IManualTimesStatistics;
				}
			);
			return mapedTimeLogs;
		} else {
			return [];
		}
	}

	async getActivites(request: IGetActivitiesStatistics) {
		const date = request.date || new Date();
		const user = RequestContext.currentUser();
		const tenantId = user.tenantId;
		const { employeeId, organizationId, projectId } = request;
		/*
		 *  Get employees id of the orginization or get current employe id
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
						const { start, end } = getDateRange(date, 'week');
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
				.andWhere(
					`"${query.alias}"."organizationId" = :organizationId`,
					{
						organizationId
					}
				)
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
						const { start, end } = getDateRange(date, 'week');
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
				.andWhere(
					`"${totalDurationQuery.alias}"."tenantId" = :tenantId`,
					{
						tenantId
					}
				)
				.andWhere(
					`"${totalDurationQuery.alias}"."organizationId" = :organizationId`,
					{ organizationId }
				);

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

	async getEmployeeTimeSlots(request: IGetTimeSlotStatistics) {
		let employees: ITimeSlotStatistics[] = [];
		const date = request.date || new Date();
		const user = RequestContext.currentUser();
		const tenantId = user.tenantId;
		const { employeeId, organizationId, projectId } = request;
		const { start, end } = getDateRange(date, 'week');

		const query = this.employeeRepository.createQueryBuilder();
		query
			.select(`"${query.alias}".*`)
			.addSelect('MAX(timeLogs.startedAt)', 'startedAt')
			.addSelect(
				`("user"."firstName" || ' ' ||  "user"."lastName")`,
				'user_name'
			)
			.addSelect(`"user"."imageUrl"`, 'user_image_url')
			.innerJoin(`${query.alias}.timeLogs`, 'timeLogs')
			.innerJoin(`${query.alias}.user`, 'user')
			.andWhere(`"timeLogs"."startedAt" BETWEEN :start AND :end`, {
				start,
				end
			})
			.groupBy(`"${query.alias}".id`)
			.addGroupBy('user.id')
			.orderBy('"startedAt"', 'DESC')
			.limit(3);

		if (
			(user.employeeId && request.onlyMe) ||
			!RequestContext.hasPermission(
				PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
			)
		) {
			const employeeId = user.employeeId;
			query.andWhere(`"${query.alias}".id = :employeeId`, { employeeId });
		} else {
			if (isNotEmpty(employeeId)) {
				query.andWhere(`"${query.alias}"."id" = :employeeId`, {
					employeeId
				});
			}
		}

		// convert projectId String to Array
		let projectIds: string[] = [];
		if (typeof projectId === 'string') {
			projectIds.push(projectId);
		} else {
			projectIds = projectId;
		}

		// project filter query
		if (isNotEmpty(projectIds)) {
			query.andWhere(`"timeLogs"."projectId" IN (:...projectIds)`, {
				projectIds
			});
		}

		employees = await query
			.andWhere(`"${query.alias}"."organizationId" = :organizationId`, {
				organizationId
			})
			.andWhere(`"${query.alias}"."tenantId" = :tenantId`, { tenantId })
			.getRawMany();

		for (let index = 0; index < employees.length; index++) {
			const employee = employees[index];
			employee.user = {
				imageUrl: employee.user_image_url,
				name: employee.user_name
			};
			delete employee.user_image_url;
			delete employee.user_name;

			employee.timeSlots = await this.timeSlotRepository.find({
				join: {
					alias: 'time_slot',
					innerJoin: {
						timeLogs: 'time_slot.timeLogs'
					}
				},
				relations: ['screenshots', 'timeLogs'],
				where: (qb: SelectQueryBuilder<TimeSlot>) => {
					const employeeId = employee.id;
					qb.andWhere(`"${qb.alias}"."employeeId" = :employeeId`, {
						employeeId
					});
					qb.andWhere(
						`"${qb.alias}"."organizationId" = :organizationId`,
						{
							organizationId
						}
					);
					qb.andWhere(`"${qb.alias}"."tenantId" = :tenantId`, {
						tenantId
					});
					// project filter query
					if (isNotEmpty(projectIds)) {
						qb.andWhere(
							`"timeLogs"."projectId" IN (:...projectIds)`,
							{
								projectIds
							}
						);
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
		return _.pluck(employees, 'id');
	}
}
