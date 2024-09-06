import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { IEmployee } from '@gauzy/contracts';
import { Employee } from '../employee.entity';

@Injectable()
export class TypeOrmEmployeeRepository extends Repository<Employee> {
	constructor(@InjectRepository(Employee) readonly repository: Repository<Employee>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}

	/**
	 * Fetches an employee based on the provided query.
	 *
	 * @param query - The query parameters to find the employee.
	 * @returns A Promise resolving to the employee entity or null.
	 */
	async findOneByOptions(query: FindOptionsWhere<Employee>): Promise<IEmployee | null> {
		return await this.repository.findOneBy(query);
	}
}
