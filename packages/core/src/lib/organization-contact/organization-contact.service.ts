import { BadRequestException, Injectable } from '@nestjs/common';
import { Brackets, In, Raw } from 'typeorm';
import { ID, IOrganizationContact, IOrganizationContactFindInput, IPagination } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { PaginationParams, TenantAwareCrudService } from './../core/crud';
import { isNotEmpty } from '@gauzy/utils';
import { LIKE_OPERATOR } from '../core/util';
import { OrganizationContact } from './organization-contact.entity';
import { prepareSQLQuery as p } from './../database/database.helper';
import { TypeOrmOrganizationContactRepository } from './repository/type-orm-organization-contact.repository';
import { MikroOrmOrganizationContactRepository } from './repository/mikro-orm-organization-contact.repository';

@Injectable()
export class OrganizationContactService extends TenantAwareCrudService<OrganizationContact> {
	constructor(
		readonly typeOrmOrganizationContactRepository: TypeOrmOrganizationContactRepository,
		readonly mikroOrmOrganizationContactRepository: MikroOrmOrganizationContactRepository
	) {
		super(typeOrmOrganizationContactRepository, mikroOrmOrganizationContactRepository);
	}

	/**
	 * Find employee assigned contacts
	 *
	 * @param employeeId
	 * @param options
	 * @returns
	 */
	async findByEmployee(employeeId: ID, options: IOrganizationContactFindInput): Promise<IOrganizationContact[]> {
		try {
			const tenantId = RequestContext.currentTenantId() ?? options.tenantId;
			const { organizationId, contactType } = options;

			const query = this.typeOrmRepository.createQueryBuilder(this.tableName);
			query.setFindOptions({
				select: {
					id: true,
					name: true,
					imageUrl: true
				}
			});
			query.innerJoin(`${query.alias}.members`, 'member');
			query.andWhere(p('member.id = :employeeId'), { employeeId });
			query.andWhere(p(`"${query.alias}"."tenantId" = :tenantId`), { tenantId });
			query.andWhere(p(`"${query.alias}"."organizationId" = :organizationId`), { organizationId });

			if (isNotEmpty(contactType)) {
				query.andWhere(p(`${query.alias}.contactType = :contactType`), { contactType });
			}

			return await query.getMany();
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	/*
	 * Get All Organization Contact
	 */
	async findAllOrganizationContacts(data: any) {
		const { relations, findInput } = data;
		if (findInput && findInput['employeeId']) {
			return await this.getOrganizationContactByEmployee(data);
		}

		return this.findAll({
			where: findInput,
			relations
		});
	}

	/*
	 * Get All Organization By Employee
	 */
	async getOrganizationContactByEmployee(data: any) {
		const { relations, findInput } = data;
		const { employeeId, organizationId, contactType } = findInput;

		// Get current user ID and tenant ID from the request context
		const createdByUserId = RequestContext.currentUserId();
		const tenantId = RequestContext.currentTenantId() ?? findInput.tenantId;

		const query = this.typeOrmRepository.createQueryBuilder('organization_contact');
		if (relations.length > 0) {
			relations.forEach((relation: string) => {
				if (relation.indexOf('.') !== -1) {
					const alias = relation.split('.').slice(-1)[0];
					query.leftJoinAndSelect(`${relation}`, alias);
				} else {
					const alias = relation;
					query.leftJoinAndSelect(`${query.alias}.${relation}`, alias);
				}
			});
		}
		query.where(
			new Brackets((subQuery) => {
				subQuery
					.where('members.id =:employeeId', { employeeId })
					.orWhere(`${query.alias}.createdByUserId = :createdByUserId`, { createdByUserId });
			})
		);

		query.andWhere(`${query.alias}.contactType = :contactType`, { contactType });
		query.andWhere(`${query.alias}.tenantId = :tenantId`, { tenantId });

		if (organizationId) {
			query.andWhere(`${query.alias}.organizationId = :organizationId`, { organizationId });
		}

		const [items, total] = await query.getManyAndCount();
		return { items, total };
	}

	/**
	 * Finds an organization contact by its ID and includes the specified relations.
	 *
	 * @param id - The unique identifier for the organization contact.
	 * @param relations - An array of relation names to include in the result.
	 * @returns A promise that resolves to an IOrganizationContact.
	 */
	async findById(id: ID, relations: string[]): Promise<IOrganizationContact> {
		return await this.findOneByIdString(id, { relations });
	}

	/**
	 * Organization contact by pagination
	 *
	 * @param filter - The pagination parameters, including custom filters.
	 * @returns A promise that resolves with paginated organization contacts.
	 */
	public async pagination(
		filter?: PaginationParams<OrganizationContact>
	): Promise<IPagination<IOrganizationContact>> {
		if (filter?.where) {
			const { where } = filter;

			// Apply like filter for the name field.
			if (where.name) {
				filter.where['name'] = Raw((alias: string) => `${alias} ${LIKE_OPERATOR} :name`, {
					name: `%${where.name}%`
				});
			}

			// Apply like filter for the primaryPhone field.
			if (where.primaryPhone) {
				filter.where['primaryPhone'] = Raw((alias: string) => `${alias} ${LIKE_OPERATOR} :primaryPhone`, {
					primaryPhone: `%${where.primaryPhone}%`
				});
			}

			// Apply like filter for the primaryEmail field.
			if (where.primaryEmail) {
				filter.where['primaryEmail'] = Raw((alias: string) => `${alias} ${LIKE_OPERATOR} :primaryEmail`, {
					primaryEmail: `%${where.primaryEmail}%`
				});
			}

			// Apply filter for the members field.
			if (where.members) {
				const { members } = where;
				filter.where['members'] = {
					id: In(members as Array<ID>)
				};
			}
		}

		return super.paginate(filter ?? {});
	}
}
