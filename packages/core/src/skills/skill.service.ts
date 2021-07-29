import { Repository } from 'typeorm';
import { Skill } from './skill.entity';
import { TenantAwareCrudService } from './../core/crud';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class SkillService extends TenantAwareCrudService<Skill> {
	constructor(
		@InjectRepository(Skill)
		private readonly skillRepository: Repository<Skill>
	) {
		super(skillRepository);
	}

	async findOneByName(name: string): Promise<Skill> {
		const query = this.repository
			.createQueryBuilder('skill')
			.where('"skill"."name" = :name', {
				name
			});
		const item = await query.getOne();
		return item;
	}
}
