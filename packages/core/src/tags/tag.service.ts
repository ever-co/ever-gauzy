import {
	Brackets,
	FindOptionsRelations,
	IsNull,
	Repository,
	SelectQueryBuilder,
	WhereExpressionBuilder
} from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IPagination, ITag, ITagFindInput } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from '../core/crud';
import { Tag } from './tag.entity';
import { isNotEmpty } from '@gauzy/common';

@Injectable()
export class TagService extends TenantAwareCrudService<Tag> {
	constructor(
		@InjectRepository(Tag)
		private readonly tagRepository: Repository<Tag>
	) {
		super(tagRepository);
	}

	/**
	 * GET tags by tenant or organization level
	 *
	 * @param input
	 * @param relations
	 * @returns
	 */
	async findTagsByLevel(input: ITagFindInput, relations: string[] = []): Promise<IPagination<ITag>> {
		const query = this.tagRepository.createQueryBuilder(this.alias);
		/**
		 * Defines a special criteria to find specific reltaions.
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
			const query = this.tagRepository.createQueryBuilder(this.alias);
			/**
			 * Defines a special criteria to find specific reltaions.
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
			query.addSelect(`COUNT("candidate"."id")`, `candidate_counter`);
			query.addSelect(`COUNT("employee"."id")`, `employee_counter`);
			query.addSelect(`COUNT("employeeLevel"."id")`, `employee_level_counter`);
			query.addSelect(`COUNT("equipment"."id")`, `equipment_counter`);
			query.addSelect(`COUNT("eventType"."id")`, `event_type_counter`);
			query.addSelect(`COUNT("expense"."id")`, `expense_counter`);
			query.addSelect(`COUNT("income"."id")`, `income_counter`);
			query.addSelect(`COUNT("integration"."id")`, `integration_counter`);
			query.addSelect(`COUNT("invoice"."id")`, `invoice_counter`);
			query.addSelect(`COUNT("merchant"."id")`, `merchant_counter`);
			query.addSelect(`COUNT("organization"."id")`, `organization_counter`);
			query.addSelect(`COUNT("organizationContact"."id")`, `organization_contact_counter`);
			query.addSelect(`COUNT("organizationDepartment"."id")`, `organization_department_counter`);
			query.addSelect(`COUNT("organizationEmploymentType"."id")`, `organization_employment_type_counter`);
			query.addSelect(`COUNT("expenseCategory"."id")`, `expense_category_counter`);
			query.addSelect(`COUNT("organizationPosition"."id")`, `organization_position_counter`);
			query.addSelect(`COUNT("organizationProject"."id")`, `organization_project_counter`);
			query.addSelect(`COUNT("organizationTeam"."id")`, `organization_team_counter`);
			query.addSelect(`COUNT("organizationVendor"."id")`, `organization_vendor_counter`);
			query.addSelect(`COUNT("payment"."id")`, `payment_counter`);
			query.addSelect(`COUNT("product"."id")`, `product_counter`);
			query.addSelect(`COUNT("proposal"."id")`, `proposal_counter`);
			query.addSelect(`COUNT("requestApproval"."id")`, `request_approval_counter`);
			query.addSelect(`COUNT("task"."id")`, `task_counter`);
			query.addSelect(`COUNT("user"."id")`, `user_counter`);
			query.addSelect(`COUNT("warehouse"."id")`, `warehouse_counter`);
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
			const items = await query.getRawMany();
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
		const { organizationId, name, color, description } = request;
		query.andWhere(
			new Brackets((qb: WhereExpressionBuilder) => {
				qb.andWhere(`"${query.alias}"."tenantId" = :tenantId`, {
					tenantId: RequestContext.currentTenantId()
				});
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
		query.andWhere(`"${query.alias}"."isSystem" = :isSystem`, {
			isSystem: false
		});
		/**
		 * Additionally you can add parameters used in where expression.
		 */
		if (isNotEmpty(name)) {
			query.andWhere(`"${query.alias}"."name" ILIKE :name`, {
				name: `%${name}%`
			});
		}
		if (isNotEmpty(color)) {
			query.andWhere(`"${query.alias}"."color" ILIKE :color`, {
				color: `%${color}%`
			});
		}
		if (isNotEmpty(description)) {
			query.andWhere(`"${query.alias}"."description" ILIKE :description`, {
				description: `%${description}%`
			});
		}
		return query;
	}
}
