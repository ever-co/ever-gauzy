import { Injectable } from '@nestjs/common';
import { Skill } from './skill.entity';
import { TenantAwareCrudService } from './../core/crud';
import { prepareSQLQuery as p } from './../database/database.helper';
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
	 *
	 * @description
	 * This method queries the database to find a skill by its exact name.
	 * It uses TypeORM's QueryBuilder to construct a parameterized query.
	 *
	 * @example
	 * ```ts
	 * const skill = await skillService.findOneByName('JavaScript');
	 * console.log(skill);
	 * ```
	 */
	async findOneByName(name: string): Promise<Skill | null> {
		return await this.typeOrmRepository
			.createQueryBuilder('skill')
			.where(p(`"skill"."name" = :name`), { name })
			.getOne();
	}
}
