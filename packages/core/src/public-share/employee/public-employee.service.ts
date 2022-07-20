import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindConditions, Repository } from 'typeorm';
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
	 * @param options
	 * @returns
	 */
	async findPublicEmployeeByOrganization(
		where: FindConditions<Employee>,
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
	 * @param options
	 * @returns
	 */
	async findOneByConditions(
		options: FindConditions<Employee>,
		relations: string[]
	): Promise<IEmployee> {
		try {
			return await this.repository.findOneOrFail(options, { relations });
		} catch (error) {
			throw new NotFoundException(`The requested record was not found`);
		}
	}
}
