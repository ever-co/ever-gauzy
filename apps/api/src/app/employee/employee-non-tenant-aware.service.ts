import { Injectable } from '@nestjs/common';
import { CrudService } from '../core';
import { Employee } from './employee.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class EmployeeNonTenantAwareService extends CrudService<Employee> {
	constructor(
		@InjectRepository(Employee)
		private readonly employeeRepository: Repository<Employee>
	) {
		super(employeeRepository);
	}
}
