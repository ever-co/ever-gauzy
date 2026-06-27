import { IOrganization, IOrganizationContact, IPagination } from '@gauzy/contracts';
import { Injectable, NotFoundException } from '@nestjs/common';
import { FindOptionsSelect, FindOptionsWhere } from 'typeorm';
import { MultiORM, MultiORMEnum, getORMType } from '../../core/utils';
import { Organization, OrganizationContact, OrganizationProject } from './../../core/entities/internal';

/**
 * Display-safe field allowlist for the public organization profile.
 *
 * The public endpoint must NOT return the entire Organization entity (taxId, officialName, internal
 * flags, tenantId, etc.). Only the fields the public profile page renders are exposed
 * (GHSA-49ff-8859-537j). Relations requested by the caller load in full (they are not restricted
 * here); only the organization's own columns are projected.
 */
const PUBLIC_ORGANIZATION_SELECT: FindOptionsSelect<Organization> = {
	id: true,
	name: true,
	profile_link: true,
	imageUrl: true,
	banner: true,
	short_description: true,
	overview: true,
	currency: true,
	currencyPosition: true,
	registrationDate: true,
	minimumProjectSize: true,
	client_focus: true,
	regionCode: true,
	dateFormat: true,
	defaultValueDateType: true,
	show_income: true,
	show_profits: true,
	show_bonuses_paid: true,
	show_clients: true,
	show_clients_count: true,
	show_employees_count: true,
	show_projects_count: true,
	show_minimum_project_size: true
};

/** Same allowlist as a flat field list for the MikroORM `fields` option. */
const PUBLIC_ORGANIZATION_FIELDS: string[] = Object.keys(PUBLIC_ORGANIZATION_SELECT);
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
						populate: relations as any,
						// Restrict the response to display-safe fields only (GHSA-49ff-8859-537j).
						// Requested relations are included so they still load in full.
						fields: [
							...PUBLIC_ORGANIZATION_FIELDS,
							...(Array.isArray(relations) ? relations : [])
						] as any
					});
				case MultiORMEnum.TypeORM:
				default:
					// TODO(typeorm-v1): `relations` no longer accepts a string array. This value references a variable whose shape can't be determined statically — if it holds `string[]`, wrap it: `Object.fromEntries(<expr>?.map(r => [r, true]) ?? [])` (dot-paths need extra nesting handling). If it already holds the v1 object shape, no change needed.
                    return await this.typeOrmOrganizationRepository.findOneOrFail({
						where,
						relations,
						// Restrict the response to display-safe fields only (GHSA-49ff-8859-537j).
						select: PUBLIC_ORGANIZATION_SELECT
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
