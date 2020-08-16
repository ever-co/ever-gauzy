import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Between } from 'typeorm';
import * as _ from 'underscore';
import {
	PermissionsEnum,
	Employee as IEmployee,
	GetActivitiesStatistics,
	GetTimeSlotStatistics,
	GetTasksStatistics,
	GetProjectsStatistics,
	GetMembersStatistics
} from '@gauzy/models';
import { TimeSlot } from '../time-slot.entity';
import { Employee } from '../../employee/employee.entity';
import { RequestContext } from '../../core/context';
import { CrudService } from '../../core';
import { OrganizationProjects } from '../../organization-projects/organization-projects.entity';
import { Task } from '../../tasks/task.entity';
import { Activity } from '../activity.entity';
import * as moment from 'moment';
import { TimeLog } from '../time-log.entity';

@Injectable()
export class StatisticService extends CrudService<TimeSlot> {
	constructor(
		@InjectRepository(OrganizationProjects)
		private readonly organizationProjectsRepository: Repository<
			OrganizationProjects
		>,
		@InjectRepository(Task)
		private readonly taskRepository: Repository<Task>,
		@InjectRepository(TimeSlot)
		private readonly timeSlotRepository: Repository<TimeSlot>,
		@InjectRepository(Employee)
		private readonly employeeRepository: Repository<Employee>,
		@InjectRepository(Activity)
		private readonly activityRepository: Repository<Activity>,
		@InjectRepository(TimeLog)
		private readonly timeLogsRepository: Repository<TimeLog>
	) {
		super(timeSlotRepository);
	}

