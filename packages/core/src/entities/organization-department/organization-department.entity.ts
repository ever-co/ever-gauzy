import {
	IOrganizationDepartment,
	ITag,
	IEmployee,
	IOrganization,
	ICandidate
} from '@gauzy/common';
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
import { TenantOrganizationBase } from '../tenant-organization-base';
import { Candidate } from '../candidate/candidate.entity';

@Entity('organization_department')
export class OrganizationDepartment
	extends TenantOrganizationBase
	implements IOrganizationDepartment {
	@ApiProperty()
	@ManyToMany((type) => Tag, (tag) => tag.organizationDepartment)
	@JoinTable({
		name: 'tag_organization_department'
	})
	tags: ITag[];

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
	members?: IEmployee[];

	@ManyToOne((type) => Organization, (organization) => organization.id)
	organization?: IOrganization;

	@ManyToMany(
		(type) => Candidate,
		(candidate) => candidate.organizationDepartments,
		{ cascade: ['update'] }
	)
	@JoinTable({
		name: 'candidate_department'
	})
	candidates?: ICandidate[];
}
