import { Injectable } from '@nestjs/common';
import { CrudService } from '../core';
import { EmployeeLevel } from './organization-employee-level.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class EmployeeLevelService extends CrudService<EmployeeLevel> {
	constructor(
		@InjectRepository(EmployeeLevel)
		private readonly employeeLevelRepository: Repository<EmployeeLevel>
	) {
		super(employeeLevelRepository);
	}
}
