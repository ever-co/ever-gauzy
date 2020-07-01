import { Entity, Column, ManyToMany, JoinTable, ManyToOne } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Tag } from '../tags/tag.entity';
import { Base } from '../core/entities/base';
import { Organization } from '../organization/organization.entity';
import { IsString, IsNotEmpty } from 'class-validator';

@Entity({
	name: 'organization_employee_level'
})
export class EmployeeLevel extends Base {
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

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column()
	organizationId: string;

	@ManyToOne((type) => Organization, (organization) => organization.id)
	organization?: Organization;
}
