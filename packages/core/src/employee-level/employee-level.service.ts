import { MikroInjectRepository } from '@gauzy/common';
import { EntityRepository } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import { TenantAwareCrudService } from './../core/crud';
import { EmployeeLevel } from './employee-level.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class EmployeeLevelService extends TenantAwareCrudService<EmployeeLevel> {
	constructor(
		@InjectRepository(EmployeeLevel)
		private readonly employeeLevelRepository: Repository<EmployeeLevel>,
		@MikroInjectRepository(EmployeeLevel)
		private readonly mikroEmployeeLevelRepository: EntityRepository<EmployeeLevel>
	) {
		super(employeeLevelRepository, mikroEmployeeLevelRepository);
	}
}
