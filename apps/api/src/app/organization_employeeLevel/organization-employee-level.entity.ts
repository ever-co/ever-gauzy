import { Entity, Column, ManyToMany, JoinTable } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Tag } from '../tags/tag.entity';
import { IsString, IsNotEmpty } from 'class-validator';
import { TenantOrganizationBase } from '../core/entities/tenant-organization-base';

@Entity({ name: 'organization_employee_level' })
export class EmployeeLevel extends TenantOrganizationBase {
	@ApiProperty()
	@ManyToMany((type) => Tag, (tag) => tag.employeeLevel)
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
