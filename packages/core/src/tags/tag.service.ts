import { Brackets, IsNull, Repository, SelectQueryBuilder, WhereExpressionBuilder } from 'typeorm';
import { Tag } from './tag.entity';
import { CrudService, RequestContext } from '../core';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IPagination, ITag, ITagFindInput } from '@gauzy/contracts';

@Injectable()
export class TagService extends CrudService<Tag> {
	constructor(
		@InjectRepository(Tag)
		private readonly tagRepository: Repository<Tag>
	) {
		super(tagRepository);
	}

	async findOneByName(name: string): Promise<Tag> {
		const query = this.tagRepository
			.createQueryBuilder('tag')
			.where('"tag"."name" = :name', {
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
		const [ items, total ] = await this.tagRepository.findAndCount({
			relations: [
				...relations
			],
			where: (query: SelectQueryBuilder<Tag>) => {
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
						qb.andWhere(`"${query.alias}"."tenantId" = :tenantId`, {
							tenantId
						});
					})
				);
				query.andWhere(`"${query.alias}"."isSystem" = :isSystem`, {
					isSystem: false
				});
				console.log(query.getQueryAndParameters());
			}
		});
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
			.leftJoin(`tag.candidate`, 'candidate')
			.leftJoin('tag.employee', 'employee')
			.leftJoin('tag.employeeLevel', 'employeeLevel')
			.leftJoin('tag.equipment', 'equipment')
			.leftJoin('tag.eventType', 'eventType')
			.leftJoin('tag.expense', 'expense')
			.leftJoin('tag.income', 'income')
			.leftJoin('tag.integrations', 'integration')
			.leftJoin('tag.invoice', 'invoice')
			.leftJoin('tag.merchants', 'merchant')
			.leftJoin('tag.organizations', 'organization')
			.leftJoin('tag.organizationContact', 'organizationContact')
			.leftJoin('tag.organizationDepartment', 'organizationDepartment')
			.leftJoin('tag.organizationEmploymentType', 'organizationEmploymentType')
			.leftJoin('tag.expenseCategory', 'expenseCategory')
			.leftJoin('tag.organizationPosition', 'organizationPosition')
			.leftJoin('tag.organizationProject', 'organizationProject')
			.leftJoin('tag.organizationTeam', 'organizationTeam')
			.leftJoin('tag.organizationVendor', 'organizationVendor')
			.leftJoin('tag.payment', 'payment')
			.leftJoin('tag.product', 'product')
			.leftJoin('tag.proposal', 'proposal')
			.leftJoin('tag.requestApproval', 'requestApproval')
			.leftJoin('tag.task', 'task')
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
			.addSelect(`COUNT("expenseCategory"."id")`, `expense_category_counter`)
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
