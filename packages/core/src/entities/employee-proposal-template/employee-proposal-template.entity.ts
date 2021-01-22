import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import {
	DeepPartial,
	IEmployee,
	IEmployeeProposalTemplate
} from '@gauzy/common';
import { Employee, TenantOrganizationBaseEntity } from '../internal';

@Entity('employee_proposal_template')
export class EmployeeProposalTemplate
	extends TenantOrganizationBaseEntity
	implements IEmployeeProposalTemplate {
	constructor(input?: DeepPartial<EmployeeProposalTemplate>) {
		super(input);
	}

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
