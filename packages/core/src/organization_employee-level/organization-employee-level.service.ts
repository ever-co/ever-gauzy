import { Injectable } from '@nestjs/common';
import { TenantAwareCrudService } from './../core/crud';
import { EmployeeLevel } from './organization-employee-level.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class EmployeeLevelService extends TenantAwareCrudService<EmployeeLevel> {
	constructor(
		@InjectRepository(EmployeeLevel)
		private readonly employeeLevelRepository: Repository<EmployeeLevel>
	) {
		super(employeeLevelRepository);
	}
}
