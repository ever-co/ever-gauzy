import { Injectable } from '@nestjs/common';
import { Brackets, In, SelectQueryBuilder, WhereExpressionBuilder } from 'typeorm';
import { TenantAwareCrudService } from './../../core/crud';
import { MultiORMEnum } from './../../core/utils';
import { Activity } from './activity.entity';
import { RequestContext } from '../../core/context';
import {
	PermissionsEnum,
	IGetActivitiesInput,
	IDailyActivity,
	IBulkActivitiesInput,
	IActivity
} from '@gauzy/contracts';
import { CommandBus } from '@nestjs/cqrs';
import { BulkActivitiesSaveCommand } from './commands/bulk-activities-save.command';
import { indexBy, pluck } from 'underscore';
import { isNotEmpty } from '@gauzy/utils';
import { DatabaseTypeEnum, getConfig, isSqlite, isBetterSqlite3, isMySQL, isPostgres } from '@gauzy/config';
import { prepareSQLQuery as p } from './../../database/database.helper';
import { TypeOrmActivityRepository } from './repository/type-orm-activity.repository';
import { MikroOrmActivityRepository } from './repository/mikro-orm-activity.repository';
import { TypeOrmEmployeeRepository } from '../../employee/repository/type-orm-employee.repository';
import { TypeOrmOrganizationProjectRepository } from '../../organization-project/repository/type-orm-organization-project.repository';

const config = getConfig();

@Injectable()
export class ActivityService extends TenantAwareCrudService<Activity> {
	constructor(
		typeOrmActivityRepository: TypeOrmActivityRepository,
		mikroOrmActivityRepository: MikroOrmActivityRepository,
		readonly typeOrmEmployeeRepository: TypeOrmEmployeeRepository,
		readonly typeOrmOrganizationProjectRepository: TypeOrmOrganizationProjectRepository,
		readonly commandBus: CommandBus
	) {
		super(typeOrmActivityRepository, mikroOrmActivityRepository);
	}

