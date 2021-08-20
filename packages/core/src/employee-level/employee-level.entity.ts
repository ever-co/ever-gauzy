import { Entity, Column, ManyToMany, JoinTable } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import { IEmployeeLevel, ITag } from '@gauzy/contracts';
import { Tag, TenantOrganizationBaseEntity } from '../core/entities/internal';

@Entity({ name: 'employee_level' })
export class EmployeeLevel extends TenantOrganizationBaseEntity implements IEmployeeLevel {
	
	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@Column()
	level: string;

	/*
    |--------------------------------------------------------------------------
    | @ManyToMany 
    |--------------------------------------------------------------------------
    */

	/**
	 * Tag
	 */
	@ApiProperty()
	@ManyToMany(() => Tag, (tag) => tag.employeeLevel)
	@JoinTable({
		name: 'tag_employee_level'
	})
	tags?: ITag[];
}
