import { ICandidate, IOrganizationEmploymentType } from '@gauzy/models';
import { Column, Entity, JoinTable, ManyToMany } from 'typeorm';
import { Employee } from '../employee/employee.entity';
import { Tag } from '../tags/tag.entity';
import { ApiProperty } from '@nestjs/swagger';
import { TenantOrganizationBase } from '../core/entities/tenant-organization-base';
import { Candidate } from '../candidate/candidate.entity';

@Entity('organization_employment_type')
export class OrganizationEmploymentType
	extends TenantOrganizationBase
	implements IOrganizationEmploymentType {
	@ApiProperty()
	@ManyToMany((type) => Tag, (tag) => tag.organizationEmploymentType)
	@JoinTable({
		name: 'tag_organization_employment_type'
	})
	tags: Tag[];

	@Column()
	name: string;

	@ManyToMany(
		(type) => Employee,
		(employee) => employee.organizationEmploymentTypes,
		{ cascade: ['update'] }
	)
	@JoinTable({
		name: 'organization_employment_type_employee'
	})
	members?: Employee[];

	@ManyToMany(
		(type) => Candidate,
		(candidate) => candidate.organizationEmploymentTypes,
		{ cascade: ['update'] }
	)
	@JoinTable({
		name: 'candidate_employment_type'
	})
	candidates?: ICandidate[];
}
