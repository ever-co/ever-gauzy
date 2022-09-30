import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { IEmployee, IPagination } from '@gauzy/contracts';
import { Employee } from './../../core/entities/internal';

@Injectable()
export class PublicEmployeeService {

	constructor(
		@InjectRepository(Employee)
		private readonly repository: Repository<Employee>
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
			const [items = [], total = 0] = await this.repository.findAndCount({
				where,
				relations
			});
			return { items, total };
		} catch (error) {
			throw new BadRequestException(error, `Error while gettting public employees`);
		}
	}

	/**
	 * GET employee by profile link & primary ID
	 *
	 * @param where
	 * @param relations
	 * @returns
	 */
	async findOneByConditions(
		where: FindOptionsWhere<Employee>,
		relations: string[]
	): Promise<IEmployee> {
		try {
			return await this.repository.findOneOrFail({
				where,
				relations
			});
		} catch (error) {
			throw new NotFoundException(`The requested record was not found`);
		}
	}
}
