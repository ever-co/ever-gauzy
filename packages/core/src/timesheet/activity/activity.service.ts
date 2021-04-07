import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CrudService } from '../../core/crud/crud.service';
import { Activity } from './activity.entity';
import * as moment from 'moment';
import { RequestContext } from '../../core/context';
import {
	PermissionsEnum,
	IGetActivitiesInput,
	IDailyActivity,
	IBulkActivitiesInput
} from '@gauzy/contracts';
import { CommandBus } from '@nestjs/cqrs';
import { BulkActivitiesSaveCommand } from './commands/bulk-activities-save.command';
import { Employee } from '../../employee/employee.entity';
import { OrganizationProject } from '../../organization-projects/organization-projects.entity';
import { indexBy, pluck } from 'underscore';
import { getConfig } from '@gauzy/config';
const config = getConfig();

@Injectable()
export class ActivityService extends CrudService<Activity> {
	constructor(
		@InjectRepository(Activity)
		private readonly activityRepository: Repository<Activity>,
		@InjectRepository(Employee)
		private readonly employeeRepository: Repository<Employee>,
		@InjectRepository(OrganizationProject)
		private readonly organizationProjectRepository: Repository<OrganizationProject>,
		private readonly commandBus: CommandBus
	) {
		super(activityRepository);
	}

	async getDailyActivities(
		request: IGetActivitiesInput
	): Promise<IDailyActivity[]> {
		const query = this.filterQuery(request);
		query.select(`COUNT("${query.alias}"."id")`, `sessions`);
		query.addSelect(`SUM("${query.alias}"."duration")`, `duration`);
		query.addSelect(`"${query.alias}"."employeeId"`, `employeeId`);
		query.addSelect(`"${query.alias}"."date"`, `date`);
		if (config.dbConnectionOptions.type === 'sqlite') {
			query.addSelect(`time("${query.alias}"."time")`, `time`);
		} else {
			query.addSelect(
				`(to_char("${query.alias}"."time", 'HH24') || ':00')::time`,
				`time`
			);
		}
		query.addSelect(`"${query.alias}"."title"`, `title`);
		query.addGroupBy(`"${query.alias}"."date"`);

		if (config.dbConnectionOptions.type === 'sqlite') {
			query.addGroupBy(`time("${query.alias}"."time")`);
		} else {
			query.addGroupBy(
				`(to_char("${query.alias}"."time", 'HH24') || ':00')::time`
			);
		}

		query.addGroupBy(`"${query.alias}"."title"`);
		query.addGroupBy(`"${query.alias}"."employeeId"`);

		query.orderBy(`time`, 'ASC');
		query.addOrderBy(`"duration"`, 'DESC');

		return query.getRawMany();
	}

	async getDailyActivitiesReport(
		request: IGetActivitiesInput
	): Promise<Activity[]> {
		const query = this.filterQuery(request);

		query.select(`COUNT("${query.alias}"."id")`, `sessions`);
		query.addSelect(`SUM("${query.alias}"."duration")`, `duration`);
		query.addSelect(`"${query.alias}"."employeeId"`, `employeeId`);
		query.addSelect(`"${query.alias}"."projectId"`, `projectId`);
		query.addSelect(`"${query.alias}"."date"`, `date`);
		query.addSelect(`"${query.alias}"."title"`, `title`);
		query.addGroupBy(`"${query.alias}"."date"`);
		query.addGroupBy(`"${query.alias}"."title"`);
		query.addGroupBy(`"${query.alias}"."employeeId"`);
		query.addGroupBy(`"${query.alias}"."projectId"`);
		query.orderBy(`"duration"`, 'DESC');

		query.limit(200);
		let activitiesData = await query.getRawMany();

		console.log(query.getQuery());

		const projectIds = pluck(activitiesData, 'projectId');
		const employeeIds = pluck(activitiesData, 'employeeId');

		let employeeById: any = {};
		if (employeeIds.length > 0) {
			const employees = await this.employeeRepository.find({
				where: {
					id: In(employeeIds)
				},
				relations: ['user']
			});
			employeeById = indexBy(employees, 'id');
		}

		let projectById: any = {};
		if (projectIds.length > 0) {
			const projects = await this.organizationProjectRepository.find({
				where: {
					id: In(projectIds)
				}
			});
			projectById = indexBy(projects, 'id');
		}

		activitiesData = activitiesData.map((activity) => {
			activity.employee = employeeById[activity.employeeId];
			activity.project = projectById[activity.projectId];
			return activity;
		});

		return activitiesData;
	}

