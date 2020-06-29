import { Base } from '../core/entities/base';
import { Entity, Column, Unique, ManyToMany } from 'typeorm';
import { Skill as ISkill } from '@gauzy/models';
import { ApiProperty } from '@nestjs/swagger';
import { Employee } from '../employee/employee.entity';
import { Organization } from '../organization/organization.entity';

@Entity('skill')
@Unique(['name'])
export class Skill extends Base implements ISkill {
	@ApiProperty({ type: String })
	@Column()
	name?: string;

	@ApiProperty({ type: String })
	@Column()
	description?: string;

	@ApiProperty({ type: String })
	@Column()
	color?: string;

	@ManyToMany((type) => Organization, (organization) => organization.skills)
	organization?: Organization[];

	@ManyToMany((type) => Employee, (employee) => employee.skills)
	employee?: Employee[];
}
