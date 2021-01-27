import { Repository } from 'typeorm';
import { Skill } from './skill.entity';
import { CrudService } from '../core';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class SkillService extends CrudService<Skill> {
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
