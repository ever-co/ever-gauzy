import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { TenantOrganizationBase } from '../core/entities/tenant-organization-base';
import { Employee } from '../employee/employee.entity';
import { IEmployee, IEmployeeProposalTemplate } from '@gauzy/models';

@Entity('employee_proposal_template')
export class EmployeeProposalTemplate
	extends TenantOrganizationBase
	implements IEmployeeProposalTemplate {
	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column()
	employeeId?: string;

	@ManyToOne(() => Employee, (employee) => employee.id)
	employee?: IEmployee;

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	name?: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column({ nullable: true })
	content?: string;

	@ApiProperty({ type: Boolean })
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column({ default: false })
	isDefault?: boolean;
}
