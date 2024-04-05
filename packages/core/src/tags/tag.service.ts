import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
	Brackets,
	FindOptionsRelations,
	IsNull,
	SelectQueryBuilder,
	WhereExpressionBuilder
} from 'typeorm';
import { isNotEmpty } from '@gauzy/common';
import { FileStorageProviderEnum, IPagination, ITag, ITagFindInput } from '@gauzy/contracts';
import { isPostgres } from '@gauzy/config';
import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from '../core/crud';
import { Tag } from './tag.entity';
import { FileStorage } from './../core/file-storage';
import { prepareSQLQuery as p } from './../database/database.helper';
import { MikroOrmTagRepository } from './repository/mikro-orm-tag.repository';
import { TypeOrmTagRepository } from './repository/type-orm-tag.repository';

@Injectable()
export class TagService extends TenantAwareCrudService<Tag> {
	constructor(
		@InjectRepository(Tag)
		typeOrmTagRepository: TypeOrmTagRepository,

		mikroOrmTagRepository: MikroOrmTagRepository
	) {
		super(typeOrmTagRepository, mikroOrmTagRepository);
	}

	/**
	 * GET tags by tenant or organization level
	 *
	 * @param input
	 * @param relations
	 * @returns
	 */
	async findTagsByLevel(input: ITagFindInput, relations: string[] = []): Promise<IPagination<ITag>> {
		const query = this.typeOrmRepository.createQueryBuilder(this.tableName);
		/**
		 * Defines a special criteria to find specific relations.
		 */
		query.setFindOptions({
			...(relations
				? {
					relations: relations
				}
				: {})
		});
		/**
		 * Additionally you can add parameters used in where expression.
		 */
		query.where((qb: SelectQueryBuilder<Tag>) => {
			this.getFilterTagQuery(qb, input);
		});
		const [items, total] = await query.getManyAndCount();
		return { items, total };
	}

	/**
	 * GET tenant/organization level tags
	 *
	 * @param input
	 * @param relations
	 * @returns
	 */
	async findTags(
		input: ITagFindInput,
		relations: string[] | FindOptionsRelations<Tag> = []
	): Promise<IPagination<ITag>> {
		try {
			const query = this.typeOrmRepository.createQueryBuilder(this.tableName);
			/**
			 * Defines a special criteria to find specific relations.
			 */
			query.setFindOptions({
				...(relations
					? {
						relations: relations
					}
					: {})
			});
			/**
			 * Left join all relational tables with tag table
			 */
			query.leftJoin(`${query.alias}.candidates`, 'candidate');
			query.leftJoin(`${query.alias}.employees`, 'employee');
			query.leftJoin(`${query.alias}.employeeLevels`, 'employeeLevel');
			query.leftJoin(`${query.alias}.equipments`, 'equipment');
			query.leftJoin(`${query.alias}.eventTypes`, 'eventType');
			query.leftJoin(`${query.alias}.expenses`, 'expense');
			query.leftJoin(`${query.alias}.incomes`, 'income');
			query.leftJoin(`${query.alias}.integrations`, 'integration');
			query.leftJoin(`${query.alias}.invoices`, 'invoice');
			query.leftJoin(`${query.alias}.merchants`, 'merchant');
			query.leftJoin(`${query.alias}.organizations`, 'organization');
			query.leftJoin(`${query.alias}.organizationContacts`, 'organizationContact');
			query.leftJoin(`${query.alias}.organizationDepartments`, 'organizationDepartment');
			query.leftJoin(`${query.alias}.organizationEmploymentTypes`, 'organizationEmploymentType');
			query.leftJoin(`${query.alias}.expenseCategories`, 'expenseCategory');
			query.leftJoin(`${query.alias}.organizationPositions`, 'organizationPosition');
			query.leftJoin(`${query.alias}.organizationProjects`, 'organizationProject');
			query.leftJoin(`${query.alias}.organizationTeams`, 'organizationTeam');
			query.leftJoin(`${query.alias}.organizationVendors`, 'organizationVendor');
			query.leftJoin(`${query.alias}.payments`, 'payment');
			query.leftJoin(`${query.alias}.products`, 'product');
			query.leftJoin(`${query.alias}.proposals`, 'proposal');
			query.leftJoin(`${query.alias}.requestApprovals`, 'requestApproval');
			query.leftJoin(`${query.alias}.tasks`, 'task');
			query.leftJoin(`${query.alias}.users`, 'user');
			query.leftJoin(`${query.alias}.warehouses`, 'warehouse');
			/**
			 * Adds new selection to the SELECT query.
			 */
			query.select(`${query.alias}.*`);
			query.addSelect(p(`COUNT("candidate"."id")`), `candidate_counter`);
			query.addSelect(p(`COUNT("employee"."id")`), `employee_counter`);
			query.addSelect(p(`COUNT("employeeLevel"."id")`), `employee_level_counter`);
			query.addSelect(p(`COUNT("equipment"."id")`), `equipment_counter`);
			query.addSelect(p(`COUNT("eventType"."id")`), `event_type_counter`);
			query.addSelect(p(`COUNT("expense"."id")`), `expense_counter`);
			query.addSelect(p(`COUNT("income"."id")`), `income_counter`);
			query.addSelect(p(`COUNT("integration"."id")`), `integration_counter`);
			query.addSelect(p(`COUNT("invoice"."id")`), `invoice_counter`);
			query.addSelect(p(`COUNT("merchant"."id")`), `merchant_counter`);
			query.addSelect(p(`COUNT("organization"."id")`), `organization_counter`);
			query.addSelect(p(`COUNT("organizationContact"."id")`), `organization_contact_counter`);
			query.addSelect(p(`COUNT("organizationDepartment"."id")`), `organization_department_counter`);
			query.addSelect(p(`COUNT("organizationEmploymentType"."id")`), `organization_employment_type_counter`);
			query.addSelect(p(`COUNT("expenseCategory"."id")`), `expense_category_counter`);
			query.addSelect(p(`COUNT("organizationPosition"."id")`), `organization_position_counter`);
			query.addSelect(p(`COUNT("organizationProject"."id")`), `organization_project_counter`);
			query.addSelect(p(`COUNT("organizationTeam"."id")`), `organization_team_counter`);
			query.addSelect(p(`COUNT("organizationVendor"."id")`), `organization_vendor_counter`);
			query.addSelect(p(`COUNT("payment"."id")`), `payment_counter`);
			query.addSelect(p(`COUNT("product"."id")`), `product_counter`);
			query.addSelect(p(`COUNT("proposal"."id")`), `proposal_counter`);
			query.addSelect(p(`COUNT("requestApproval"."id")`), `request_approval_counter`);
			query.addSelect(p(`COUNT("task"."id")`), `task_counter`);
			query.addSelect(p(`COUNT("user"."id")`), `user_counter`);
			query.addSelect(p(`COUNT("warehouse"."id")`), `warehouse_counter`);
			/**
			 * Adds GROUP BY condition in the query builder.
			 */
			query.addGroupBy(`${query.alias}.id`);
			/**
			 * Additionally you can add parameters used in where expression.
			 */
			query.where((qb: SelectQueryBuilder<Tag>) => {
				this.getFilterTagQuery(qb, input);
			});
			let items = await query.getRawMany();
			const store = new FileStorage();
			store.setProvider(FileStorageProviderEnum.LOCAL);
			items = items.map((item) => {
				if (item.icon) {
					item.fullIconUrl = store.getProviderInstance().url(item.icon);
				}

				return item;
			});
			const total = items.length;
			return { items, total };
		} catch (error) {
			console.log('Error while getting tags', error);
		}
	}

