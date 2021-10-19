import { ICandidate, IEmployee, IOrganizationEmploymentType, ITag } from '@gauzy/contracts';
import { Column, Entity, JoinTable, ManyToMany } from 'typeorm';
import { ApiPropertyOptional } from '@nestjs/swagger';
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

	@Column()
	name: string;

	/*
    |--------------------------------------------------------------------------
    | @ManyToMany 
    |--------------------------------------------------------------------------
    */

	@ApiPropertyOptional({ type: () => Tag, isArray: true })
	@ManyToMany(() => Tag, (tag) => tag.organizationEmploymentTypes, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE'
	})
	@JoinTable({
		name: 'tag_organization_employment_type'
	})
	tags: ITag[];

	/**
	 * Employee
	 */
	@ApiPropertyOptional({ type: () => Employee, isArray: true })
	@ManyToMany(() => Employee, (employee) => employee.organizationEmploymentTypes, { 
		cascade: ['update'] 
	})
	@JoinTable({
		name: 'organization_employment_type_employee'
	})
	members?: IEmployee[];

	/**
	 * Candidate
	 */
	@ApiPropertyOptional({ type: () => Candidate, isArray: true })
	@ManyToMany(() => Candidate, (candidate) => candidate.organizationEmploymentTypes, {
        onUpdate: 'CASCADE',
		onDelete: 'CASCADE'
    })
    @JoinTable({
		name: 'candidate_employment_type'
	})
    candidates?: ICandidate[];
}
