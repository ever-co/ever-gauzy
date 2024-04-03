import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee } from '../employee.entity';
import { Injectable } from '@nestjs/common';

@Injectable()
export class TypeOrmEmployeeRepository extends Repository<Employee> {
	constructor(@InjectRepository(Employee) readonly repository: Repository<Employee>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
