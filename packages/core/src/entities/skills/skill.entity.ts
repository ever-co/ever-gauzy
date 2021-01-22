import { Entity, Column, Unique, ManyToMany, JoinTable } from 'typeorm';
import { DeepPartial, IEmployee, ISkill } from '@gauzy/common';
import { ApiProperty } from '@nestjs/swagger';
import { Employee, TenantOrganizationBaseEntity } from '../internal';

@Entity('skill')
@Unique(['name'])
export class Skill extends TenantOrganizationBaseEntity implements ISkill {
	constructor(input?: DeepPartial<Skill>) {
		super(input);
	}

	@ApiProperty({ type: String })
	@Column()
	name?: string;

	@ApiProperty({ type: String })
	@Column()
	description?: string;

	@ApiProperty({ type: String })
	@Column()
	color?: string;

	@ManyToMany((type) => Employee, (employee) => employee.skills)
	@JoinTable({
		name: 'skill_employee'
	})
	employees?: IEmployee[];
}
