import { JoinTable } from 'typeorm';
import { IEmployee, IOrganization, ISkill } from '@gauzy/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	Employee,
	Organization,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { MultiORMColumn, MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmSkillRepository } from './repository/mikro-orm-skill.repository';
import { MultiORMManyToMany } from '../core/decorators/entity/relations';

@MultiORMEntity('skill', { mikroOrmRepository: () => MikroOrmSkillRepository })
export class Skill extends TenantOrganizationBaseEntity
	implements ISkill {

	@ApiProperty({ type: () => String })
	@MultiORMColumn()
	name?: string;

	@ApiPropertyOptional({ type: () => String })
	@MultiORMColumn({ nullable: true })
	description?: string;

	@ApiProperty({ type: () => String })
	@MultiORMColumn()
	color?: string;

	/*
	|--------------------------------------------------------------------------
	| @ManyToMany
	|--------------------------------------------------------------------------
	*/

	/**
	 * employees skills
	 */
	@MultiORMManyToMany(() => Employee, (employee) => employee.skills, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE',
		owner: true,
		pivotTable: 'skill_employee'
	})
	@JoinTable({
		name: 'skill_employee'
	})
	employees?: IEmployee[];

	/**
	 * organizations skills
	 */
	@MultiORMManyToMany(() => Organization, (organization) => organization.skills, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE',
		owner: true,
		pivotTable: 'skill_organization'
	})
	@JoinTable({
		name: 'skill_organization'
	})
	organizations?: IOrganization[];
}
