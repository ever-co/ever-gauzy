import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantAwareCrudService } from './../core/crud';
import { EmployeeAward } from './employee-award.entity';

@Injectable()
export class EmployeeAwardService extends TenantAwareCrudService<EmployeeAward> {
	constructor(
		@InjectRepository(EmployeeAward)
		private readonly employeeAwardRepository: Repository<EmployeeAward>
	) {
		super(employeeAwardRepository);
	}
}
