import { BadRequestException, Injectable } from '@nestjs/common';
import { Brackets, In, Raw } from 'typeorm';
import {
	ID,
	IOrganizationContact,
	IOrganizationContactFindInput,
	IPagination,
	BaseEntityEnum,
	PermissionsEnum
} from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { BaseQueryDTO, TenantAwareCrudService } from './../core/crud';
import { isNotEmpty } from '@gauzy/utils';
import { MultiORMEnum } from '../core/utils';
import { LIKE_OPERATOR } from '../core/util';
import { OrganizationContact } from './organization-contact.entity';
import { resolveOrganizationContactEmployeeRelations } from './organization-contact-relations';
import { prepareSQLQuery as p } from './../database/database.helper';
import { TypeOrmOrganizationContactRepository } from './repository/type-orm-organization-contact.repository';
import { MikroOrmOrganizationContactRepository } from './repository/mikro-orm-organization-contact.repository';
import { FavoriteService } from '../core/decorators';

@FavoriteService(BaseEntityEnum.OrganizationContact)
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

			switch (this.ormType) {
				case MultiORMEnum.MikroORM: {
					const where: any = {
						tenantId,
						organizationId,
						members: { id: employeeId }
					};
					if (isNotEmpty(contactType)) where.contactType = contactType;

					const items = await this.mikroOrmRepository.find(where as any, {
						fields: ['id', 'name', 'imageUrl'] as any[]
					});
					return items.map((e) => this.serialize(e)) as IOrganizationContact[];
				}
				case MultiORMEnum.TypeORM:
				default: {
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
				}
			}
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
		const { findInput } = data;
		const { organizationId, contactType } = findInput;

		// This branch builds its own joins, so it never reaches the sensitive-relation check the
		// CrudService read methods run. The table is asserted here, as the sibling hand-rolled services
		// do, and only allowlisted direct relations may be joined at all (GHSA-c3cj-m3xm-7j5h).
		this.assertRelationsPermitted({ relations: data.relations });
		const relations = resolveOrganizationContactEmployeeRelations(data.relations);

		// Get current user ID and tenant ID from the request context
		const createdByUserId = RequestContext.currentUserId();
		const tenantId = RequestContext.currentTenantId() ?? findInput.tenantId;

		// A caller may only list the contacts of another employee when they can act for other employees;
		// everyone else is pinned to their own employee record, whatever the query names.
		const employeeId = RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)
			? findInput.employeeId
			: RequestContext.currentEmployeeId();

		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				// Never emit `members: { id: null }` — that would match contacts WITHOUT members.
				const $or: any[] = [{ createdByUserId }];
				if (employeeId) {
					$or.unshift({ members: { id: employeeId } });
				}
				const where: any = {
					$or,
					contactType,
					tenantId,
					...(organizationId ? { organizationId } : {})
				};

				const [items, total] = await this.mikroOrmRepository.findAndCount(where, {
					populate: relations as any[]
				});
				return { items: items.map((e) => this.serialize(e)), total };
			}
			case MultiORMEnum.TypeORM:
			default: {
				const query = this.typeOrmRepository.createQueryBuilder('organization_contact');
				for (const relation of relations) {
					query.leftJoinAndSelect(`${query.alias}.${relation}`, relation);
				}
				// The member filter below needs the `members` alias even when the caller did not ask for it.
				if (!relations.includes('members')) {
					query.leftJoin(`${query.alias}.members`, 'members');
				}
				query.where(
					new Brackets((subQuery) => {
						subQuery.where(`${query.alias}.createdByUserId = :createdByUserId`, { createdByUserId });
						if (employeeId) {
							subQuery.orWhere('members.id = :employeeId', { employeeId });
						}
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
		}
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
	public async pagination(filter?: BaseQueryDTO<OrganizationContact>): Promise<IPagination<IOrganizationContact>> {
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
