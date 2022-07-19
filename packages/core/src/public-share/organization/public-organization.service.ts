import { IOrganization, IOrganizationContact, IPagination } from '@gauzy/contracts';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindConditions, Repository } from 'typeorm';
import { Organization, OrganizationContact } from './../../core/entities/internal';

@Injectable()
export class PublicOrganizationService {

	constructor(
		@InjectRepository(Organization)
		private readonly repository: Repository<Organization>,

		@InjectRepository(OrganizationContact)
		private readonly organizationContact: Repository<OrganizationContact>
	) {}

	/**
	 * GET organization by profile link
	 *
	 * @param options
	 * @returns
	 */
	async findOneByProfileLink(
		options: FindConditions<Organization>
	): Promise<IOrganization> {
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

	/**
	 * GET all public clients by organization condition
	 *
	 * @param options
	 * @returns
	 */
	async findPublicClientsByOrganization(
		options: FindConditions<OrganizationContact>
	): Promise<IPagination<IOrganizationContact>> {
		try {
			const [items = [], total = 0] = await this.organizationContact.findAndCount({
				where: options
			});
			return { items, total };
		} catch (error) {
			throw new BadRequestException(error, `Error while gettting public employees`);
		}
	}
}
