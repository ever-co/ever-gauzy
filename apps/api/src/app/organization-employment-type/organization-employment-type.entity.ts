import { OrganizationEmploymentType as IOrganizationEmploymentType } from '@gauzy/models';
import { IsNotEmpty } from 'class-validator';
import { Column, Entity, JoinTable, ManyToMany } from 'typeorm';
import { Base } from '../core/entities/base';
import { Employee } from '../employee/employee.entity';

@Entity('organization_employment_type')
export class OrganizationEmploymentType extends Base
	implements IOrganizationEmploymentType {
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
}
