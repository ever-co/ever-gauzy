import { OrganizationDepartment as IOrganizationDepartment } from '@gauzy/models';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import {
	Column,
	Entity,
	Index,
	JoinTable,
	ManyToMany,
	ManyToOne
} from 'typeorm';
import { Employee } from '../employee/employee.entity';
import { Tag } from '../tags/tag.entity';
import { Organization } from '../organization/organization.entity';
import { TenantBase } from '../core/entities/tenant-base';

@Entity('organization_department')
export class OrganizationDepartment extends TenantBase
	implements IOrganizationDepartment {
	@ApiProperty()
	@ManyToMany((type) => Tag, (tag) => tag.organizationDepartment)
	@JoinTable({
		name: 'tag_organization_department'
	})
	tags: Tag[];

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	name: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column()
	organizationId: string;

	@ManyToMany(
		(type) => Employee,
		(employee) => employee.organizationDepartments,
		{ cascade: ['update'] }
	)
	@JoinTable({
		name: 'organization_department_employee'
	})
	members?: Employee[];

	@ManyToOne((type) => Organization, (organization) => organization.id)
	organization: Organization;
}
