import { MikroInjectRepository } from '@gauzy/common';
import { EntityRepository } from '@mikro-orm/core';
import { Repository } from 'typeorm';
import { Skill } from './skill.entity';
import { TenantAwareCrudService } from './../core/crud';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { prepareSQLQuery as p } from './../database/database.helper';

@Injectable()
export class SkillService extends TenantAwareCrudService<Skill> {
	constructor(
		@InjectRepository(Skill)
		skillRepository: Repository<Skill>,
		@MikroInjectRepository(Skill)
		mikroSkillRepository: EntityRepository<Skill>
	) {
		super(skillRepository, mikroSkillRepository);
	}

	async findOneByName(name: string): Promise<Skill> {
		const query = this.repository.createQueryBuilder('skill').where(p(`"skill"."name" = :name`), {
			name
		});
		const item = await query.getOne();
		return item;
	}
}
