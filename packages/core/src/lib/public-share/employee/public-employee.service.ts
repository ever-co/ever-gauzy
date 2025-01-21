import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere } from 'typeorm';
import { IEmployee, IPagination } from '@gauzy/contracts';
import { Employee } from './../../core/entities/internal';
import { TypeOrmEmployeeRepository } from '../../employee/repository/type-orm-employee.repository';

@Injectable()
export class PublicEmployeeService {
	constructor(
		@InjectRepository(Employee)
		private typeOrmEmployeeRepository: TypeOrmEmployeeRepository
	) {}

	/**
	 * GET all public employees by organization condition
	 *
	 * @param where
	 * @param relations
	 * @returns
	 */
	async findPublicEmployeeByOrganization(
		where: FindOptionsWhere<Employee>,
		relations: string[] = []
	): Promise<IPagination<IEmployee>> {
		try {
			const [items = [], total = 0] = await this.typeOrmEmployeeRepository.findAndCount({
				where,
				relations
			});
			return { items, total };
		} catch (error) {
			throw new BadRequestException(error, `Error while getting public employees`);
		}
	}

	/**
	 * GET employee by profile link & primary ID
	 *
	 * @param where
	 * @param relations
	 * @returns
	 */
	async findOneByConditions(where: FindOptionsWhere<Employee>, relations: string[]): Promise<IEmployee> {
		try {
			return await this.typeOrmEmployeeRepository.findOneOrFail({
				where,
				relations
			});
		} catch (error) {
			throw new NotFoundException(`The requested record was not found`);
		}
	}
}
