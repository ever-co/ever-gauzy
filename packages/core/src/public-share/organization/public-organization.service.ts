import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindConditions, Repository } from 'typeorm';
import { Organization } from './../../core/entities/internal';

@Injectable()
export class PublicOrganizationService {

	constructor(
		@InjectRepository(Organization)
		private readonly repository: Repository<Organization>
	) {}

	/**
	 * GET organization by profile link
	 *
	 * @param options
	 * @returns
	 */
	async findOneByProfileLink(options: FindConditions<Organization>) {
		try {
			return await this.repository.findOneOrFail(options, {
				relations: [
					'skills',
					'awards',
					'languages',
					'languages.language'
				]
			});
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
