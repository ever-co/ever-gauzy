import { JoinTable } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IEmployee, IOrganization, ISkill } from '@gauzy/contracts';
import {
	Employee,
	Organization,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { MultiORMColumn, MultiORMEntity, MultiORMManyToMany } from './../core/decorators/entity';
import { MikroOrmSkillRepository } from './repository/mikro-orm-skill.repository';

@MultiORMEntity('skill', { mikroOrmRepository: () => MikroOrmSkillRepository })
export class Skill extends TenantOrganizationBaseEntity implements ISkill {

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
		pivotTable: 'skill_employee',
		joinColumn: 'skillId',
		inverseJoinColumn: 'employeeId',
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
		pivotTable: 'skill_organization',
		joinColumn: 'skillId',
		inverseJoinColumn: 'organizationId',
	})
	@JoinTable({
		name: 'skill_organization'
	})
	organizations?: IOrganization[];
}
