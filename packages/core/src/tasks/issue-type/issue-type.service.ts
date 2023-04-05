import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeleteResult, Repository, SelectQueryBuilder } from 'typeorm';
import {
	IIssueType,
	IIssueTypeCreateInput,
	IIssueTypeFindInput,
	IOrganization,
	IPagination,
	ITenant,
} from '@gauzy/contracts';
import { IssueType } from './issue-type.entity';
import { TaskStatusPrioritySizeService } from './../task-status-priority-size.service';
import { DEFAULT_GLOBAL_ISSUE_TYPES } from './default-global-issue-types';
import { RequestContext } from './../../core/context';

@Injectable()
export class IssueTypeService extends TaskStatusPrioritySizeService<IssueType> {
	constructor(
		@InjectRepository(IssueType)
		protected readonly issueTypeRepository: Repository<IssueType>
	) {
		super(issueTypeRepository);
	}

	/**
	 * Few issue types can't be removed/delete because they are global
	 *
	 * @param id
	 * @returns
	 */
	async delete(id: IIssueType['id']): Promise<DeleteResult> {
		return await super.delete(id, {
			where: {
				isSystem: false,
			},
		});
	}

	/**
	 * GET issue types by filters
	 * If parameters not match, retrieve global issue types
	 *
	 * @param params
	 * @returns
	 */
	async findAllIssueTypes(
		params: IIssueTypeFindInput
	): Promise<IPagination<IIssueType>> {
		try {
			/**
			 * Find at least one record or get global records
			 */
			const cqb = this.repository.createQueryBuilder(this.alias);
			cqb.where((qb: SelectQueryBuilder<IssueType>) => {
				this.getFilterQuery(qb, params);
			});
			await cqb.getOneOrFail();

			/**
			 * Find task issue types for given params
			 */
			const query = this.repository.createQueryBuilder(this.alias).setFindOptions({
				relations: {
					image: true
				}
			});
			query.where((qb: SelectQueryBuilder<IssueType>) => {
				this.getFilterQuery(qb, params);
			});
			const [items, total] = await query.getManyAndCount();
			return { items, total };
		} catch (error) {
			return await this.getDefaultEntities();
		}
	}

	/**
	 * Create bulk issue type for tenants
	 *
	 * @param tenants '
	 */
	async bulkCreateTenantsIssueTypes(
		tenants: ITenant[]
	): Promise<IIssueType[]> {
		try {
			const issueTypes: IIssueType[] = [];

			for (const tenant of tenants) {
				for (const issueType of DEFAULT_GLOBAL_ISSUE_TYPES) {
					const create = this.repository.create({
						...issueType,
						icon: `ever-icons/${issueType.icon}`,
						tenant,
						isSystem: false,
					});
					issueTypes.push(create);
				}
			}

			return await this.repository.save(issueTypes);
		} catch (error) {
			console.log('error', error);
			throw new BadRequestException(error);
		}
	}

	/**
	 * Create bulk issue types for organization
	 *
	 * @param organization
	 */
	async bulkCreateOrganizationIssueType(
		organization: IOrganization
	): Promise<IIssueType[]> {
		try {
			const tenantId = RequestContext.currentTenantId();

			const issueTypes: IIssueType[] = [];
			const { items = [] } = await this.findAllIssueTypes({
				tenantId,
			});

			for (const item of items) {
				const { name, value, description, icon, color } = item;

				const create = this.repository.create({
					tenantId,
					name,
					value,
					description,
					icon,
					color,
					organization,
					isSystem: false,
				});
				issueTypes.push(create);
			}
			return await this.repository.save(issueTypes);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	/**
	 * Create bulk issue type for specific organization entity
	 *
	 * @param entity
	 * @returns
	 */
	async createBulkIssueTypeByEntity(
		entity: Partial<IIssueTypeCreateInput>
	): Promise<IIssueType[]> {
		try {
			const { organizationId } = entity;
			const tenantId = RequestContext.currentTenantId();

			const issueTypes: IIssueType[] = [];
			const { items = [] } = await this.findAllIssueTypes({
				tenantId,
				organizationId,
			});

			for (const item of items) {
				const { name, value, description, icon, color } = item;

				const issueType = await this.create({
					...entity,
					name,
					value,
					description,
					icon,
					color,
					isSystem: false,
				});
				issueTypes.push(issueType);
			}

			return issueTypes;
		} catch (error) {
			console.log('error', error);
			throw new BadRequestException(error);
		}
	}
}
