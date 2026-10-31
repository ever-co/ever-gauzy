import { BadRequestException, ConflictException, HttpException, Injectable } from '@nestjs/common';
import { Brackets, EntityManager, In, Raw } from 'typeorm';
import type { EntityManager as MikroOrmEntityManager } from '@mikro-orm/core';
import {
	ID,
	IOrganizationContact,
	IOrganizationContactCreateInput,
	IOrganizationContactFindInput,
	IOrganizationProject,
	IPagination,
	BaseEntityEnum,
	PermissionsEnum
} from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { BaseQueryDTO, TenantAwareCrudService } from './../core/crud';
import { isNotEmpty } from '@gauzy/utils';
import { MultiORMEnum } from '../core/utils';
import { LIKE_OPERATOR } from '../core/util';
import { redactDatabaseError, toClientSafeError } from '../core/errors/database-error';
import { OrganizationProject } from '../core/entities/internal';
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
	 * Creates a contact with its new contact details and links it to projects that have no contact, for a caller who
	 * may create contacts but not edit them (see `toCreateOnlyContactInput`), in one transaction on the ORM the
	 * installation runs.
	 *
	 * The projects were read as unassigned before this runs, and another request can give one of them a contact in
	 * between. Saved through the contact's `projects` relation, the link would then move that project onto the new
	 * contact anyway: the cascade writes it whatever the row holds. So the contact is saved without its projects, and
	 * each project is claimed on the same transaction by one conditional statement that links it only while it is
	 * still a live project of the organization with no contact (#11601 review). When fewer rows are claimed than
	 * named, the transaction rolls back — the contact, its details and every link — and nothing is created.
	 *
	 * @param input The contact, with `organizationId`, `tenantId`, new contact details and the projects to link by id,
	 * as the create handler prepares it.
	 * @returns The contact created, with the projects it was linked to.
	 * @throws {ConflictException} When one of the projects was given a contact, or removed, since it was read.
	 */
	public async createClaimingProjects(input: IOrganizationContactCreateInput): Promise<IOrganizationContact> {
		const { projects = [], ...contact } = input;
		const projectIds = [...new Set(projects.map(({ id }) => id))];
		const scope = { tenantId: input.tenantId, organizationId: input.organizationId };

		// Every project named must have been claimed; the throw rolls the transaction back.
		const linkedTo = (created: IOrganizationContact, linked: number): IOrganizationContact => {
			if (linked < projectIds.length) {
				throw new ConflictException(
					'One of the projects was given a contact, or removed, while this contact was being created, so ' +
						'nothing was created. Choose again among the projects that have no contact.'
				);
			}
			return { ...created, projects: projectIds.map((id) => ({ id }) as IOrganizationProject) };
		};

		switch (this.ormType) {
			case MultiORMEnum.MikroORM:
				return await this.mikroOrmRepository.getEntityManager().transactional(async (em) => {
					// The CRUD base's create, which runs on this transaction: inside `transactional`, MikroORM resolves
					// the repository's entity manager to the transaction's fork. The new details are saved by the
					// contact's cascade.
					const created = await this.create(contact);
					return linkedTo(created, await this.mikroOrmClaimProjects(em, created.id, projectIds, scope));
				});
			case MultiORMEnum.TypeORM:
			default:
				// The checks the CRUD base's create runs before it writes; the write itself goes on the transaction's
				// manager, since the repository's would commit on a connection of its own.
				await this.assertNestedGraphNotForeign([contact], scope.tenantId);
				await this.assertInsideOrganizationBoundary([contact]);

				return await this.typeOrmRepository.manager.transaction(async (manager) => {
					let created: OrganizationContact;
					try {
						created = await manager.save(OrganizationContact, manager.create(OrganizationContact, contact));
					} catch (error) {
						if (error instanceof HttpException) {
							throw error;
						}
						console.error('Error creating an organization contact:', redactDatabaseError(error));
						throw new BadRequestException(toClientSafeError(error));
					}
					return linkedTo(created, await this.typeOrmClaimProjects(manager, created.id, projectIds, scope));
				});
		}
	}

	/**
	 * Links a new contact to the projects named, in one statement on the transaction's manager: only the live projects
	 * of the organization, in the tenant, that still have no contact are written.
	 *
	 * @param manager The transaction's manager.
	 * @param contactId The new contact.
	 * @param projectIds The projects to link.
	 * @param scope The tenant and organization of the contact.
	 * @returns How many projects were linked.
	 */
	private async typeOrmClaimProjects(
		manager: EntityManager,
		contactId: ID,
		projectIds: ID[],
		{ tenantId, organizationId }: { tenantId: ID; organizationId: ID }
	): Promise<number> {
		const result = await manager
			.createQueryBuilder()
			.update(OrganizationProject)
			.set({ organizationContactId: contactId })
			.where(
				p(
					`"id" IN (:...projectIds) AND "tenantId" = :tenantId AND "organizationId" = :organizationId ` +
						`AND "organizationContactId" IS NULL AND "deletedAt" IS NULL`
				),
				{ projectIds, tenantId, organizationId }
			)
			.execute();

		return result.affected ?? 0;
	}

	/**
	 * The MikroORM form of {@link typeOrmClaimProjects}, on the transaction's fork. The contact is written and matched
	 * through its relation, since `organizationContactId` is the relation's `persist: false` mirror; a native update
	 * does not stamp the update date, so it is stated.
	 *
	 * @param em The transaction's entity manager.
	 * @param contactId The new contact.
	 * @param projectIds The projects to link.
	 * @param scope The tenant and organization of the contact.
	 * @returns How many projects were linked.
	 */
	private async mikroOrmClaimProjects(
		em: MikroOrmEntityManager,
		contactId: ID,
		projectIds: ID[],
		{ tenantId, organizationId }: { tenantId: ID; organizationId: ID }
	): Promise<number> {
		return await em.nativeUpdate(
			OrganizationProject,
			{
				id: { $in: projectIds },
				tenantId,
				organizationId,
				organizationContact: null,
				deletedAt: null
			} as any,
			{ organizationContact: contactId, updatedAt: new Date() } as any
		);
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
