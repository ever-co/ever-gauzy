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
		const query = await this.repository
			.createQueryBuilder('tag')
			.where('"tag"."name" = :name', {
				name
			});
		const item = await query.getOne();
		return item;
	}

	async findTagsByOrgLevel(relations: any, orgId: any): Promise<any> {
		const allTags = await this.repository.find({
			where: [{ organization: orgId }],
			relations: relations
		});
		return allTags;
	}
	async findTagsByTenantLevel(relations: any, tenantId: any): Promise<any> {
		const allTags = await this.repository.find({
			where: [{ tenant: tenantId }],
			relations: relations
		});
		return allTags;
	}
}
