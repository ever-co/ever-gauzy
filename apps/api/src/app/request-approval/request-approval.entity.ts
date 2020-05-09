/*
  - Request Approval is a request which is made by the employee. The employee can ask the approver for approvals different things.
  E.g. business trips, job referral awards, etc.
  - Request Approval table has the many to one relationship to ApprovalsPolicy table by approvalsPolicyId
  - Request Approval table has the one to many relationships to RequestApprovalEmployee table
  - Request Approval table has the many to many relationships to the Employee table through the RequestApprovalEmployee table.
*/
import {
	Entity,
	Index,
	Column,
	OneToMany,
	JoinTable,
	RelationId,
	ManyToOne,
	JoinColumn
} from 'typeorm';
import { Base } from '../core/entities/base';
import { RequestApproval as IRequestApproval } from '@gauzy/models';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber } from 'class-validator';
import { RequestApprovalEmployee } from '../request-approval-employee/request-approval-employee.entity';
import { ApprovalsPolicy } from '../approvals-policy/approvals-policy.entity';

@Entity('request-approval')
export class RequestApproval extends Base implements IRequestApproval {
	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	name: string;

	@ApiProperty({ type: ApprovalsPolicy })
	@ManyToOne((type) => ApprovalsPolicy, {
		nullable: true,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	approvalsPolicy: ApprovalsPolicy;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((policy: RequestApproval) => policy.approvalsPolicy)
	@IsString()
	@Column({ nullable: true })
	approvalsPolicyId: string;

	@OneToMany(
		(type) => RequestApprovalEmployee,
		(employeeApprovals) => employeeApprovals.requestApproval,
		{
			cascade: true
		}
	)
	employeeApprovals?: RequestApprovalEmployee[];

	@ApiProperty({ type: Number })
	@IsNumber()
	@Column({ nullable: true })
	status: number;
}
