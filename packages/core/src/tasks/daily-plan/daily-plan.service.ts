import { InjectConnection } from 'nest-knexjs';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Knex as KnexConnection } from 'knex';
import { MikroOrmDailyPlanRepository, TypeOrmDailyPlanRepository } from './repository';
import { DailyPlan } from './daily-plan.entity';

@Injectable()
export class DailyPlanService {
	constructor(
		@InjectRepository(DailyPlan)
		readonly typeOrmTaskStatusRepository: TypeOrmDailyPlanRepository,

		readonly mikroOrmTaskStatusRepository: MikroOrmDailyPlanRepository,

		@InjectConnection()
		readonly knexConnection: KnexConnection
	) {}
}
