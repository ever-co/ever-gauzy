import { Injectable } from '@nestjs/common';
import { Skill } from './skill.entity';
import { TenantAwareCrudService } from './../core/crud';
import { prepareSQLQuery as p } from './../database/database.helper';
import { MultiORMEnum } from './../core/utils';
import { MikroOrmSkillRepository } from './repository/mikro-orm-skill.repository';
import { TypeOrmSkillRepository } from './repository/type-orm-skill.repository';

@Injectable()
export class SkillService extends TenantAwareCrudService<Skill> {
	constructor(typeOrmSkillRepository: TypeOrmSkillRepository, mikroOrmSkillRepository: MikroOrmSkillRepository) {
		super(typeOrmSkillRepository, mikroOrmSkillRepository);
	}

	/**
	 * Finds a skill by its name.
	 *
	 * @param {string} name - The name of the skill to retrieve.
	 * @returns {Promise<Skill | null>} - A promise resolving to the skill entity if found, or `null` if not found.
	 */
	async findOneByName(name: string): Promise<Skill | null> {
		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				const item = await this.mikroOrmRepository.findOne({ name } as any);
				return item ? (this.serialize(item) as Skill) : null;
			}
			case MultiORMEnum.TypeORM:
			default:
				return await this.typeOrmRepository
					.createQueryBuilder('skill')
					.where(p(`"skill"."name" = :name`), { name })
					.getOne();
		}
	}
}
