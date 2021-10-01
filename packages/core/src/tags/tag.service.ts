import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
	Brackets,
	IsNull,
	Repository,
	SelectQueryBuilder,
	WhereExpressionBuilder
} from 'typeorm';
import { IPagination, ITag, ITagFindInput } from '@gauzy/contracts';
import { Tag } from './tag.entity';
import { CrudService } from './../core/crud';
import { RequestContext } from './../core/context';

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

		const allTagsInOrg = await this.tagRepository
			.createQueryBuilder('tag')
			.select('*')
			.where('tag.organization = :organizationId', {
				organizationId
			})
			.andWhere('tag.tenantId = :tenantId', {
				tenantId
			})
			.andWhere('tag.isSystem = :action', {
				action: false
			})
			.getRawMany();

		console.log(allTagsInOrg, 'allTagsInOrg');

		const allTagsIds = [];
		allTagsInOrg.forEach((tag) => allTagsIds.push(tag.id));

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
			.leftJoinAndSelect(
				'tag.organizationPosition',
				'organizationPosition'
			)
			.leftJoinAndSelect('tag.expenseCategory', 'expenseCategory')
			.leftJoinAndSelect(
				'tag.organizationEmploymentType',
				'organizationEmploymentType'
			)
			.leftJoinAndSelect('tag.employeeLevel', 'employeeLevel')
			.leftJoinAndSelect(
				'tag.organizationDepartment',
				'organizationDepartment'
			)
			.leftJoinAndSelect('tag.organizationContact', 'organizationContact')
			.leftJoinAndSelect('tag.product', 'product')
			.leftJoinAndSelect('tag.payment', 'payment')
			.where('tag.id IN (:...id)', { id: allTagsIds })
			.andWhere('tag.isSystem = :action', { action: false })
			.getMany();

		console.log(tagCounterAllRelations, 'tagCounterAllRelations');

		let tagWithCounter = {};
		const tagsWithCounter = [];

		for (
			let arrayIndex = 0;
			arrayIndex < allTagsInOrg.length;
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
		// const query = this.tagRepository.createQueryBuilder('tag');
		// await query
		// 	.leftJoin('tag.candidate', 'candidate')
		// 	.leftJoin('tag.employee', 'employee')
		// 	.leftJoin('tag.equipment', 'equipment')
		// 	.leftJoin('tag.eventType', 'eventType')
		// 	.leftJoin('tag.income', 'income')
		// 	.leftJoin('tag.expense', 'expense')
		// 	.leftJoin('tag.invoice', 'invoice')
		// 	.leftJoin('tag.task', 'task')
		// 	.leftJoin('tag.proposal', 'proposal')
		// 	.leftJoin('tag.organizationVendor', 'organizationVendor')
		// 	.leftJoin('tag.organizationTeam', 'organizationTeam')
		// 	.leftJoin('tag.organizationProject', 'organizationProject')
		// 	.leftJoin('tag.organizationPosition', 'organizationPosition')
		// 	.leftJoin('tag.expenseCategory', 'expenseCategory')
		// 	.leftJoin('tag.organizationEmploymentType', 'organizationEmploymentType')
		// 	.leftJoin('tag.employeeLevel', 'employeeLevel')
		// 	.leftJoin( 'tag.organizationDepartment', 'organizationDepartment')
		// 	.leftJoin('tag.organizationContact', 'organizationContact')
		// 	.leftJoin('tag.product', 'product')
		// 	.leftJoin('tag.payment', 'payment')
		// 	.andWhere(
		// 		new Brackets((qb: WhereExpressionBuilder) => { 
		// 			const { organizationId } = input;
		// 			qb.where(
		// 				[
		// 					{
		// 						organizationId: IsNull()
		// 					}, 
		// 					{
		// 						organizationId
		// 					}
		// 				]
		// 			);
		// 		})
		// 	)
		// 	.andWhere(
		// 		new Brackets((qb: WhereExpressionBuilder) => {
		// 			const tenantId = RequestContext.currentTenantId();
		// 			qb.andWhere(`"${query.alias}"."tenantId" = :tenantId`, {
		// 				tenantId
		// 			});
		// 		})
		// 	)
		// 	.andWhere(`"${query.alias}"."isSystem" = :isSystem`, {
		// 		isSystem: false
		// 	});
		const [ items, total ] = await this.tagRepository.findAndCount({
			join: {
				alias: 'tag',
				leftJoin: {
					candidate: 'tag.candidate',
					invoice: 'tag.invoice'
				}
			},
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
		console.log({ items, total });
		return { items, total };
	}
}
