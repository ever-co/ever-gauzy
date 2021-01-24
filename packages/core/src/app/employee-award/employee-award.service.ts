import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '../core/crud/crud.service';
import { EmployeeAward } from './employee-award.entity';

@Injectable()
export class EmployeeAwardService extends CrudService<EmployeeAward> {
	constructor(
		@InjectRepository(EmployeeAward)
		private readonly employeeAwardRepository: Repository<EmployeeAward>
	) {
		super(employeeAwardRepository);
	}
}
