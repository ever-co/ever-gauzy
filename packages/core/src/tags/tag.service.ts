import { BadRequestException, Injectable } from '@nestjs/common';
import { Brackets, FindOptionsRelations, IsNull, SelectQueryBuilder, WhereExpressionBuilder } from 'typeorm';
import { isNotEmpty } from '@gauzy/common';
import { FileStorageProviderEnum, IPagination, ITag, ITagFindInput } from '@gauzy/contracts';
import { getConfig, isPostgres } from '@gauzy/config';
import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from '../core/crud';
import { Tag } from './tag.entity';
import { FileStorage } from './../core/file-storage';
import { prepareSQLQuery as p } from './../database/database.helper';
import { MikroOrmTagRepository } from './repository/mikro-orm-tag.repository';
import { TypeOrmTagRepository } from './repository/type-orm-tag.repository';

@Injectable()
export class TagService extends TenantAwareCrudService<Tag> {
	constructor(typeOrmTagRepository: TypeOrmTagRepository, mikroOrmTagRepository: MikroOrmTagRepository) {
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
			...(relations ? { relations: relations } : {})
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
			// Get the list of custom fields for the specified entity, defaulting to an empty array if none are found
			const customFields = getConfig().customFields?.['Tag'] ?? [];

			const query = this.typeOrmRepository.createQueryBuilder(this.tableName);
			// Define special criteria to find specific relations
			query.setFindOptions({
				...(relations ? { relations: relations } : {})
			});
			// Left join all relational tables with tag table
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
			query.leftJoin(`${query.alias}.requestApprovals`, 'requestApproval');
			query.leftJoin(`${query.alias}.tasks`, 'task');
			query.leftJoin(`${query.alias}.users`, 'user');
			query.leftJoin(`${query.alias}.warehouses`, 'warehouse');

			// Custom Entity Fields: Add left joins for each custom field if they exist
			if (customFields.length > 0) {
				customFields.forEach((field) => {
					if (field.relationType === 'many-to-many') {
						query.leftJoin(`${query.alias}.customFields.${field.propertyPath}`, field.propertyPath);
					}
				});
			}

			// Add new selection to the SELECT query
			query.select(`${query.alias}.*`);
			// Add the select statement for counting, and cast it to integer
			query.addSelect(p(`CAST(COUNT("candidate"."id") AS INTEGER)`), `candidate_counter`);
			query.addSelect(p(`CAST(COUNT("employee"."id") AS INTEGER)`), `employee_counter`);
			query.addSelect(p(`CAST(COUNT("employeeLevel"."id") AS INTEGER)`), `employee_level_counter`);
			query.addSelect(p(`CAST(COUNT("equipment"."id") AS INTEGER)`), `equipment_counter`);
			query.addSelect(p(`CAST(COUNT("eventType"."id") AS INTEGER)`), `event_type_counter`);
			query.addSelect(p(`CAST(COUNT("expense"."id") AS INTEGER)`), `expense_counter`);
			query.addSelect(p(`CAST(COUNT("income"."id") AS INTEGER)`), `income_counter`);
			query.addSelect(p(`CAST(COUNT("integration"."id") AS INTEGER)`), `integration_counter`);
			query.addSelect(p(`CAST(COUNT("invoice"."id") AS INTEGER)`), `invoice_counter`);
			query.addSelect(p(`CAST(COUNT("merchant"."id") AS INTEGER)`), `merchant_counter`);
			query.addSelect(p(`CAST(COUNT("organization"."id") AS INTEGER)`), `organization_counter`);
			query.addSelect(p(`CAST(COUNT("organizationContact"."id") AS INTEGER)`), `organization_contact_counter`);
			query.addSelect(
				p(`CAST(COUNT("organizationDepartment"."id") AS INTEGER)`),
				`organization_department_counter`
			);
			query.addSelect(
				p(`CAST(COUNT("organizationEmploymentType"."id") AS INTEGER)`),
				`organization_employment_type_counter`
			);
			query.addSelect(p(`CAST(COUNT("expenseCategory"."id") AS INTEGER)`), `expense_category_counter`);
			query.addSelect(p(`CAST(COUNT("organizationPosition"."id") AS INTEGER)`), `organization_position_counter`);
			query.addSelect(p(`CAST(COUNT("organizationProject"."id") AS INTEGER)`), `organization_project_counter`);
			query.addSelect(p(`CAST(COUNT("organizationTeam"."id") AS INTEGER)`), `organization_team_counter`);
			query.addSelect(p(`CAST(COUNT("organizationVendor"."id") AS INTEGER)`), `organization_vendor_counter`);
			query.addSelect(p(`CAST(COUNT("payment"."id") AS INTEGER)`), `payment_counter`);
			query.addSelect(p(`CAST(COUNT("product"."id") AS INTEGER)`), `product_counter`);
			query.addSelect(p(`CAST(COUNT("requestApproval"."id") AS INTEGER)`), `request_approval_counter`);
			query.addSelect(p(`CAST(COUNT("task"."id") AS INTEGER)`), `task_counter`);
			query.addSelect(p(`CAST(COUNT("user"."id") AS INTEGER)`), `user_counter`);
			query.addSelect(p(`CAST(COUNT("warehouse"."id") AS INTEGER)`), `warehouse_counter`);

			// Custom Entity Fields: Add select statements for each custom field if they exist
			if (customFields.length > 0) {
				customFields.forEach((field) => {
					if (field.relationType === 'many-to-many') {
						const selectionAliasName = `${field.propertyPath}_counter`;
						query.addSelect(`CAST(COUNT(${field.propertyPath}.id) AS INTEGER)`, selectionAliasName);
					}
				});
			}

			// Adds GROUP BY condition in the query builder.
			query.addGroupBy(`${query.alias}.id`);
			// Additionally you can add parameters used in where expression.
			query.where((qb: SelectQueryBuilder<Tag>) => {
				this.getFilterTagQuery(qb, input);
			});
			let items = await query.getRawMany();

			const store = new FileStorage().setProvider(FileStorageProviderEnum.LOCAL);
			items = items.map((item) => {
				if (item.icon) item.fullIconUrl = store.getProviderInstance().url(item.icon);
				return item;
			});
			const total = items.length;

			return { items, total };
		} catch (error) {
			console.log('Error while getting tags', error);
			throw new BadRequestException(error);
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
