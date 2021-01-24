import { ICandidate, IOrganizationEmploymentType } from '@gauzy/contracts';
import { DeepPartial } from '@gauzy/common';
import { Column, Entity, JoinTable, ManyToMany } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import {
	Candidate,
	Employee,
	Tag,
	TenantOrganizationBaseEntity
} from '../internal';

@Entity('organization_employment_type')
export class OrganizationEmploymentType
	extends TenantOrganizationBaseEntity
	implements IOrganizationEmploymentType {
	constructor(input?: DeepPartial<OrganizationEmploymentType>) {
		super(input);
	}

	@ApiProperty()
	@ManyToMany(() => Tag, (tag) => tag.organizationEmploymentType)
	@JoinTable({
		name: 'tag_organization_employment_type'
	})
	tags: Tag[];

	@Column()
	name: string;

	@ManyToMany(
		() => Employee,
		(employee) => employee.organizationEmploymentTypes,
		{
			cascade: ['update']
		}
	)
	@JoinTable({
		name: 'organization_employment_type_employee'
	})
	members?: Employee[];

	@ManyToMany(
		() => Candidate,
		(candidate) => candidate.organizationEmploymentTypes,
		{
			cascade: ['update']
		}
	)
	@JoinTable({
		name: 'candidate_employment_type'
	})
	candidates?: ICandidate[];
}
