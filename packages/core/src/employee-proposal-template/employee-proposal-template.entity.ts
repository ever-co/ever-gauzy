import { Column, Entity, Index, ManyToOne, RelationId } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { IEmployee, IEmployeeProposalTemplate } from '@gauzy/contracts';
import {
	Employee,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';

@Entity('employee_proposal_template')
export class EmployeeProposalTemplate
	extends TenantOrganizationBaseEntity
	implements IEmployeeProposalTemplate {

	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	name?: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column({ type: 'text', nullable: true })
	content?: string;

	@ApiProperty({ type: () => Boolean })
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column({ default: false })
	isDefault?: boolean;

	/*
    |--------------------------------------------------------------------------
    | @ManyToOne 
    |--------------------------------------------------------------------------
    */
	@ApiProperty({ type: () => Employee })
	@ManyToOne(() => Employee, { 
		onDelete: 'CASCADE' 
	})
	employee?: IEmployee;

	@ApiProperty({ type: () => String })
	@RelationId((it: EmployeeProposalTemplate) => it.employee)
	@IsString()
	@Index()
	@IsNotEmpty()
	@Column()
	employeeId?: string;
}
