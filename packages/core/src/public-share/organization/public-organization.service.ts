import { IOrganization, IOrganizationContact, IPagination } from '@gauzy/contracts';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FindOptionsWhere } from 'typeorm/find-options/FindOptionsWhere';
import { Organization, OrganizationContact, OrganizationProject } from './../../core/entities/internal';

@Injectable()
export class PublicOrganizationService {

	constructor(
		@InjectRepository(Organization)
		private readonly repository: Repository<Organization>,

		@InjectRepository(OrganizationContact)
		private readonly organizationContact: Repository<OrganizationContact>,

		@InjectRepository(OrganizationProject)
		private readonly organizationProject: Repository<OrganizationProject>
	) {}

	/**
	 * GET organization by profile link
	 *
	 * @param options
	 * @param relations
	 * @returns
	 */
	async findOneByProfileLink(
		where: FindOptionsWhere<Organization>,
		relations: string[]
	): Promise<IOrganization> {
		try {
			return await this.repository.findOneOrFail({
				where,
				relations
			});
		} catch (error) {
			throw new NotFoundException(`The requested record was not found`);
		}
	}

	/**
	 * GET all public clients by organization condition
	 *
	 * @param options
	 * @returns
	 */
	async findPublicClientsByOrganization(
		options: FindOptionsWhere<OrganizationContact>
	): Promise<IPagination<IOrganizationContact>> {
		try {
			const [items = [], total = 0] = await this.organizationContact.findAndCountBy(options);
			return { items, total };
		} catch (error) {
			throw new NotFoundException(`The requested public clients was not found`);
		}
	}

	/**
	 * GET all public client counts by organization condition
	 *
	 * @param options
	 * @returns
	 */
	async findPublicClientCountsByOrganization(
		options: FindOptionsWhere<OrganizationContact>
	): Promise<Number> {
		try {
			return await this.organizationContact.countBy(options);
		} catch (error) {
			throw new NotFoundException(`The requested client counts was not found`);
		}
	}

	/**
	 * GET all public project counts by organization condition
	 *
	 * @param options
	 * @returns
	 */
	async findPublicProjectCountsByOrganization(
		options: FindOptionsWhere<OrganizationProject>
	): Promise<Number> {
		try {
			return await this.organizationProject.countBy(options);
		} catch (error) {
			throw new NotFoundException(`The requested project counts was not found`);
		}
	}
}
