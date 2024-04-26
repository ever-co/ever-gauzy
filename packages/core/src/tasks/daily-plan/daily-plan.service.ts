import { InjectConnection } from 'nest-knexjs';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull } from 'typeorm';
import { Knex as KnexConnection } from 'knex';
import { MikroOrmDailyPlanRepository, TypeOrmDailyPlanRepository } from './repository';
import { DailyPlan } from './daily-plan.entity';
import { IPagination } from '@gauzy/contracts';
import { PaginationParams, TenantAwareCrudService } from '../../core/crud';
// import { MultiORMEnum } from '../../core/utils';
// import { isPostgres } from '@gauzy/config';

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
	 * @param options
	 * @returns
	 */
	async getEmployeeDailyPlans(options: PaginationParams<DailyPlan>): Promise<IPagination<DailyPlan>> {
		try {
			if ('where' in options) {
				const { where } = options;
				if (where.employeeId === 'null') {
					options.where.employeeId = IsNull();
				}
				return await super.findAll(options);
			}
		} catch (error) {
			console.log(
				'Failed to retrieve employee daily plans. Ensure that the provided parameters are valid and complete.',
				error
			);
			throw new BadRequestException(
				'Failed to retrieve employee daily plans. Ensure that the provided parameters are valid and complete.',
				error
			);
		}
	}
}
