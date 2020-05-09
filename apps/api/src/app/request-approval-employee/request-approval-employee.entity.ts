/*
  - Request Approval Employee table is the third table which will combine the employee table and the request approvals table.
  - Request Approval Employee table has the many to one relationship to the RequestApproval table and the Employee table by requestApprovalId and employeeId
*/
import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Base } from '../core/entities/base';
import { RequestApprovalEmployee as IRequestApprovalEmployee } from '@gauzy/models';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber } from 'class-validator';
import { RequestApproval } from '../request-approval/request-approval.entity';
import { Employee } from '../employee/employee.entity';

@Entity('request-approval-employee')
export class RequestApprovalEmployee extends Base
	implements IRequestApprovalEmployee {
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
		(type) => RequestApproval,
		(requestApproval) => requestApproval.employeeApprovals,
		{
			onDelete: 'CASCADE'
		}
	)
	public requestApproval!: RequestApproval;

	@ManyToOne(
		(type) => Employee,
		(employee) => employee.requestApprovals,
		{
			cascade: true
		}
	)
	public employee!: Employee;

	@ApiProperty({ type: Number })
	@IsNumber()
	@Column({ nullable: true })
	status: number;
}
