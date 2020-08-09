import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
		private readonly activityRepository: Repository<Activity>
	) {
		super(timeSlotRepository);
	}

	async getMembers(request: GetMembersStatistics) {
		const query = this.employeeRepository.createQueryBuilder();
		const members = await query
			.where('"organizationId" = :organizationId', {
				organizationId: request.organizationId
			})
			.select(`"${query.alias}".id`)
			.addSelect(`("user"."firstName" || "user"."lastName")`, 'name')
			.addSelect(
				`SUM(extract(epoch from ("timeLogs"."stoppedAt" - "timeLogs"."startedAt")))`,
				`duration`
			)
			.innerJoin(`${query.alias}.user`, 'user')
			.innerJoin(`${query.alias}.timeLogs`, 'timeLogs')
			.addGroupBy(`"${query.alias}"."id"`)
			.addGroupBy(`"user"."id"`)
			.limit(5)
			.getRawMany();

		return members;
	}

	async getProjects(request: GetProjectsStatistics) {
		const query = this.organizationProjectsRepository.createQueryBuilder();

		const projects = await query
			.select(`"${query.alias}".*`)
			.addSelect(
				`SUM(extract(epoch from ("timeLogs"."stoppedAt" - "timeLogs"."startedAt")))`,
				`duration`
			)
			.innerJoin(`${query.alias}.timeLogs`, 'timeLogs')
			.where(`"organizationId" = :organizationId`, {
				organizationId: request.organizationId
			})
			.orderBy('duration', 'DESC')
			.addGroupBy(`"${query.alias}"."id"`)
			.limit(5)
			.getRawMany();

		return projects;
	}

	async getTasks(request: GetTasksStatistics) {
		const query = this.taskRepository.createQueryBuilder();
		const task = await query
			.innerJoin(`${query.alias}.project`, 'project')
			.select(`"${query.alias}".*`)
			.addSelect(
				`SUM(extract(epoch from ("timeLogs"."stoppedAt" - "timeLogs"."startedAt")))`,
				`duration`
			)
			.innerJoin(`${query.alias}.timeLogs`, 'timeLogs')
			.where('"organizationId" = :organizationId', {
				organizationId: request.organizationId
			})
			.orderBy('duration', 'DESC')
			.addGroupBy(`"${query.alias}"."id"`)
			.limit(5)
			.getRawMany();

		return task;
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

		const activites = await query.getRawMany();

		// for (let index = 0; index < activites.length; index++) {
		//   const activity = activites[index];
		//   const totalDurationQuery = this.activityRepository.createQueryBuilder();
		//   totalDurationQuery.select(`SUM("${totalDurationQuery.alias}"."duration")`, `duration`)
		//   totalDurationQuery.andWhere(`"${totalDurationQuery.alias}"."date" BETWEEN :start AND :end`, { start, end });
		//   totalDurationQuery.groupBy(`${totalDurationQuery.alias}."employeeId"`)

		//   const totalDuration = await query.getRawOne();

		//   console.log({totalDuration});
		//   const titleDurationQuery = totalDurationQuery.clone()
		//   titleDurationQuery
		//     .andWhere(`${totalDurationQuery.alias}.title = :title`, { title: activity.title })
		//     .addSelect((sq) => {
		//       titleDurationQuery.andWhere(`${sq.alias}.title`)
		//       return titleDurationQuery;
		//     })
		//   const titleDuration = await titleDurationQuery.getRawOne();
		//   activity.percentage = (titleDuration * 100) / totalDuration;
		// }

		return activites;
	}

	async getEmployeeTimeSlots(request: GetTimeSlotStatistics) {
		let employees: Employee[] = [];
		if (
			RequestContext.hasPermission(
				PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
			)
		) {
			const query = this.employeeRepository.createQueryBuilder();
			employees = await query
				.innerJoin(`${query.alias}.timeLogs`, 'timeLogs')
				.addSelect('timeLogs.startedAt')
				.orderBy('timeLogs.startedAt', 'DESC')
				.limit(3)
				.getMany();

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