	async getAllActivities(request: IGetActivitiesInput) {
		const query = this.filterQuery(request);

		return await query.getMany();
	}

	async getActivities(request: IGetActivitiesInput) {
		const query = this.filterQuery(request);
		if (
			RequestContext.hasPermission(
				PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
			)
		) {
			query.leftJoinAndSelect(
				`${query.alias}.employee`,
				'activityEmployee'
			);
			query.leftJoinAndSelect(
				`activityEmployee.user`,
				'activityUser',
				'"employee"."userId" = activityUser.id'
			);
		}

		query.orderBy(`${query.alias}.duration`, 'DESC');

		return await query.getMany();
	}

	bulkSave(input: IBulkActivitiesInput) {
		return this.commandBus.execute(new BulkActivitiesSaveCommand(input));
	}

	private filterQuery(request: IGetActivitiesInput) {
		let employeeIds: string[];

		const query = this.activityRepository.createQueryBuilder();
		if (request.limit > 0) {
			query.take(request.limit);
			query.skip((request.page || 0) * request.limit);
		}
		if (
			RequestContext.hasPermission(
				PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
			)
		) {
			if (request.employeeIds) {
				employeeIds = request.employeeIds;
			}
		} else {
			const user = RequestContext.currentUser();
			employeeIds = [user.employeeId];
		}

		query.innerJoin(`${query.alias}.employee`, 'employee');
		query.where((qb) => {
			if (request.startDate && request.endDate) {
				let startDate: any = moment.utc(request.startDate);
				let endDate: any = moment.utc(request.endDate);

				if (config.dbConnectionOptions.type === 'sqlite') {
					startDate = startDate.format('YYYY-MM-DD HH:mm:ss');
					endDate = endDate.format('YYYY-MM-DD HH:mm:ss');
				} else {
					startDate = startDate.toDate();
					endDate = endDate.toDate();
				}

				if (config.dbConnectionOptions.type === 'sqlite') {
					qb.andWhere(
						`datetime("${query.alias}"."date" || ' ' || "${query.alias}"."time") Between :startDate AND :endDate`,
						{ startDate, endDate }
					);
				} else {
					qb.andWhere(
						`concat("${query.alias}"."date", ' ', "${query.alias}"."time")::timestamp Between :startDate AND :endDate`,
						{ startDate, endDate }
					);
				}
			}
			if (employeeIds) {
				qb.andWhere(
					`"${query.alias}"."employeeId" IN (:...employeeId)`,
					{
						employeeId: employeeIds
					}
				);
			}
			if (request.projectIds) {
				qb.andWhere(`"${query.alias}"."projectId" IN (:...projectId)`, {
					projectId: request.projectIds
				});
			}
			if (request.titles) {
				qb.andWhere(`"${query.alias}"."title" IN (:...title)`, {
					title: request.titles
				});
			}
			if (request.organizationId) {
				qb.andWhere(
					`"${query.alias}"."organizationId" = :organizationId`,
					{
						organizationId: request.organizationId
					}
				);
			}

			qb.andWhere(`"${query.alias}"."tenantId" = :tenantId`, {
				tenantId: RequestContext.currentTenantId()
			});

			if (request.activityLevel) {
				qb.andWhere(
					`"${query.alias}"."duration" BETWEEN :start AND :end`,
					request.activityLevel
				);
			}
			if (request.source) {
				if (request.source instanceof Array) {
					qb.andWhere(`"${query.alias}"."source" IN (:...source)`, {
						source: request.source
					});
				} else {
					qb.andWhere(`"${query.alias}"."source" = :source`, {
						source: request.source
					});
				}
			}
			if (request.logType) {
				if (request.logType instanceof Array) {
					qb.andWhere(`"${query.alias}"."logType" IN (:...logType)`, {
						logType: request.logType
					});
				} else {
					qb.andWhere(`"${query.alias}"."logType" = :logType`, {
						logType: request.logType
					});
				}
			}
			if (request.types) {
				qb.andWhere(`"${query.alias}"."type" IN (:...type)`, {
					type: request.types
				});
			}
		});

		return query;
	}
}
