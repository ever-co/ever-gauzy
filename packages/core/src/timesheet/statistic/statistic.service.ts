import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Between } from 'typeorm';
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
import { TimeSlot } from '../time-slot.entity';
import { Employee } from '../../employee/employee.entity';
import { RequestContext } from '../../core/context';
import { OrganizationProject } from '../../organization-projects/organization-projects.entity';
import { Task } from '../../tasks/task.entity';
import { Activity } from './../activity/activity.entity';
import * as moment from 'moment';
import { TimeLog } from '../time-log.entity';
import { isNotEmpty } from '@gauzy/common';
import { ConfigService, getConfig } from '@gauzy/config';
const config = getConfig();

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
			date = new Date()
		} = request;

		let start: any;
		let end: any;

		if (startDate && endDate) {
			start = moment.utc(startDate);
			end = moment.utc(endDate);
		} else {
			start = moment.utc(date).startOf('week');
			end = moment.utc(date).endOf('week');
		}

		if (this.configService.dbConnectionOptions.type === 'sqlite') {
			start = start.format('YYYY-MM-DD HH:mm:ss');
			end = end.format('YYYY-MM-DD HH:mm:ss');
		} else {
			start = start.toDate();
			end = end.toDate();
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

		/*
		 *  Get employees count who worked in this week.
		 */
		const employeesCountQuery = this.employeeRepository.createQueryBuilder();
		employeesCountQuery.innerJoin(
			`${employeesCountQuery.alias}.timeLogs`,
			'timeLogs'
		);
		employeesCountQuery.innerJoin(`timeLogs.timeSlots`, 'timeSlots');

		if (employeeIds.length) {
			employeesCountQuery
				.where({
					id: In(employeeIds)
				})
				.andWhere(`"timeLogs"."startedAt" BETWEEN :start AND :end`, {
					start,
					end
				});
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
		projectsCountQuery.innerJoin(
			`${projectsCountQuery.alias}.timeLogs`,
			'timeLogs'
		);
		projectsCountQuery.innerJoin(`timeLogs.timeSlots`, 'timeSlots');

		if (employeeIds.length) {
			projectsCountQuery
				.where(`"timeLogs"."employeeId" IN (:...employeeId)`, {
					employeeId: employeeIds
				})
				.andWhere(`"timeLogs"."startedAt" BETWEEN :start AND :end`, {
					start,
					end
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
				.innerJoin(`${query.alias}.timeLogs`, 'timeLogs')
				.select(`AVG(${query.alias}.overall)`, 'overall')
				.addSelect(`SUM(${query.alias}.duration)`, 'duration')
				.where({
					employeeId: In(employeeIds),
					tenantId,
					organizationId
				})
				.andWhere(
					`"${query.alias}"."startedAt" >= :start AND "${query.alias}"."startedAt" < :end`,
					{ start, end }
				);
			weekActivities = await query.getRawOne();
		}

		/*
		 * Get average activity and total duration of the work for today.
		 */
		let todayActivities = {
			overall: 0,
			duration: 0
		};

		if (employeeIds.length > 0) {
			start = moment
				.utc(date)
				.startOf('day')
				.format('YYYY-MM-DD HH:mm:ss');
			end = moment.utc(date).endOf('day').format('YYYY-MM-DD HH:mm:ss');

			const query = this.timeSlotRepository.createQueryBuilder(
				'time_slot'
			);
			query
				.innerJoin(`${query.alias}.timeLogs`, 'timeLogs')
				.select(`AVG(${query.alias}.overall)`, 'overall')
				.addSelect(`SUM(${query.alias}.duration)`, 'duration')
				.where({
					employeeId: In(employeeIds),
					tenantId,
					organizationId
				})
				.andWhere(
					`"${query.alias}"."startedAt" >= :start AND "${query.alias}"."startedAt" < :end`,
					{ start, end }
				);
			todayActivities = await query.getRawOne();
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

	async getMembers(request: IGetMembersStatistics) {
		const { employeeId, organizationId } = request;
		const date = request.date || new Date();
		const start = moment(date)
			.utc()
			.startOf('week')
			.format('YYYY-MM-DD HH:mm:ss');
		const end = moment(date)
			.utc()
			.endOf('week')
			.format('YYYY-MM-DD HH:mm:ss');

		const tenantId = RequestContext.currentTenantId();
		const user = RequestContext.currentUser();

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
					config.dbConnectionOptions.type === 'sqlite'
						? 'SUM((julianday("timeLogs"."stoppedAt") - julianday("timeLogs"."startedAt")) * 86400)'
						: 'SUM(extract(epoch from ("timeLogs"."stoppedAt" - "timeLogs"."startedAt")))'
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
			let weekTimeSlots: any = await weekTimeQuery
				.innerJoin(`${weekTimeQuery.alias}.timeLogs`, 'timeLogs')
				.select(`SUM("${weekTimeQuery.alias}"."duration")`, `duration`)
				.addSelect(`AVG("${weekTimeQuery.alias}"."overall")`, `overall`)
				.addSelect(`${weekTimeQuery.alias}.employeeId`, 'employeeId')
				.andWhere(
					`"${weekTimeQuery.alias}"."employeeId" IN(:...employeeIds)`,
					{
						employeeIds
					}
				)
				.andWhere(
					`"${weekTimeQuery.alias}"."startedAt" BETWEEN :start AND :end`,
					{
						start,
						end
					}
				)
				.andWhere(
					`"${weekTimeQuery.alias}"."organizationId" = :organizationId`,
					{ organizationId }
				)
				.andWhere(`"${weekTimeQuery.alias}"."tenantId" = :tenantId`, {
					tenantId
				})
				.groupBy(`${weekTimeQuery.alias}.employeeId`)
				.getRawMany();

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
			let dayTimeSlots: any = await dayTimeQuery
				.innerJoin(`${dayTimeQuery.alias}.timeLogs`, 'timeLogs')
				.select(`SUM("${dayTimeQuery.alias}"."duration")`, `duration`)
				.addSelect(`AVG("${dayTimeQuery.alias}"."overall")`, `overall`)
				.addSelect(`${dayTimeQuery.alias}.employeeId`, 'employeeId')
				.andWhere(
					`"${dayTimeQuery.alias}"."employeeId" IN(:...employeeIds)`,
					{
						employeeIds
					}
				)
				.andWhere(
					`"${dayTimeQuery.alias}"."startedAt" BETWEEN :start AND :end`,
					{
						start: moment().utc().startOf('day').format(),
						end: moment().utc().endOf('day').format()
					}
				)
				.andWhere(
					`"${dayTimeQuery.alias}"."organizationId" = :organizationId`,
					{ organizationId }
				)
				.andWhere(`"${dayTimeQuery.alias}"."tenantId" = :tenantId`, {
					tenantId
				})
				.groupBy(`${dayTimeQuery.alias}.employeeId`)
				.getRawMany();

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
				member.weekHours = await weekHoursQuery
					.select(
						`${
							config.dbConnectionOptions.type === 'sqlite'
								? 'SUM((julianday("timeLogs"."stoppedAt") - julianday("timeLogs"."startedAt")) * 86400)'
								: 'SUM(extract(epoch from ("timeLogs"."stoppedAt" - "timeLogs"."startedAt")))'
						}`,
						`duration`
					)
					.addSelect(
						`${
							config.dbConnectionOptions.type === 'sqlite'
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
					)
					.innerJoin(`${weekHoursQuery.alias}.timeLogs`, 'timeLogs')
					.innerJoin(`timeLogs.timeSlots`, 'timeSlots')
					.addGroupBy(
						`${
							config.dbConnectionOptions.type === 'sqlite'
								? `(strftime('%w', timeLogs.startedAt))`
								: 'EXTRACT(DOW FROM "timeLogs"."startedAt")'
						}`
					)
					.getRawMany();
			}
		}

		return employees;
	}

	async getProjects(request: IGetProjectsStatistics) {
		const query = this.organizationProjectsRepository.createQueryBuilder();
		const date = request.date || new Date();
		const start = moment.utc(date).startOf('week').format();
		const end = moment.utc(date).endOf('week').format();
		const user = RequestContext.currentUser();
		const tenantId = user.tenantId;

		query
			.select(`"${query.alias}".*`)
			.addSelect(
				`${
					config.dbConnectionOptions.type === 'sqlite'
						? 'SUM((julianday("timeLogs"."stoppedAt") - julianday("timeLogs"."startedAt")) * 86400)'
						: 'SUM(extract(epoch from ("timeLogs"."stoppedAt" - "timeLogs"."startedAt")))'
				}`,
				`duration`
			)
			.innerJoin(`${query.alias}.timeLogs`, 'timeLogs')
			.innerJoin(`timeLogs.timeSlots`, 'timeSlots');

		if (
			(user.employeeId && request.onlyMe) ||
			!RequestContext.hasPermission(
				PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
			)
		) {
			const employeeId = user.employeeId;
			query.leftJoin(`${query.alias}.members`, 'members');
			query.where(`members.id = :employeeId`, { employeeId });
		} else {
			query.where(`"${query.alias}"."organizationId" = :organizationId`, {
				organizationId: request.organizationId
			});
		}

		query
			.andWhere(`"timeLogs"."startedAt" BETWEEN :start AND :end`, {
				start,
				end
			})
			.andWhere(`"${query.alias}"."tenantId" = :tenantId`, {
				tenantId
			})
			.orderBy('duration', 'DESC')
			.addGroupBy(`"${query.alias}"."id"`)
			.limit(5);

		let projects: IProjectsStatistics[] = await query.getRawMany();

		const totalDurationQuery = this.organizationProjectsRepository.createQueryBuilder();
		totalDurationQuery
			.select(
				`${
					config.dbConnectionOptions.type === 'sqlite'
						? 'SUM((julianday("timeLogs"."stoppedAt") - julianday("timeLogs"."startedAt")) * 86400)'
						: 'SUM(extract(epoch from ("timeLogs"."stoppedAt" - "timeLogs"."startedAt")))'
				}`,
				`duration`
			)
			.innerJoin(`${query.alias}.timeLogs`, 'timeLogs')
			.innerJoin(`timeLogs.timeSlots`, 'timeSlots')
			.where(
				`"${totalDurationQuery.alias}"."organizationId" = :organizationId`,
				{
					organizationId: request.organizationId
				}
			)
			.andWhere(`"${query.alias}"."tenantId" = :tenantId`, {
				tenantId
			});

		if (
			(user.employeeId && request.onlyMe) ||
			!RequestContext.hasPermission(
				PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
			)
		) {
			const employeeId = user.employeeId;
			totalDurationQuery.leftJoin(
				`${totalDurationQuery.alias}.members`,
				'members'
			);
			totalDurationQuery.where(`members.id = :employeeId`, {
				employeeId
			});
		} else {
			totalDurationQuery.where(
				`"${totalDurationQuery.alias}"."organizationId" = :organizationId`,
				{
					organizationId: request.organizationId
				}
			);
		}

		totalDurationQuery.andWhere(
			`"timeLogs"."startedAt" BETWEEN :start AND :end`,
			{
				start,
				end
			}
		);
		const totalDuration = await totalDurationQuery.getRawOne();

		projects = projects.map((project) => {
			project.durationPercentage =
				(project.duration * 100) / totalDuration.duration;
			return project;
		});

		return projects;
	}

	async getTasks(request: IGetTasksStatistics) {
		const date = request.date || new Date();
		const start = moment.utc(date).startOf('week').format();
		const end = moment.utc(date).endOf('week').format();
		const user = RequestContext.currentUser();
		const tenantId = user.tenantId;
		const { employeeId, organizationId } = request;
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

		if (employeeIds.length > 0) {
			const query = this.taskRepository.createQueryBuilder();
			let tasks = await query
				.innerJoin(`${query.alias}.project`, 'project')
				.select(`"${query.alias}".*`)
				.addSelect(
					`${
						config.dbConnectionOptions.type === 'sqlite'
							? 'SUM((julianday("timeLogs"."stoppedAt") - julianday("timeLogs"."startedAt")) * 86400)'
							: 'SUM(extract(epoch from ("timeLogs"."stoppedAt" - "timeLogs"."startedAt")))'
					}`,
					`duration`
				)
				.innerJoin(`${query.alias}.timeLogs`, 'timeLogs')
				.innerJoin(`timeLogs.timeSlots`, 'timeSlots')
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
				.orderBy('duration', 'DESC')
				.addGroupBy(`"${query.alias}"."id"`)
				.limit(5)
				.getRawMany();

			const totalDurationQuery = this.taskRepository.createQueryBuilder();
			const totalDuration = await totalDurationQuery
				.select(
					`${
						config.dbConnectionOptions.type === 'sqlite'
							? 'SUM((julianday("timeLogs"."stoppedAt") - julianday("timeLogs"."startedAt")) * 86400)'
							: 'SUM(extract(epoch from ("timeLogs"."stoppedAt" - "timeLogs"."startedAt")))'
					}`,
					`duration`
				)
				.innerJoin(`${totalDurationQuery.alias}.timeLogs`, 'timeLogs')
				.innerJoin(`timeLogs.timeSlots`, 'timeSlots')
				.andWhere(`"timeLogs"."employeeId" IN(:...employeeId)`, {
					employeeId: employeeIds
				})
				.andWhere(`"timeLogs"."startedAt" BETWEEN :start AND :end`, {
					start,
					end
				})
				.getRawOne();
			tasks = tasks.map((task) => {
				task.durationPercentage =
					(task.duration * 100) / totalDuration.duration;
				return task;
			});

			return tasks;
		} else {
			return [];
		}
	}

	async manualTimes(request: IGetManualTimesStatistics) {
		const date = request.date || new Date();
		const start = moment.utc(date).startOf('week').format();
		const end = moment.utc(date).endOf('week').format();
		const user = RequestContext.currentUser();
		const tenantId = user.tenantId;
		const { employeeId, organizationId } = request;

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
				where: {
					employeeId: In(employeeIds),
					logType: TimeLogType.MANUAL,
					startedAt: Between(start, end),
					tenantId
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
						project: _.pick(timeLog.employee.user, ['name'])
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
		const start = moment.utc(date).startOf('week').format();
		const end = moment.utc(date).endOf('week').format();
		const user = RequestContext.currentUser();
		const tenantId = user.tenantId;
		const { employeeId, organizationId } = request;

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

		if (employeeIds.length > 0) {
			const query = this.activityRepository.createQueryBuilder();
			query
				.innerJoin(`${query.alias}.timeSlot`, 'timeSlot')
				.innerJoin(`timeSlot.timeLogs`, 'timeLogs')
				.select(`COUNT("${query.alias}"."id")`, `sessions`)
				.addSelect(`SUM("${query.alias}"."duration")`, `duration`)
				.addSelect(`"${query.alias}"."title"`, `title`)
				.addGroupBy(`"${query.alias}"."title"`)
				.andWhere(`"${query.alias}"."date" BETWEEN :start AND :end`, {
					start,
					end
				})
				.andWhere(`"${query.alias}"."employeeId" IN(:...employeeId)`, {
					employeeId: employeeIds
				})
				.andWhere(`"${query.alias}"."tenantId" = :tenantId`, {
					tenantId
				})
				.orderBy(`"duration"`, 'DESC')
				.limit(5);

			let activities: IActivitiesStatistics[] = await query.getRawMany();

			/*
			 * Fetch total duration of the week for calculate duration percentage
			 */
			const totalDurationQuery = this.activityRepository.createQueryBuilder();
			const totalDuration = await totalDurationQuery
				.innerJoin(`${totalDurationQuery.alias}.timeSlot`, 'timeSlot')
				.innerJoin(`timeSlot.timeLogs`, 'timeLogs')
				.select(
					`SUM("${totalDurationQuery.alias}"."duration")`,
					`duration`
				)
				.andWhere(
					`"${totalDurationQuery.alias}"."employeeId" IN(:...employeeId)`,
					{
						employeeId: employeeIds
					}
				)
				.andWhere(`"${query.alias}"."date" BETWEEN :start AND :end`, {
					start,
					end
				})
				.andWhere(`"${query.alias}"."tenantId" = :tenantId`, {
					tenantId
				})
				.getRawOne();

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
		const start = moment.utc(date).startOf('week').format();
		const end = moment.utc(date).endOf('week').format();
		const user = RequestContext.currentUser();
		const tenantId = user.tenantId;
		const { employeeId, organizationId } = request;

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
			.innerJoin(`timeLogs.timeSlots`, 'timeSlots')
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
			} else {
				query.andWhere(
					`"${query.alias}"."organizationId" = :organizationId`,
					{ organizationId }
				);
			}
		}

		employees = await query
			.andWhere(`"${query.alias}"."tenantId" = :tenantId`, {
				tenantId
			})
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
				where: {
					employeeId: employee.id,
					organizationId,
					tenantId
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
