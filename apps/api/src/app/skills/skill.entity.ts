import { Base } from '../core/entities/base';
import { Entity, Column, Unique, ManyToMany, RelationId } from 'typeorm';
import { Skill as ISkill } from '@gauzy/models';
import { ApiProperty } from '@nestjs/swagger';
import { Employee } from '../employee/employee.entity';
import { Organization } from '../organization/organization.entity';
import { TenantBase } from '../core/entities/tenant-base';
import { IsString } from 'class-validator';

@Entity('skill')
@Unique(['name'])
export class Skill extends TenantBase implements ISkill {
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

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((skill: Skill) => skill.organization)
	@IsString()
	@Column({ nullable: true })
	organizationId: string;

	@ManyToMany((type) => Employee, (employee) => employee.skills)
	employee?: Employee[];
}
