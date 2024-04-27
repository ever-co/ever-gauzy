import { InjectConnection } from 'nest-knexjs';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, WhereExpressionBuilder } from 'typeorm';
import { Knex as KnexConnection } from 'knex';
import { MikroOrmDailyPlanRepository, TypeOrmDailyPlanRepository } from './repository';
import { DailyPlan } from './daily-plan.entity';
import { IEmployee } from '@gauzy/contracts';
import { PaginationParams, TenantAwareCrudService } from '../../core/crud';
import { isNotEmpty } from '@gauzy/common';
import { RequestContext } from '../../core/context';
import { prepareSQLQuery as p } from '../../database/database.helper';

@Injectable()
export class DailyPlanService extends TenantAwareCrudService<DailyPlan> {
	constructor(
		@InjectRepository(DailyPlan)
		readonly typeOrmDailyPlanRepository: TypeOrmDailyPlanRepository,

		readonly mikroOrmDailyPlanRepository: MikroOrmDailyPlanRepository,

		@InjectConnection()
		readonly knexConnection: KnexConnection
	) {
		super(typeOrmDailyPlanRepository, mikroOrmDailyPlanRepository);
	}

	/**
	 * GET daily plans for a given employee
	 *
	 * @param employeeId
	 * @param options
	 * @returns
	 */
	async getDailyPlansByEmployee(employeeId: IEmployee['id'], options: PaginationParams<DailyPlan>) {
		try {
			const query = this.typeOrmRepository.createQueryBuilder(this.tableName);
			query.leftJoin(`${query.alias}.employee`, 'employee');
			query.leftJoin(`${query.alias}.tasks`, 'tasks');

			query.setFindOptions({
				...(isNotEmpty(options) &&
					isNotEmpty(options.where) && {
						where: options.where
					}),
				...(isNotEmpty(options) &&
					isNotEmpty(options.relations) && {
						relations: options.relations
					})
			});
			query.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					const tenantId = RequestContext.currentTenantId();
					qb.andWhere(p(`"${query.alias}"."tenantId" = :tenantId`), {
						tenantId
					});
				})
			);
			query.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					qb.andWhere(p(`"${query.alias}"."employeeId" = :employeeId`), { employeeId });
				})
			);
			return await query.getMany();
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	/**
	 * GET my plans
	 *
	 * @param options
	 * @returns
	 */

	async getMyPlans(options: PaginationParams<DailyPlan>) {}
}
