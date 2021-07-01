import { Entity, Column, ManyToMany, JoinTable } from 'typeorm';
import { IEmployee, IOrganization, ISkill } from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import {
	Employee,
	Organization,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';

@Entity('skill')
export class Skill extends TenantOrganizationBaseEntity implements ISkill {
	@ApiProperty({ type: () => String })
	@Column()
	name?: string;

	@ApiProperty({ type: () => String })
	@Column({ nullable: true })
	description?: string;

	@ApiProperty({ type: () => String })
	@Column()
	color?: string;

	/*
    |--------------------------------------------------------------------------
    | @ManyToMany 
    |--------------------------------------------------------------------------
    */
   // employees skills
	@ManyToMany(() => Employee, (employee) => employee.skills, {
        onUpdate: 'CASCADE',
		onDelete: 'CASCADE'
    })
    @JoinTable({
		name: 'skill_employee'
	})
    employees?: IEmployee[];

	// organizations skills
	@ManyToMany(() => Organization, (organization) => organization.skills, {
        onUpdate: 'CASCADE',
		onDelete: 'CASCADE'
    })
    @JoinTable({
		name: 'skill_organization'
	})
    organizations?: IOrganization[];
}
