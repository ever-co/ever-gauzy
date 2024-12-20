import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TenantAwareCrudService } from './../core/crud';
import { TypeOrmEmployeeAwardRepository } from './repository/type-orm-employee-award.repository';
import { MikroOrmEmployeeAwardRepository } from './repository/mikro-orm-employee-award.repository';
import { EmployeeAward } from './employee-award.entity';

@Injectable()
export class EmployeeAwardService extends TenantAwareCrudService<EmployeeAward> {
	constructor(
		@InjectRepository(EmployeeAward)
		typeOrmEmployeeAwardRepository: TypeOrmEmployeeAwardRepository,

		mikroOrmEmployeeAwardRepository: MikroOrmEmployeeAwardRepository
	) {
		super(typeOrmEmployeeAwardRepository, mikroOrmEmployeeAwardRepository);
	}
}
