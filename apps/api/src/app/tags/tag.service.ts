import { Repository } from 'typeorm';
import { Tag } from './tag.entity';
import { CrudService } from '../core';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

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

	async findTagsByOrgLevel(relations: any, orgId: any): Promise<any> {
		const allTags = await this.tagRepository.find({
			where: [{ organization: orgId }],
			relations: relations
		});
		return allTags;
	}
	async findTagsByTenantLevel(relations: any, tenantId: any): Promise<any> {
		const allTags = await this.tagRepository.find({
			where: [{ tenant: tenantId }],
			relations: relations
		});
		return allTags;
	}

	async getTagUsageCount(orgId: any): Promise<any> {
		const allTagsInOrg = await this.tagRepository
			.createQueryBuilder('tag')
			.select('*')
			.where('tag.organization = :organizationId', {
				organizationId: orgId
			})
			.getRawMany();

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
			.leftJoinAndSelect('tag.organizationClient', 'organizationClient')
			.leftJoinAndSelect('tag.product', 'product')
			.leftJoinAndSelect('tag.payment', 'payment')
			.where('tag.id IN (:...id)', { id: allTagsIds })
			.getMany();

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
}
