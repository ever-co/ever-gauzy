import { IEmployee, IPagination } from '@gauzy/contracts';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindConditions, Repository } from 'typeorm';
import { Employee, Organization } from './../../core/entities/internal';

@Injectable()
export class PublicEmployeeService {

	constructor(
		@InjectRepository(Employee)
		private readonly repository: Repository<Employee>,

		@InjectRepository(Organization)
		private readonly organizationRepository: Repository<Organization>
	) {}

	/**
	 * GET all public employees by organization profile link & other conditions
	 *
	 * @param params
	 * @param where
	 * @returns
	 */
	async getAllPublicEmployeeByOrganizationProfile(
		params: FindConditions<Organization>,
		where: FindConditions<Employee>
	): Promise<IPagination<IEmployee>> {
		try {
			await this.organizationRepository.findOneOrFail(params);
			const [items = [], total = 0] = await this.repository.findAndCount({
				where,
				relations: ['user', 'skills']
			});
			return { items, total };
		} catch (error) {
			throw new BadRequestException(error, `Error while gettting public employees`);
		}
	}
}
