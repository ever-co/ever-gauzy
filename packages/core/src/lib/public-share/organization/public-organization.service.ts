import { IOrganization, IOrganizationContact, IPagination } from '@gauzy/contracts';
import { Injectable, NotFoundException } from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { MultiORM, MultiORMEnum, getORMType } from '../../core/utils';
import { Organization, OrganizationContact, OrganizationProject } from './../../core/entities/internal';
import { TypeOrmOrganizationRepository } from '../../organization/repository/type-orm-organization.repository';
import { MikroOrmOrganizationRepository } from '../../organization/repository/mikro-orm-organization.repository';
import { TypeOrmOrganizationContactRepository } from '../../organization-contact/repository/type-orm-organization-contact.repository';
import { MikroOrmOrganizationContactRepository } from '../../organization-contact/repository/mikro-orm-organization-contact.repository';
import { TypeOrmOrganizationProjectRepository } from '../../organization-project/repository/type-orm-organization-project.repository';
import { MikroOrmOrganizationProjectRepository } from '../../organization-project/repository/mikro-orm-organization-project.repository';

// Get the type of the Object-Relational Mapping (ORM) used in the application.
const ormType: MultiORM = getORMType();

@Injectable()
export class PublicOrganizationService {
	constructor(
		private readonly typeOrmOrganizationRepository: TypeOrmOrganizationRepository,
		private readonly mikroOrmOrganizationRepository: MikroOrmOrganizationRepository,

		private readonly typeOrmOrganizationContactRepository: TypeOrmOrganizationContactRepository,
		private readonly mikroOrmOrganizationContactRepository: MikroOrmOrganizationContactRepository,

		private readonly typeOrmOrganizationProjectRepository: TypeOrmOrganizationProjectRepository,
		private readonly mikroOrmOrganizationProjectRepository: MikroOrmOrganizationProjectRepository
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
			switch (ormType) {
				case MultiORMEnum.MikroORM:
					return await this.mikroOrmOrganizationRepository.findOneOrFail(where as any, {
						populate: relations as any
					});
				case MultiORMEnum.TypeORM:
				default:
					return await this.typeOrmOrganizationRepository.findOneOrFail({
						where,
						relations
					});
			}
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
			switch (ormType) {
				case MultiORMEnum.MikroORM: {
					const [items = [], total = 0] = await this.mikroOrmOrganizationContactRepository.findAndCount(
						options as any
					);
					return { items, total };
				}
				case MultiORMEnum.TypeORM:
				default: {
					const [items = [], total = 0] =
						await this.typeOrmOrganizationContactRepository.findAndCountBy(options);
					return { items, total };
				}
			}
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
			switch (ormType) {
				case MultiORMEnum.MikroORM:
					return await this.mikroOrmOrganizationContactRepository.count(options as any);
				case MultiORMEnum.TypeORM:
				default:
					return await this.typeOrmOrganizationContactRepository.countBy(options);
			}
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
			switch (ormType) {
				case MultiORMEnum.MikroORM:
					return await this.mikroOrmOrganizationProjectRepository.count(options as any);
				case MultiORMEnum.TypeORM:
				default:
					return await this.typeOrmOrganizationProjectRepository.countBy(options);
			}
		} catch (error) {
			throw new NotFoundException(`The requested project counts was not found`);
		}
	}
}
