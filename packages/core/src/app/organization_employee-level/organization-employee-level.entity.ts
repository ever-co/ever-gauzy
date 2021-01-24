import { Entity, Column, ManyToMany, JoinTable } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import { DeepPartial } from '@gauzy/common';
import { Tag, TenantOrganizationBaseEntity } from '../core/entities/internal';

@Entity({ name: 'organization_employee_level' })
export class EmployeeLevel extends TenantOrganizationBaseEntity {
	constructor(input?: DeepPartial<EmployeeLevel>) {
		super(input);
	}

	@ApiProperty()
	@ManyToMany(() => Tag, (tag) => tag.employeeLevel)
	@JoinTable({
		name: 'tag_organization_employee_level'
	})
	tags: Tag[];

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column()
	level: string;
}
