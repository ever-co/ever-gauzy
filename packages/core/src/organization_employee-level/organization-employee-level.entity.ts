import { Entity, Column, ManyToMany, JoinTable } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import { Tag, TenantOrganizationBaseEntity } from '../core/entities/internal';

@Entity({ name: 'organization_employee_level' })
export class EmployeeLevel extends TenantOrganizationBaseEntity {
	@ApiProperty()
	@ManyToMany(() => Tag, (tag) => tag.employeeLevel)
	@JoinTable({
		name: 'tag_organization_employee_level'
	})
	tags: Tag[];

	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@Column()
	level: string;
}
