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

	async findOneByProfileLink(where: FindConditions<Organization>) {
		try {
			return await this.repository.findOneOrFail(where, {
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
