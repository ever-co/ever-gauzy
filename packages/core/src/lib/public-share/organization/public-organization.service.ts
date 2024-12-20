import { IOrganization, IOrganizationContact, IPagination } from '@gauzy/contracts';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere } from 'typeorm';
import { Organization, OrganizationContact, OrganizationProject } from './../../core/entities/internal';
import { TypeOrmOrganizationRepository } from '../../organization/repository/type-orm-organization.repository';
import { TypeOrmOrganizationContactRepository } from '../../organization-contact/repository/type-orm-organization-contact.repository';
import { TypeOrmOrganizationProjectRepository } from '../../organization-project/repository/type-orm-organization-project.repository';

@Injectable()
export class PublicOrganizationService {
	constructor(
		@InjectRepository(Organization)
		private typeOrmOrganizationRepository: TypeOrmOrganizationRepository,

		@InjectRepository(OrganizationContact)
		private typeOrmOrganizationContactRepository: TypeOrmOrganizationContactRepository,

		@InjectRepository(OrganizationProject)
		private typeOrmOrganizationProjectRepository: TypeOrmOrganizationProjectRepository
	) {}

	/**
	 * GET organization by profile link
	 *
	 * @param options
	 * @param relations
	 * @returns
	 */
	async findOneByProfileLink(where: FindOptionsWhere<Organization>, relations: string[]): Promise<IOrganization> {
		try {
			return await this.typeOrmOrganizationRepository.findOneOrFail({
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
			const [items = [], total = 0] = await this.typeOrmOrganizationContactRepository.findAndCountBy(options);
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
	async findPublicClientCountsByOrganization(options: FindOptionsWhere<OrganizationContact>): Promise<Number> {
		try {
			return await this.typeOrmOrganizationContactRepository.countBy(options);
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
	async findPublicProjectCountsByOrganization(options: FindOptionsWhere<OrganizationProject>): Promise<Number> {
		try {
			return await this.typeOrmOrganizationProjectRepository.countBy(options);
		} catch (error) {
			throw new NotFoundException(`The requested project counts was not found`);
		}
	}
}
