import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository, WhereExpressionBuilder } from 'typeorm';
import { TenantAwareCrudService } from './../../core/crud';
import { Activity } from './activity.entity';
import { RequestContext } from '../../core/context';
import {
	PermissionsEnum,
	IGetActivitiesInput,
	IDailyActivity,
	IBulkActivitiesInput
} from '@gauzy/contracts';
import { CommandBus } from '@nestjs/cqrs';
import { BulkActivitiesSaveCommand } from './commands/bulk-activities-save.command';
import { indexBy, pluck } from 'underscore';
import { isNotEmpty } from '@gauzy/common';
import { getConfig } from '@gauzy/config';
import { Employee, OrganizationProject } from './../../core/entities/internal';
const config = getConfig();

@Injectable()
export class ActivityService extends TenantAwareCrudService<Activity> {
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

	async bulkSave(input: IBulkActivitiesInput) {
		return await this.commandBus.execute(
			new BulkActivitiesSaveCommand(input)
		);
	}

	private filterQuery(request: IGetActivitiesInput) {
		const { organizationId } = request;
		const tenantId = RequestContext.currentTenantId();

		const query = this.activityRepository.createQueryBuilder();
		if (request.limit > 0) {
			query.take(request.limit);
			query.skip((request.page || 0) * request.limit);
		}

		let employeeIds: string[];
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
		query.innerJoin(`${query.alias}.timeSlot`, 'timeSlot');
		query.innerJoin(`timeSlot.timeLogs`, 'timeLogs');
		query.andWhere(
			new Brackets((qb: WhereExpressionBuilder) => {
				qb.andWhere(`"${query.alias}"."tenantId" = :tenantId`, { tenantId });
				qb.andWhere(`"${query.alias}"."organizationId" = :organizationId`, { organizationId });
			})
		);
		query.andWhere(
			new Brackets((qb: WhereExpressionBuilder) => {
				const { titles, types } = request;
				if (isNotEmpty(types)) {
					qb.andWhere(`"${query.alias}"."type" IN (:...types)`, {
						types
					});
				}
				if (isNotEmpty(titles)) {
					qb.andWhere(`"${query.alias}"."title" IN (:...titles)`, {
						titles
					});
				}
			})
		);
		query.andWhere(
			new Brackets((qb: WhereExpressionBuilder) => {
				const { startDate, endDate } = request;
				if (config.dbConnectionOptions.type === 'sqlite') {
					qb.andWhere(`datetime("${query.alias}"."date" || ' ' || "${query.alias}"."time") Between :startDate AND :endDate`, {
						startDate,
						endDate
					});
				} else {
					qb.andWhere(`concat("${query.alias}"."date", ' ', "${query.alias}"."time")::timestamp Between :startDate AND :endDate`, {
						startDate,
						endDate
					});
				}
			})
		);
		query.andWhere(
			new Brackets((qb: WhereExpressionBuilder) => {
				const { projectIds = [] } = request;
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
		query.andWhere(
			new Brackets((qb: WhereExpressionBuilder) => {
				const { activityLevel, source, logType } = request;
				if (isNotEmpty(activityLevel)) {
					/**
					 * Activity Level should be 0-100%
					 * So, we have convert it into 10 minutes timeslot by multiply by 6
					 */
					const start = (activityLevel.start * 6);
					const end = (activityLevel.end * 6);
	
					qb.andWhere(`"timeSlot"."overall" BETWEEN :start AND :end`, {
						start,
						end
					});
				}
				if (isNotEmpty(source)) {
					if (source instanceof Array) {
						qb.andWhere(`"timeLogs"."source" IN (:...source)`, {
							source
						});
					} else {
						qb.andWhere(`"timeLogs"."source" = :source`, {
							source
						});
					}
				}
				if (isNotEmpty(logType)) {
					if (logType instanceof Array) {
						qb.andWhere(`"timeLogs"."logType" IN (:...logType)`, {
							logType
						});
					} else {
						qb.andWhere(`"timeLogs"."logType" = :logType`, {
							logType
						});
					}
				}
			})
		);
		return query;
	}
}
