import { Brackets, IsNull, Repository, SelectQueryBuilder, WhereExpressionBuilder } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IPagination, ITag, ITagFindInput } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { CrudService } from '../core/crud';
import { Tag } from './tag.entity';

@Injectable()
export class TagService extends CrudService<Tag> {
	constructor(
		@InjectRepository(Tag)
		private readonly tagRepository: Repository<Tag>
	) {
		super(tagRepository);
	}

	async findOneByName(name: string): Promise<Tag> {
		const query = this.tagRepository.createQueryBuilder();
		query.where('"tag"."name" = :name', {
			name
		});
		const item = await query.getOne();
		return item;
	}

	/**
	 * GET tenant/organization level tags
	 *
	 * @param input
	 * @param relations
	 * @returns
	 */
	async findAllTags(
		input: ITagFindInput,
		relations: string[]
	): Promise<IPagination<ITag>> {
		const query = this.tagRepository.createQueryBuilder();
		query.setFindOptions({
			relations
		});
		query.where((qb: SelectQueryBuilder<Tag>) => {
			qb.andWhere(
				new Brackets((web: WhereExpressionBuilder) => {
					const { organizationId } = input;
					web.where(
						[
							{
								organizationId: IsNull()
							},
							{
								organizationId
							}
						]
					);
				})
			);
			qb.andWhere(
				new Brackets((web: WhereExpressionBuilder) => {
					const tenantId = RequestContext.currentTenantId();
					web.andWhere(`"${qb.alias}"."tenantId" = :tenantId`, {
						tenantId
					});
				})
			);
			qb.andWhere(`"${qb.alias}"."isSystem" = :isSystem`, {
				isSystem: false
			});
		});
		const [ items, total ] = await query.getManyAndCount();
		return { items, total };
	}

	/**
	 * GET tenant/organization level tags
	 *
	 * @param input
	 * @param relations
	 * @returns
	 */
	async getTenantOrganizationLevelTags(
		input: ITagFindInput,
		relations: string[]
	): Promise<IPagination<ITag>> {
		const query = this.tagRepository.createQueryBuilder('tag');
		query
			.leftJoin(`tag.candidates`, 'candidate')
			.leftJoin('tag.employees', 'employee')
			.leftJoin('tag.employeeLevels', 'employeeLevel')
			.leftJoin('tag.equipments', 'equipment')
			.leftJoin('tag.eventTypes', 'eventType')
			.leftJoin('tag.expenses', 'expense')
			.leftJoin('tag.incomes', 'income')
			.leftJoin('tag.integrations', 'integration')
			.leftJoin('tag.invoices', 'invoice')
			.leftJoin('tag.merchants', 'merchant')
			.leftJoin('tag.organizations', 'organization')
			.leftJoin('tag.organizationContacts', 'organizationContact')
			.leftJoin('tag.organizationDepartments', 'organizationDepartment')
			.leftJoin('tag.organizationEmploymentTypes', 'organizationEmploymentType')
			.leftJoin('tag.expenseCategories', 'expenseCategorie')
			.leftJoin('tag.organizationPositions', 'organizationPosition')
			.leftJoin('tag.organizationProjects', 'organizationProject')
			.leftJoin('tag.organizationTeams', 'organizationTeam')
			.leftJoin('tag.organizationVendors', 'organizationVendor')
			.leftJoin('tag.payments', 'payment')
			.leftJoin('tag.products', 'product')
			.leftJoin('tag.proposals', 'proposal')
			.leftJoin('tag.requestApprovals', 'requestApproval')
			.leftJoin('tag.tasks', 'task')
			.leftJoin('tag.users', 'user')
			.leftJoin('tag.warehouses', 'warehouse')
			.select('tag.*')
			.addSelect(`COUNT("candidate"."id")`, `candidate_counter`)
			.addSelect(`COUNT("employee"."id")`, `employee_counter`)
			.addSelect(`COUNT("employeeLevel"."id")`, `employee_level_counter`)
			.addSelect(`COUNT("equipment"."id")`, `equipment_counter`)
			.addSelect(`COUNT("eventType"."id")`, `event_type_counter`)
			.addSelect(`COUNT("expense"."id")`, `expense_counter`)
			.addSelect(`COUNT("income"."id")`, `income_counter`)
			.addSelect(`COUNT("integration"."id")`, `integration_counter`)
			.addSelect(`COUNT("invoice"."id")`, `invoice_counter`)
			.addSelect(`COUNT("merchant"."id")`, `merchant_counter`)
			.addSelect(`COUNT("organization"."id")`, `organization_counter`)
			.addSelect(`COUNT("organizationContact"."id")`, `organization_contact_counter`)
			.addSelect(`COUNT("organizationDepartment"."id")`, `organization_department_counter`)
			.addSelect(`COUNT("organizationEmploymentType"."id")`, `organization_employment_type_counter`)
			.addSelect(`COUNT("expenseCategorie"."id")`, `expense_category_counter`)
			.addSelect(`COUNT("organizationPosition"."id")`, `organization_position_counter`)
			.addSelect(`COUNT("organizationProject"."id")`, `organization_project_counter`)
			.addSelect(`COUNT("organizationTeam"."id")`, `organization_team_counter`)
			.addSelect(`COUNT("organizationVendor"."id")`, `organization_vendor_counter`)
			.addSelect(`COUNT("payment"."id")`, `payment_counter`)
			.addSelect(`COUNT("product"."id")`, `product_counter`)
			.addSelect(`COUNT("proposal"."id")`, `proposal_counter`)
			.addSelect(`COUNT("requestApproval"."id")`, `request_approval_counter`)
			.addSelect(`COUNT("task"."id")`, `task_counter`)
			.addSelect(`COUNT("user"."id")`, `user_counter`)
			.addSelect(`COUNT("warehouse"."id")`, `warehouse_counter`)
			.addGroupBy('tag.id');

		// Add additional where conditions here
		const items = await query
			.where((query: SelectQueryBuilder<Tag>) => {
				query.andWhere(
					new Brackets((qb: WhereExpressionBuilder) => {
						const { organizationId } = input;
						qb.where(
							[
								{
									organizationId: IsNull()
								},
								{
									organizationId
								}
							]
						);
					})
				);
				query.andWhere(
					new Brackets((qb: WhereExpressionBuilder) => {
						const tenantId = RequestContext.currentTenantId();
						qb.andWhere(`"tag"."tenantId" = :tenantId`, {
							tenantId
						});
					})
				);
				query.andWhere(`"tag"."isSystem" = :isSystem`, {
					isSystem: false
				});
			})
			.getRawMany();

		const total = items.length;
		return { items, total };
	}
}
