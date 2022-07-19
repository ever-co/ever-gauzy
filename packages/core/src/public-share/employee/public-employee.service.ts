import { BadRequestException, Injectable } from '@nestjs/common';
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
		options: FindConditions<Employee>
	): Promise<IPagination<IEmployee>> {
		try {
			const [items = [], total = 0] = await this.repository.findAndCount({
				where: options,
				relations: ['user', 'skills']
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
	async findOneByProfileLink(
		options: FindConditions<Employee>
	): Promise<IEmployee> {
		try {
			return await this.repository.findOneOrFail(options, {
				relations: [
					'user',
					'organization',
					'organizationEmploymentTypes',
					'tags',
					'skills'
				]
			});
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
