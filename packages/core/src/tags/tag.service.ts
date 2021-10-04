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

	async findTagsByOrgLevel(
		relations: string[],
		findInput: ITag
	): Promise<any> {
		const { organizationId, tenantId } = findInput;
		const allTags = await this.tagRepository.find({
			where: [{ organizationId, tenantId, isSystem: false }],
			relations: relations
		});
		return allTags;
	}
	async findTagsByTenantLevel(
		relations: string[],
		findInput: ITag
	): Promise<any> {
		const { tenantId } = findInput;
		const allTags = await this.tagRepository.find({
			where: [{ tenantId, isSystem: false }],
			relations: relations
		});
		return allTags;
	}

	async getTagUsageCount(organizationId: any): Promise<any> {
		const tenantId = RequestContext.currentTenantId();
		const tagCounterAllRelations = await this.tagRepository
			.createQueryBuilder('tag')
			.leftJoinAndSelect('tag.candidate', 'candidate')
			.leftJoinAndSelect('tag.employee', 'employee')
			.leftJoinAndSelect('tag.equipment', 'equipment')
			.leftJoinAndSelect('tag.eventType', 'eventType')
			.leftJoinAndSelect('tag.income', 'income')
			.leftJoinAndSelect('tag.expense', 'expense')
			.leftJoinAndSelect('tag.invoice', 'invoice')
			.leftJoinAndSelect('tag.task', 'task')
			.leftJoinAndSelect('tag.proposal', 'proposal')
			.leftJoinAndSelect('tag.organizationVendor', 'organizationVendor')
			.leftJoinAndSelect('tag.organizationTeam', 'organizationTeam')
			.leftJoinAndSelect('tag.organizationProject', 'organizationProject')
			.leftJoinAndSelect('tag.organizationPosition', 'organizationPosition')
			.leftJoinAndSelect('tag.expenseCategory', 'expenseCategory')
			.leftJoinAndSelect('tag.organizationEmploymentType', 'organizationEmploymentType')
			.leftJoinAndSelect('tag.employeeLevel', 'employeeLevel')
			.leftJoinAndSelect('tag.organizationDepartment', 'organizationDepartment')
			.leftJoinAndSelect('tag.organizationContact', 'organizationContact')
			.leftJoinAndSelect('tag.product', 'product')
			.leftJoinAndSelect('tag.payment', 'payment')
			.where((qb: SelectQueryBuilder<Tag>) => {
				qb.andWhere(`"tag"."tenantId" = :tenantId`, {
					tenantId
				});
				qb.andWhere(`"tag"."organizationId" = :organizationId`, {
					organizationId
				});
				qb.andWhere(`"tag"."isSystem" = :isSystem`, {
					isSystem: false
				});
			})
			.getMany();

		let tagWithCounter = {};
		const tagsWithCounter = [];

		for (
			let arrayIndex = 0;
			arrayIndex < tagCounterAllRelations.length;
			arrayIndex++
		) {
			tagWithCounter = {
				...tagCounterAllRelations[arrayIndex],
				counter:
					tagCounterAllRelations[arrayIndex].candidate.length +
					tagCounterAllRelations[arrayIndex].employee.length +
					tagCounterAllRelations[arrayIndex].equipment.length +
					tagCounterAllRelations[arrayIndex].eventType.length +
					tagCounterAllRelations[arrayIndex].income.length +
					tagCounterAllRelations[arrayIndex].expense.length +
					tagCounterAllRelations[arrayIndex].invoice.length +
					tagCounterAllRelations[arrayIndex].task.length +
					tagCounterAllRelations[arrayIndex].proposal.length +
					tagCounterAllRelations[arrayIndex].organizationVendor
						.length +
					tagCounterAllRelations[arrayIndex].organizationTeam.length +
					tagCounterAllRelations[arrayIndex].organizationProject
						.length +
					tagCounterAllRelations[arrayIndex].organizationPosition
						.length +
					tagCounterAllRelations[arrayIndex].expenseCategory.length +
					tagCounterAllRelations[arrayIndex]
						.organizationEmploymentType.length +
					tagCounterAllRelations[arrayIndex].employeeLevel.length +
					tagCounterAllRelations[arrayIndex].organizationDepartment
						.length +
					tagCounterAllRelations[arrayIndex].organizationContact
						.length +
					tagCounterAllRelations[arrayIndex].product.length +
					tagCounterAllRelations[arrayIndex].payment.length
			};
			tagsWithCounter.push(tagWithCounter);
		}

		return tagsWithCounter;
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
			.leftJoin('tag.equipment', 'equipment')
			.leftJoin('tag.eventType', 'eventType')
			.leftJoin('tag.income', 'income')
			.leftJoin('tag.expense', 'expense')
			.leftJoin('tag.invoice', 'invoice')
			.leftJoin('tag.task', 'task')
			.leftJoin('tag.proposal', 'proposal')
			.leftJoin('tag.organizationVendor', 'organizationVendor')
			.leftJoin('tag.organizationTeam', 'organizationTeam')
			.leftJoin('tag.organizationProject', 'organizationProject')
			.leftJoin('tag.organizationPosition', 'organizationPosition')
			.leftJoin('tag.expenseCategory', 'expenseCategory')
			.leftJoin('tag.organizationEmploymentType', 'organizationEmploymentType')
			.leftJoin('tag.employeeLevel', 'employeeLevel')
			.leftJoin('tag.organizationDepartment', 'organizationDepartment')
			.leftJoin('tag.organizationContact', 'organizationContact')
			.leftJoin('tag.product', 'product')
			.leftJoin('tag.payment', 'payment')
			.addSelect(`"tag"."name"`, `name`)
			.addSelect(`"tag"."color"`, `color`)
			.addSelect(`"tag"."description"`, `description`)
			.addSelect(`COUNT("candidate"."id")`, `candidate_counter`)
			.addSelect(`COUNT("employee"."id")`, `employee_counter`)
			.addSelect(`COUNT("equipment"."id")`, `equipment_counter`)
			.addSelect(`COUNT("eventType"."id")`, `event_type_counter`)
			.addSelect(`COUNT("income"."id")`, `income_counter`)
			.addSelect(`COUNT("expense"."id")`, `expense_counter`)
			.addSelect(`COUNT("invoice"."id")`, `invoice_counter`)
			.addSelect(`COUNT("task"."id")`, `task_counter`)
			.addSelect(`COUNT("proposal"."id")`, `proposal_counter`)
			.addSelect(`COUNT("organizationVendor"."id")`, `organization_vendor_counter`)
			.addSelect(`COUNT("organizationTeam"."id")`, `organization_team_counter`)
			.addSelect(`COUNT("organizationProject"."id")`, `organization_project_counter`)
			.addSelect(`COUNT("organizationPosition"."id")`, `organization_position_counter`)
			.addSelect(`COUNT("expenseCategory"."id")`, `expense_category_counter`)
			.addSelect(`COUNT("organizationEmploymentType"."id")`, `organization_employment_type_counter`)
			.addSelect(`COUNT("employeeLevel"."id")`, `employee_level_counter`)
			.addSelect(`COUNT("organizationDepartment"."id")`, `organization_department_counter`)
			.addSelect(`COUNT("organizationContact"."id")`, `organization_contact_counter`)
			.addSelect(`COUNT("product"."id")`, `product_counter`)
			.addSelect(`COUNT("payment"."id")`, `payment_counter`)
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
