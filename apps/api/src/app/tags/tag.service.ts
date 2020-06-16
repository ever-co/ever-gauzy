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
		const query = await this.tagRepository
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
			.where('tag.id IN (:...id)', { id: allTagsIds })
			.getMany();

		let tagWithCounter = {};
		const tagsWithCounter = [];

		for (
			let arrayIndex = 0;
			arrayIndex < allTagsInOrg.length;
			arrayIndex++
		) {
			tagWithCounter = [];
			tagWithCounter = {
				...tagCounterAllRelations[arrayIndex],
				counter:
					tagCounterAllRelations[arrayIndex].candidate.length +
					tagCounterAllRelations[arrayIndex].employee.length +
					tagCounterAllRelations[arrayIndex].equipment.length +
					tagCounterAllRelations[arrayIndex].eventType.length +
					tagCounterAllRelations[arrayIndex].income.length +
					tagCounterAllRelations[arrayIndex].invoice.length
			};
			tagsWithCounter.push(tagWithCounter);
		}

		return tagsWithCounter;
	}
}
