import { InjectConnection } from 'nest-knexjs';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Knex as KnexConnection } from 'knex';

import { Employee } from '../../employee/employee.entity';
import { MikroOrmDailyPlanRepository, TypeOrmDailyPlanRepository } from './repository';
import { DailyPlan } from './daily-plan.entity';
import { MikroOrmEmployeeRepository, TypeOrmEmployeeRepository } from '../../employee/repository';

@Injectable()
export class DailyPlanService {
	constructor(
		@InjectRepository(DailyPlan)
		readonly typeOrmTaskStatusRepository: TypeOrmDailyPlanRepository,

		readonly mikroOrmTaskStatusRepository: MikroOrmDailyPlanRepository,

		// @InjectRepository(Employee)
		// readonly typeOrmEmployeeRepository: TypeOrmEmployeeRepository,

		// readonly mikroOrmEmployeeRepository: MikroOrmEmployeeRepository,

		@InjectConnection()
		readonly knexConnection: KnexConnection
	) {}
}
