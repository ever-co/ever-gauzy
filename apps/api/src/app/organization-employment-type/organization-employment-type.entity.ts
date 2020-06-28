import { OrganizationEmploymentType as IOrganizationEmploymentType } from '@gauzy/models';
import { IsNotEmpty } from 'class-validator';
import { Column, Entity, JoinTable, ManyToMany, ManyToOne } from 'typeorm';
import { Base } from '../core/entities/base';
import { Employee } from '../employee/employee.entity';
import { Tag } from '../tags/tag.entity';
import { ApiProperty } from '@nestjs/swagger';
import { Organization } from '../organization/organization.entity';

@Entity('organization_employment_type')
export class OrganizationEmploymentType extends Base
	implements IOrganizationEmploymentType {
	@ApiProperty()
	@ManyToMany((type) => Tag, (tag) => tag.organizationEmploymentType)
	@JoinTable({
		name: 'tag_organization_employment_types'
	})
	tags: Tag[];

	@Column()
	name: string;

	@Column()
	@IsNotEmpty()
	organizationId: string;

	@ManyToMany(
		(type) => Employee,
		(employee) => employee.organizationEmploymentTypes,
		{ cascade: ['update'] }
	)
	@JoinTable({
		name: 'organization_employment_type_employee'
	})
	members?: Employee[];

	@ManyToOne((type) => Organization, (organization) => organization.id)
	organization: Organization;
}