	async getDailyActivities(request: IGetActivitiesInput): Promise<IDailyActivity[]> {
		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				// MikroORM: Use Knex raw query for SQL aggregation (COUNT, SUM, GROUP BY)
				const knex = (this.mikroOrmRepository as any).getKnex();
				const { organizationId, startDate, endDate } = request;
				const tenantId = RequestContext.currentTenantId();

				let employeeIds: string[];
				if (RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
					if (request.employeeIds) {
						employeeIds = request.employeeIds;
					}
				} else {
					const user = RequestContext.currentUser();
					employeeIds = [user.employeeId];
				}

				let qb = knex('activity')
					.innerJoin('employee', 'activity.employeeId', 'employee.id')
					.innerJoin('time_slot', 'activity.timeSlotId', 'time_slot.id')
					.innerJoin('time_slot_time_logs', 'time_slot.id', 'time_slot_time_logs.timeSlotId')
					.select([
						knex.raw('COUNT("activity"."id") as sessions'),
						knex.raw('SUM("activity"."duration") as duration'),
						'activity.employeeId as employeeId',
						'activity.date as date',
						'activity.title as title'
					])
					.where('activity.tenantId', tenantId)
					.andWhere('activity.organizationId', organizationId);

				if (startDate && endDate) {
					qb = qb.whereBetween('activity.date', [startDate, endDate]);
				}
				if (isNotEmpty(employeeIds)) {
					qb = qb.whereIn('activity.employeeId', employeeIds);
				}

				qb = qb
					.groupBy('activity.date')
					.groupBy('activity.title')
					.groupBy('activity.employeeId')
					.orderBy('date', 'asc');

				const rawResults = await qb;
				return rawResults || [];
			}
			case MultiORMEnum.TypeORM:
			default: {
				const query = this.filterQuery(request);
				query.select(p(`COUNT("${query.alias}"."id")`), `sessions`);
				query.addSelect(p(`SUM("${query.alias}"."duration")`), `duration`);
				query.addSelect(p(`"${query.alias}"."employeeId"`), `employeeId`);
				query.addSelect(p(`"${query.alias}"."date"`), `date`);

				switch (config.dbConnectionOptions.type) {
					case DatabaseTypeEnum.sqlite:
					case DatabaseTypeEnum.betterSqlite3:
						query.addSelect(`time("${query.alias}"."time")`, `time`);
						break;
					case DatabaseTypeEnum.postgres:
						query.addSelect(`(to_char("${query.alias}"."time", 'HH24') || ':00')::time`, 'time');
						break;
					case DatabaseTypeEnum.mysql:
						query.addSelect(p(`CONCAT(DATE_FORMAT("${query.alias}"."time", '%H'), ':00')`), 'time');
						break;
					default:
						throw Error(
							`cannot format daily activities time due to unsupported database type: ${config.dbConnectionOptions.type}`
						);
				}
				query.addSelect(p(`"${query.alias}"."title"`), `title`);
				query.groupBy(p(`"${query.alias}"."date"`));

				switch (config.dbConnectionOptions.type) {
					case DatabaseTypeEnum.sqlite:
					case DatabaseTypeEnum.betterSqlite3:
						query.addGroupBy(`time("${query.alias}"."time")`);
						break;
					case DatabaseTypeEnum.postgres:
						query.addGroupBy(`(to_char("${query.alias}"."time", 'HH24') || ':00')::time`);
						break;
					case DatabaseTypeEnum.mysql:
						query.addGroupBy(p(`CONCAT(DATE_FORMAT("${query.alias}"."time", '%H'), ':00')`));
						break;
					default:
						throw Error(
							`cannot group by daily activities time due to unsupported database type: ${config.dbConnectionOptions.type}`
						);
				}

				query.addGroupBy(p(`"${query.alias}"."title"`));
				query.addGroupBy(p(`"${query.alias}"."employeeId"`));

				query.orderBy(`time`, 'ASC');
				query.addOrderBy(p(`"duration"`), 'DESC');

				return await query.getRawMany();
			}
		}
	}

	async getDailyActivitiesReport(request: IGetActivitiesInput): Promise<IActivity[]> {
		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				// MikroORM: Use Knex raw query for SQL aggregation
				const knex = (this.mikroOrmRepository as any).getKnex();
				const { organizationId, startDate, endDate } = request;
				const tenantId = RequestContext.currentTenantId();

				let employeeIds: string[];
				if (RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
					if (request.employeeIds) employeeIds = request.employeeIds;
				} else {
					const user = RequestContext.currentUser();
					employeeIds = [user.employeeId];
				}

				let qb = knex('activity')
					.innerJoin('employee', 'activity.employeeId', 'employee.id')
					.innerJoin('time_slot', 'activity.timeSlotId', 'time_slot.id')
					.innerJoin('time_slot_time_logs', 'time_slot.id', 'time_slot_time_logs.timeSlotId')
					.select([
						knex.raw('COUNT("activity"."id") as sessions'),
						knex.raw('SUM("activity"."duration") as duration'),
						'activity.employeeId as employeeId',
						'activity.projectId as projectId',
						'activity.date as date',
						'activity.title as title'
					])
					.where('activity.tenantId', tenantId)
					.andWhere('activity.organizationId', organizationId);

				if (startDate && endDate) {
					qb = qb.whereBetween('activity.date', [startDate, endDate]);
				}
				if (isNotEmpty(employeeIds)) {
					qb = qb.whereIn('activity.employeeId', employeeIds);
				}

				let activities = await qb
					.groupBy('activity.date')
					.groupBy('activity.title')
					.groupBy('activity.employeeId')
					.groupBy('activity.projectId')
					.orderByRaw('"duration" DESC')
					.limit(200);

				const projectIds = pluck(activities, 'projectId');
				const empIds = pluck(activities, 'employeeId');

				let employeeById: any = {};
				if (empIds.length > 0) {
					const employees = await this.typeOrmEmployeeRepository.find({
						where: { id: In(empIds), tenantId, organizationId },
						relations: ['user']
					});
					employeeById = indexBy(employees, 'id');
				}

				let projectById: any = {};
				if (projectIds.length > 0) {
					const projects = await this.typeOrmOrganizationProjectRepository.find({
						where: { id: In(projectIds), tenantId, organizationId }
					});
					projectById = indexBy(projects, 'id');
				}

				activities = activities.map((activity: any) => {
					activity.employee = employeeById[activity.employeeId];
					activity.project = projectById[activity.projectId];
					return activity;
				});
				return activities;
			}
			case MultiORMEnum.TypeORM:
			default: {
				const { organizationId } = request;
				const query = this.filterQuery(request);

				query.select(p(`COUNT("${query.alias}"."id")`), `sessions`);
				query.addSelect(p(`SUM("${query.alias}"."duration")`), `duration`);
				query.addSelect(p(`"${query.alias}"."employeeId"`), `employeeId`);
				query.addSelect(p(`"${query.alias}"."projectId"`), `projectId`);
				query.addSelect(p(`"${query.alias}"."date"`), `date`);
				query.addSelect(p(`"${query.alias}"."title"`), `title`);
				query.groupBy(p(`"${query.alias}"."date"`));
				query.addGroupBy(p(`"${query.alias}"."title"`));
				query.addGroupBy(p(`"${query.alias}"."employeeId"`));
				query.addGroupBy(p(`"${query.alias}"."projectId"`));
				query.orderBy(p(`"duration"`), 'DESC');

				query.limit(200);
				let activities = await query.getRawMany();

				const projectIds = pluck(activities, 'projectId');
				const employeeIds = pluck(activities, 'employeeId');

				let employeeById: any = {};
				if (employeeIds.length > 0) {
					const tenantId = RequestContext.currentTenantId();
					const employees = await this.typeOrmEmployeeRepository.find({
						where: {
							id: In(employeeIds),
							tenantId,
							organizationId
						},
						relations: ['user']
					});
					employeeById = indexBy(employees, 'id');
				}

				let projectById: any = {};
				if (projectIds.length > 0) {
					const tenantId = RequestContext.currentTenantId();
					const projects = await this.typeOrmOrganizationProjectRepository.find({
						where: {
							id: In(projectIds),
							tenantId,
							organizationId
						}
					});
					projectById = indexBy(projects, 'id');
				}
				activities = activities.map((activity) => {
					activity.employee = employeeById[activity.employeeId];
					activity.project = projectById[activity.projectId];
					return activity;
				});
				return activities;
			}
		}
	}

	async getActivities(request: IGetActivitiesInput): Promise<IActivity[]> {
		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				// MikroORM: Use find with relation population
				const { organizationId, startDate, endDate } = request;
				const tenantId = RequestContext.currentTenantId();

				let employeeIds: string[];
				if (RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
					if (request.employeeIds) employeeIds = request.employeeIds;
				} else {
					const user = RequestContext.currentUser();
					employeeIds = [user.employeeId];
				}

				const where: any = {
					tenantId,
					organizationId
				};

				if (isNotEmpty(employeeIds)) {
					where.employeeId = { $in: employeeIds };
				}
				if (isNotEmpty(request.titles)) {
					where.title = { $in: request.titles };
				}
				if (isNotEmpty(request.types)) {
					where.type = { $in: request.types };
				}
				if (isNotEmpty(request.projectIds)) {
					where.projectId = { $in: request.projectIds };
				}

				const populate: any[] = [];
				if (RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
					populate.push('employee', 'employee.user');
				}

				const items = await this.mikroOrmRepository.find(where, {
					populate,
					orderBy: { duration: 'DESC' } as any,
					...(request.limit > 0 ? { limit: request.limit, offset: (request.page || 0) * request.limit } : {})
				});
				return items.map((e) => this.serialize(e)) as IActivity[];
			}
			case MultiORMEnum.TypeORM:
			default: {
				const query = this.filterQuery(request);
				if (RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
					query.leftJoinAndSelect(`${query.alias}.employee`, 'activityEmployee');
					query.leftJoinAndSelect(
						`activityEmployee.user`,
						'activityUser',
						p('"employee"."userId" = activityUser.id')
					);
				}

				query.orderBy(`${query.alias}.duration`, 'DESC');
				return await query.getMany();
			}
		}
	}

	async bulkSave(input: IBulkActivitiesInput) {
		return await this.commandBus.execute(new BulkActivitiesSaveCommand(input));
	}

	private filterQuery(request: IGetActivitiesInput): SelectQueryBuilder<Activity> {
		const { organizationId, startDate, endDate } = request;
		const tenantId = RequestContext.currentTenantId();

		let employeeIds: string[];
		if (RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
			if (request.employeeIds) {
				employeeIds = request.employeeIds;
			}
		} else {
			const user = RequestContext.currentUser();
			employeeIds = [user.employeeId];
		}

		const query = this.typeOrmRepository.createQueryBuilder();
		if (request.limit > 0) {
			query.take(request.limit);
			query.skip((request.page || 0) * request.limit);
		}

		query.innerJoin(`${query.alias}.employee`, 'employee');
		query.innerJoin(`${query.alias}.timeSlot`, 'time_slot');
		query.innerJoin(`time_slot.timeLogs`, 'time_log');
		query.andWhere(
			new Brackets((qb: WhereExpressionBuilder) => {
				qb.andWhere(p(`"${query.alias}"."tenantId" = :tenantId`), { tenantId });
				qb.andWhere(p(`"${query.alias}"."organizationId" = :organizationId`), { organizationId });
				qb.andWhere(p(`"time_slot"."tenantId" = :tenantId`), { tenantId });
				qb.andWhere(p(`"time_slot"."organizationId" = :organizationId`), { organizationId });
				qb.andWhere(p(`"time_log"."tenantId" = :tenantId`), { tenantId });
				qb.andWhere(p(`"time_log"."organizationId" = :organizationId`), { organizationId });
			})
		);
		query.andWhere(
			new Brackets((qb: WhereExpressionBuilder) => {
				const { titles, types } = request;
				if (isNotEmpty(types)) {
					qb.andWhere(p(`"${query.alias}"."type" IN (:...types)`), {
						types
					});
				}
				if (isNotEmpty(titles)) {
					qb.andWhere(p(`"${query.alias}"."title" IN (:...titles)`), {
						titles
					});
				}
			})
		);
		query.andWhere(
			new Brackets((qb: WhereExpressionBuilder) => {
				qb.andWhere(
					isSqlite() || isBetterSqlite3()
						? `datetime("${query.alias}"."date" || ' ' || "${query.alias}"."time") Between :startDate AND :endDate`
						: isPostgres()
						? `concat("${query.alias}"."date", ' ', "${query.alias}"."time")::timestamp Between :startDate AND :endDate`
						: isMySQL()
						? p(
								`concat("${query.alias}"."date", ' ', "${query.alias}"."time") Between :startDate AND :endDate`
						  )
						: '',
					{
						startDate,
						endDate
					}
				);
			})
		);
		query.andWhere(
			new Brackets((qb: WhereExpressionBuilder) => {
				const { projectIds = [] } = request;
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
		);
		query.andWhere(
			new Brackets((qb: WhereExpressionBuilder) => {
				const { activityLevel, source, logType } = request;
				if (isNotEmpty(activityLevel)) {
					/**
					 * Activity Level should be 0-100%
					 * So, we have convert it into 10 minutes timeslot by multiply by 6
					 */
					const start = activityLevel.start * 6;
					const end = activityLevel.end * 6;

					qb.andWhere(p(`"time_slot"."overall" BETWEEN :start AND :end`), {
						start,
						end
					});
				}
				if (isNotEmpty(source)) {
					if (source instanceof Array) {
						qb.andWhere(p(`"time_log"."source" IN (:...source)`), {
							source
						});
					} else {
						qb.andWhere(p(`"time_log"."source" = :source`), {
							source
						});
					}
				}
				if (isNotEmpty(logType)) {
					if (logType instanceof Array) {
						qb.andWhere(p(`"time_log"."logType" IN (:...logType)`), {
							logType
						});
					} else {
						qb.andWhere(p(`"time_log"."logType" = :logType`), {
							logType
						});
					}
				}
			})
		);
		return query;
	}
}
