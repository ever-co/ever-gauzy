import { IOrganizationContact } from '@gauzy/contracts';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from './../core/crud';
import { OrganizationContact } from './organization-contact.entity';

@Injectable()
export class OrganizationContactService extends TenantAwareCrudService<OrganizationContact> {
	constructor(
		@InjectRepository(OrganizationContact)
		private readonly organizationContactRepository: Repository<OrganizationContact>
	) {
		super(organizationContactRepository);
	}

	async findByEmployee(id: string, data: any): Promise<any> {
		const { findInput = null } = data;
		const query = this.organizationContactRepository
			.createQueryBuilder('organization_contact')
			.leftJoin('organization_contact.members', 'member')
			.where('member.id = :id', { id });

		if (findInput) {
			const { organizationId, tenantId } = findInput;
			query
				.andWhere(`${query.alias}.organizationId = :organizationId`, {
					organizationId
				})
				.andWhere(`${query.alias}.tenantId = :tenantId`, {
					tenantId
				});
		}
		return await query.getMany();
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
}
