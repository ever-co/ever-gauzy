import { OrganizationDepartment as IOrganizationDepartment } from '@gauzy/models';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { Column, Entity, Index, JoinTable, ManyToMany } from 'typeorm';
import { Base } from '../core/entities/base';
import { Employee } from '../employee/employee.entity';

@Entity('organization_department')
export class OrganizationDepartment extends Base
	implements IOrganizationDepartment {
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
}
