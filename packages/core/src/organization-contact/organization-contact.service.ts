import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Raw, Repository, WhereExpressionBuilder } from 'typeorm';
import { IEmployee, IOrganizationContact, IOrganizationContactFindInput, IPagination } from '@gauzy/contracts';
import { isNotEmpty } from '@gauzy/common';
import { RequestContext } from '../core/context';
import { PaginationParams, TenantAwareCrudService } from './../core/crud';
import { OrganizationContact } from './organization-contact.entity';

@Injectable()
export class OrganizationContactService extends TenantAwareCrudService<OrganizationContact> {
	constructor(
		@InjectRepository(OrganizationContact)
		private readonly organizationContactRepository: Repository<OrganizationContact>
	) {
		super(organizationContactRepository);
	}

	/**
	 * Find employee assigned contacts
	 *
	 * @param employeeId
	 * @param options
	 * @returns
	 */
	async findByEmployee(
		employeeId: IEmployee['id'],
		options: IOrganizationContactFindInput
	): Promise<IOrganizationContact[]> {
		try {
			const query = this.repository.createQueryBuilder(this.alias);
			query.setFindOptions({
				select: {
					id: true,
					name: true,
					imageUrl: true
				}
			});
			query.innerJoin(`${query.alias}.members`, 'member');
			query.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					const tenantId = RequestContext.currentTenantId();
					const { organizationId, contactType } = options;

					qb.andWhere('member.id = :employeeId', { employeeId });
					qb.andWhere(`"${query.alias}"."tenantId" = :tenantId`, { tenantId });
					qb.andWhere(`"${query.alias}"."organizationId" = :organizationId`, { organizationId });

					if (isNotEmpty(contactType)) {
						qb.andWhere(`${query.alias}.contactType = :contactType`, { contactType });
					}
				})
			);
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
		const { tenantId, id: createdBy } = RequestContext.currentUser();

		const query = this.organizationContactRepository.createQueryBuilder(
			'organization_contact'
		);
		if (relations.length > 0) {
			relations.forEach((relation: string) => {
				if (relation.indexOf('.') !== -1) {
					const alias = relation.split('.').slice(-1)[0];
					query.leftJoinAndSelect(`${relation}`, alias);
				} else {
					const alias = relation;
					query.leftJoinAndSelect(
						`${query.alias}.${relation}`,
						alias
					);
				}
			});
		}
		query.where(
			new Brackets((subQuery) => {
				subQuery
					.where('members.id =:employeeId', { employeeId })
					.orWhere(`${query.alias}.createdBy = :createdBy`, {
						createdBy
					});
			})
		);
		query.andWhere(`${query.alias}.contactType = :contactType`, {
			contactType
		});
		if (organizationId) {
			query.andWhere(`${query.alias}.organizationId = :organizationId`, {
				organizationId
			});
		}
		query.andWhere(`${query.alias}.tenantId = :tenantId`, {
			tenantId
		});

		const [items, total] = await query.getManyAndCount();
		return { items, total };
	}

	async findById(
		id: string,
		relations: string[]
	): Promise<IOrganizationContact> {
        return await this.findOneByIdString(id, { relations });
    }

	/**
	 * Organization contact by pagination
	 *
	 * @param filter
	 * @returns
	 */
	public async pagination(
		filter?: PaginationParams<any>
	): Promise<IPagination<IOrganizationContact>> {
		// Custom Filters
		if ('where' in filter) {
			const { where } = filter;
			if ('name' in where) {
				const { name } = where;
				filter['where']['name'] = Raw((alias) => `${alias} ILIKE '%${name}%'`);
			}
			if ('primaryPhone' in where) {
				const { primaryPhone } = where;
				filter['where']['primaryPhone'] = Raw((alias) => `${alias} ILIKE '%${primaryPhone}%'`);
			}
			if ('primaryEmail' in where) {
				const { primaryEmail } = where;
				filter['where']['primaryEmail'] = Raw((alias) => `${alias} ILIKE '%${primaryEmail}%'`);
			}
			if ('members' in where) {
				const { members } = where;
				filter['where']['members'] = {
					id: In(members)
				}
			}
		}
		return await super.paginate(filter);
	}
}
