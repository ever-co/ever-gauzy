import { ICandidate, IOrganizationEmploymentType } from '@gauzy/contracts';
import { Column, Entity, JoinTable, ManyToMany } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import {
	Candidate,
	Employee,
	Tag,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';

@Entity('organization_employment_type')
export class OrganizationEmploymentType
	extends TenantOrganizationBaseEntity
	implements IOrganizationEmploymentType {
	@ApiProperty()
	@ManyToMany(() => Tag, (tag) => tag.organizationEmploymentType)
	@JoinTable({
		name: 'tag_organization_employment_type'
	})
	tags: Tag[];

	@Column()
	name: string;

	@ManyToMany(() => Employee, (employee) => employee.organizationEmploymentTypes, { 
		cascade: ['update'] 
	})
	@JoinTable({
		name: 'organization_employment_type_employee'
	})
	members?: Employee[];

	@ManyToMany(() => Candidate, (candidate) => candidate.organizationEmploymentTypes, {
        onUpdate: 'CASCADE',
		onDelete: 'CASCADE'
    })
    @JoinTable({
		name: 'candidate_employment_type'
	})
    candidates?: ICandidate[];
}
