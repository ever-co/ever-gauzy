import { BadRequestException, Injectable } from '@nestjs/common';
import { Brackets, In, Raw, WhereExpressionBuilder } from 'typeorm';
import { IEmployee, IOrganizationContact, IOrganizationContactFindInput, IPagination } from '@gauzy/contracts';
import { isPostgres } from '@gauzy/config';
import { isNotEmpty } from '@gauzy/common';
import { RequestContext } from '../core/context';
import { PaginationParams, TenantAwareCrudService } from './../core/crud';
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
	async findByEmployee(
		employeeId: IEmployee['id'],
		options: IOrganizationContactFindInput
	): Promise<IOrganizationContact[]> {
		try {
			const query = this.typeOrmRepository.createQueryBuilder(this.tableName);
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

					qb.andWhere(p('member.id = :employeeId'), { employeeId });
					qb.andWhere(p(`"${query.alias}"."tenantId" = :tenantId`), { tenantId });
					qb.andWhere(p(`"${query.alias}"."organizationId" = :organizationId`), { organizationId });

					if (isNotEmpty(contactType)) {
						qb.andWhere(p(`${query.alias}.contactType = :contactType`), { contactType });
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

	async findById(id: string, relations: string[]): Promise<IOrganizationContact> {
		return await this.findOneByIdString(id, { relations });
	}

	/**
	 * Organization contact by pagination
	 *
	 * @param params
	 * @returns
	 */
	public async pagination(params?: PaginationParams<any>): Promise<IPagination<IOrganizationContact>> {
		// Custom Filters
		if ('where' in params) {
			const likeOperator = isPostgres() ? 'ILIKE' : 'LIKE';
			const { where } = params;
			if ('name' in where) {
				const { name } = where;
				params['where']['name'] = Raw((alias) => `${alias} ${likeOperator} '%${name}%'`);
			}
			if ('primaryPhone' in where) {
				const { primaryPhone } = where;
				params['where']['primaryPhone'] = Raw((alias) => `${alias} ${likeOperator} '%${primaryPhone}%'`);
			}
			if ('primaryEmail' in where) {
				const { primaryEmail } = where;
				params['where']['primaryEmail'] = Raw((alias) => `${alias} ${likeOperator} '%${primaryEmail}%'`);
			}
			if ('members' in where) {
				const { members } = where;
				params['where']['members'] = {
					id: In(members)
				};
			}
		}
		return await super.paginate(params);
	}
}
