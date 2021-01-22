/*
  - Request Approval Employee table is the third table which will combine the employee table and the request approval table.
  - Request Approval Employee table has the many to one relationship to the RequestApproval table and the Employee table by requestApprovalId and employeeId
*/
import { Entity, Column, ManyToOne } from 'typeorm';
import { DeepPartial, IRequestApprovalEmployee } from '@gauzy/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber } from 'class-validator';
import {
	Employee,
	RequestApproval,
	TenantOrganizationBaseEntity
} from '../internal';

@Entity('request_approval_employee')
export class RequestApprovalEmployee
	extends TenantOrganizationBaseEntity
	implements IRequestApprovalEmployee {
	constructor(input?: DeepPartial<RequestApprovalEmployee>) {
		super(input);
	}

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column()
	public requestApprovalId!: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column()
	public employeeId!: string;

	@ManyToOne(
		() => RequestApproval,
		(requestApproval) => requestApproval.employeeApprovals,
		{
			onDelete: 'CASCADE'
		}
	)
	public requestApproval!: RequestApproval;

	@ManyToOne(() => Employee, (employee) => employee.requestApprovals, {
		cascade: true
	})
	public employee!: Employee;

	@ApiProperty({ type: Number })
	@IsNumber()
	@Column({ nullable: true })
	status: number;
}
