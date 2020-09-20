import { Entity, Column, Unique, ManyToMany } from 'typeorm';
import { ISkill } from '@gauzy/models';
import { ApiProperty } from '@nestjs/swagger';
import { Employee } from '../employee/employee.entity';
import { TenantOrganizationBase } from '../core/entities/tenant-organization-base';

@Entity('skill')
@Unique(['name'])
export class Skill extends TenantOrganizationBase implements ISkill {
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
	employee?: Employee[];
}
