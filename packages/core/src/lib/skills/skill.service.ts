import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Skill } from './skill.entity';
import { TenantAwareCrudService } from './../core/crud';
import { prepareSQLQuery as p } from './../database/database.helper';
import { MikroOrmSkillRepository } from './repository/mikro-orm-skill.repository';
import { TypeOrmSkillRepository } from './repository/type-orm-skill.repository';

@Injectable()
export class SkillService extends TenantAwareCrudService<Skill> {

	constructor(
		@InjectRepository(Skill)
		typeOrmSkillRepository: TypeOrmSkillRepository,

		mikroOrmSkillRepository: MikroOrmSkillRepository
	) {
		super(typeOrmSkillRepository, mikroOrmSkillRepository);
	}

	/**
	 *
	 * @param name
	 * @returns
	 */
	async findOneByName(name: string): Promise<Skill> {
		const query = this.typeOrmRepository.createQueryBuilder('skill').where(p(`"skill"."name" = :name`), {
			name
		});
		const item = await query.getOne();
		return item;
	}
}