	async getMembers(request: GetMembersStatistics) {
		const date = request.date || new Date();
		const start = moment.utc(date).startOf('week').toDate();
		const end = moment.utc(date).endOf('week').toDate();

		const query = this.employeeRepository.createQueryBuilder();
		const employees = await query
			.select(`"${query.alias}".id`)
			.addSelect(
				`("user"."firstName" || ' ' ||  "user"."lastName")`,
				'user_name'
			)
			.addSelect(`"user"."imageUrl"`, 'user_image_url')
			.addSelect(
				`SUM(extract(epoch from ("timeLogs"."stoppedAt" - "timeLogs"."startedAt")))`,
				`duration`
			)
			.innerJoin(`${query.alias}.user`, 'user')
			.innerJoin(`${query.alias}.timeLogs`, 'timeLogs')

			.where(`"${query.alias}"."organizationId" = :organizationId`, {
				organizationId: request.organizationId
			})
			.andWhere(`"timeLogs"."startedAt" BETWEEN :start AND :end`, {
				start,
				end
			})
			.addGroupBy(`"${query.alias}"."id"`)
			.addGroupBy(`"user"."id"`)
			.orderBy('duration', 'DESC')
			.limit(5)
			.getRawMany();

		if (employees.length > 0) {
			let weekTimeSlots: any = await this.timeSlotRepository
				.createQueryBuilder()
				.select('SUM(duration)', 'duration')
				.addSelect('AVG(overall)', 'overall')
				.addSelect('"employeeId"', 'employeeId')
				.where({
					employeeId: In(_.pluck(employees, 'id')),
					startedAt: Between(start, end)
				})
				.groupBy('"employeeId"')
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

			let dayTimeSlots: any = await this.timeSlotRepository
				.createQueryBuilder()
				.select('AVG(overall)', 'overall')
				.addSelect('SUM(duration)', 'duration')
				.addSelect('"employeeId"', 'employeeId')
				.where({
					employeeId: In(_.pluck(employees, 'id')),
					startedAt: Between(
						moment().startOf('day').toDate(),
						moment().endOf('day').toDate()
					)
				})
				.groupBy('"employeeId"')
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
						`SUM(extract(epoch from ("timeLogs"."stoppedAt" - "timeLogs"."startedAt")))`,
						`duration`
					)
					.addSelect(
						'EXTRACT(DOW FROM "timeLogs"."startedAt")',
						'day'
					)
					.where({ id: member.id })
					.andWhere(
						`"timeLogs"."startedAt" BETWEEN :start AND :end`,
						{
							start,
							end
						}
					)
					.innerJoin(`${query.alias}.timeLogs`, 'timeLogs')
					.addGroupBy(`EXTRACT(DOW FROM "timeLogs"."startedAt")`)
					.getRawMany();
			}
		}

		return employees;
	}

	async getProjects(request: GetProjectsStatistics) {
		const query = this.organizationProjectsRepository.createQueryBuilder();
		const date = request.date || new Date();
		const start = moment.utc(date).startOf('week').toDate();
		const end = moment.utc(date).endOf('week').toDate();

		let projects = await query
			.select(`"${query.alias}".*`)
			.addSelect(
				`SUM(extract(epoch from ("timeLogs"."stoppedAt" - "timeLogs"."startedAt")))`,
				`duration`
			)
			.innerJoin(`${query.alias}.timeLogs`, 'timeLogs')
			.where(`"organizationId" = :organizationId`, {
				organizationId: request.organizationId
			})
			.andWhere(`"timeLogs"."startedAt" BETWEEN :start AND :end`, {
				start,
				end
			})
			.orderBy('duration', 'DESC')
			.addGroupBy(`"${query.alias}"."id"`)
			.limit(5)
			.getRawMany();

		const totalDuerationQuery = this.organizationProjectsRepository.createQueryBuilder();
		const totalDueration = await totalDuerationQuery
			.select(
				`SUM(extract(epoch from ("timeLogs"."stoppedAt" - "timeLogs"."startedAt")))`,
				`duration`
			)
			.innerJoin(`${query.alias}.timeLogs`, 'timeLogs')
			.where(`"organizationId" = :organizationId`, {
				organizationId: request.organizationId
			})
			.andWhere(`"timeLogs"."startedAt" BETWEEN :start AND :end`, {
				start,
				end
			})
			.getRawOne();

		projects = projects.map((project) => {
			project.durationPercentage =
				(project.duration * 100) / totalDueration.duration;
			return project;
		});

		return projects;
	}

	async getTasks(request: GetTasksStatistics) {
		const date = request.date || new Date();
		const start = moment.utc(date).startOf('week').toDate();
		const end = moment.utc(date).endOf('week').toDate();

		const employees = await this.employeeRepository
			.createQueryBuilder()
			.select(['id'])
			.where('"organizationId" = :organizationId', {
				organizationId: request.organizationId
			})
			.getRawMany();

		const query = this.taskRepository.createQueryBuilder();
		let tasks = await query
			.innerJoin(`${query.alias}.project`, 'project')
			.select(`"${query.alias}".*`)
			.addSelect(
				`SUM(extract(epoch from ("timeLogs"."stoppedAt" - "timeLogs"."startedAt")))`,
				`duration`
			)
			.innerJoin(`${query.alias}.timeLogs`, 'timeLogs')
			.andWhere(`"timeLogs"."employeeId" IN(:...employeeId)`, {
				employeeId: _.pluck(employees, 'id')
			})
			.andWhere(`"timeLogs"."startedAt" BETWEEN :start AND :end`, {
				start,
				end
			})
			.orderBy('duration', 'DESC')
			.addGroupBy(`"${query.alias}"."id"`)
			.limit(5)
			.getRawMany();

		const totalDuerationQuery = this.taskRepository.createQueryBuilder();
		const totalDueration = await totalDuerationQuery
			.select(
				`SUM(extract(epoch from ("timeLogs"."stoppedAt" - "timeLogs"."startedAt")))`,
				`duration`
			)
			.innerJoin(`${query.alias}.timeLogs`, 'timeLogs')
			.andWhere(`"timeLogs"."employeeId" IN(:...employeeId)`, {
				employeeId: _.pluck(employees, 'id')
			})
			.andWhere(`"timeLogs"."startedAt" BETWEEN :start AND :end`, {
				start,
				end
			})
			.getRawOne();

		tasks = tasks.map((task) => {
			task.durationPercentage =
				(task.duration * 100) / totalDueration.duration;
			return task;
		});

		return tasks;
	}

	async getActivites(request: GetActivitiesStatistics) {
		const date = request.date || new Date();
		const start = moment.utc(date).startOf('week').toDate();
		const end = moment.utc(date).endOf('week').toDate();

		const employees = await this.employeeRepository
			.createQueryBuilder()
			.select(['id'])
			.where('"organizationId" = :organizationId', {
				organizationId: request.organizationId
			})
			.getRawMany();

		const query = this.activityRepository.createQueryBuilder();

		query
			.select(`COUNT("${query.alias}"."id")`, `sessions`)
			.addSelect(`SUM("${query.alias}"."duration")`, `duration`)
			.addSelect(`"${query.alias}"."title"`, `title`)
			.addGroupBy(`"${query.alias}"."title"`)
			.andWhere(`"${query.alias}"."date" BETWEEN :start AND :end`, {
				start,
				end
			})
			.andWhere(`"${query.alias}"."employeeId" IN(:...employeeId)`, {
				employeeId: _.pluck(employees, 'id')
			})
			.orderBy(`"duration"`, 'DESC')
			.limit(5);

		let activites = await query.getRawMany();

		const totalDuerationQuery = this.activityRepository.createQueryBuilder();
		const totalDueration = await totalDuerationQuery
			.select(
				`SUM("${totalDuerationQuery.alias}"."duration")`,
				`duration`
			)
			.andWhere(
				`"${totalDuerationQuery.alias}"."employeeId" IN(:...employeeId)`,
				{
					employeeId: _.pluck(employees, 'id')
				}
			)
			.andWhere(`"${query.alias}"."date" BETWEEN :start AND :end`, {
				start,
				end
			})
			.getRawOne();

		activites = activites.map((activity) => {
			activity.durationPercentage =
				(activity.duration * 100) / totalDueration.duration;
			return activity;
		});

		return activites;
	}

	async getEmployeeTimeSlots(request: GetTimeSlotStatistics) {
		let employees: Employee[] = [];

		const date = request.date || new Date();
		const start = moment.utc(date).startOf('week').toDate();
		const end = moment.utc(date).endOf('week').toDate();

		if (
			RequestContext.hasPermission(
				PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
			)
		) {
			const query = this.employeeRepository.createQueryBuilder();
			employees = await query
				.select(`"${query.alias}".*`)
				.addSelect('timeLogs.startedAt')
				.addSelect(
					`("user"."firstName" || ' ' || "user"."lastName")`,
					'name'
				)
				.innerJoin(`${query.alias}.timeLogs`, 'timeLogs')
				.innerJoin(`${query.alias}.user`, 'user')
				.andWhere(`"timeLogs"."startedAt" BETWEEN :start AND :end`, {
					start,
					end
				})
				.orderBy('timeLogs.startedAt', 'DESC')
				.limit(3)
				.getRawMany();

			for (let index = 0; index < employees.length; index++) {
				const employee: IEmployee = employees[index];
				employee.timeSlots = await this.timeSlotRepository.find({
					where: {
						employeeId: employee.id
					},
					take: 3,
					order: {
						createdAt: 'DESC'
					}
				});
			}
			return employees;
		} else {
			const user = RequestContext.currentUser();
			employees = await this.employeeRepository.find({
				id: user.employeeId
			});
			return employees;
		}
	}
}