	/**
	 * Get filter query for tags
	 *
	 * @param query
	 * @param request
	 * @returns
	 */
	getFilterTagQuery(query: SelectQueryBuilder<Tag>, request: ITagFindInput): SelectQueryBuilder<Tag> {
		const tenantId = RequestContext.currentTenantId() || request.tenantId;
		const { organizationId, organizationTeamId, name, color, description } = request;
		const likeOperator = isPostgres() ? 'ILIKE' : 'LIKE';

		query.andWhere(
			new Brackets((qb: WhereExpressionBuilder) => {
				qb.andWhere(p(`"${query.alias}"."tenantId" = :tenantId`), { tenantId });
			})
		);
		query.andWhere(
			new Brackets((qb: WhereExpressionBuilder) => {
				qb.where([
					{
						organizationId: IsNull()
					},
					{
						organizationId
					}
				]);
			})
		);
		query.andWhere(
			new Brackets((qb: WhereExpressionBuilder) => {
				if (isNotEmpty(organizationTeamId)) {
					qb.andWhere(p(`"${query.alias}"."organizationTeamId" = :organizationTeamId`), {
						organizationTeamId
					});
				}
			})
		);
		query.andWhere(p(`"${query.alias}"."isSystem" = :isSystem`), {
			isSystem: false
		});
		/**
		 * Additionally you can add parameters used in where expression.
		 */
		if (isNotEmpty(name)) {
			query.andWhere(p(`"${query.alias}"."name" ${likeOperator} :name`), {
				name: `%${name}%`
			});
		}
		if (isNotEmpty(color)) {
			query.andWhere(p(`"${query.alias}"."color" ${likeOperator} :color`), {
				color: `%${color}%`
			});
		}
		if (isNotEmpty(description)) {
			query.andWhere(p(`"${query.alias}"."description" ${likeOperator} :description`), {
				description: `%${description}%`
			});
		}
		return query;
	}
}
