import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TenantAwareCrudService } from './../core/crud';
import { TypeOrmEmployeeLevelRepository } from './repository/type-orm-employee-level.repository';
import { MikroOrmEmployeeLevelRepository } from './repository/mikro-orm-employee-level.repository';
import { EmployeeLevel } from './employee-level.entity';

@Injectable()
export class EmployeeLevelService extends TenantAwareCrudService<EmployeeLevel> {
	constructor(
		@InjectRepository(EmployeeLevel)
		typeOrmEmployeeLevelRepository: TypeOrmEmployeeLevelRepository,

		mikroOrmEmployeeLevelRepository: MikroOrmEmployeeLevelRepository
	) {
		super(typeOrmEmployeeLevelRepository, mikroOrmEmployeeLevelRepository);
	}
}
