/*
  - Request Approval is a request which is made by the employee. The employee can ask the approver for approvals different things.
  E.g. business trips, job referral awards, etc.
  - Request Approval table has the many to one relationship to ApprovalPolicy table by approvalPolicyId
  - Request Approval table has the one to many relationships to RequestApprovalEmployee table
  - Request Approval table has the many to many relationships to the Employee table through the RequestApprovalEmployee table.
*/
import {
	Entity,
	Index,
	Column,
	OneToMany,
	RelationId,
	ManyToOne,
	JoinColumn
} from 'typeorm';
import { Base } from '../core/entities/base';
import { RequestApproval as IRequestApproval } from '@gauzy/models';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber } from 'class-validator';
import { RequestApprovalEmployee } from '../request-approval-employee/request-approval-employee.entity';
import { ApprovalPolicy } from '../approval-policy/approval-policy.entity';
import { RequestApprovalTeam } from '../request-approval-team/request-approval-team.entity';

@Entity('request_approval')
export class RequestApproval extends Base implements IRequestApproval {
	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	name: string;

	@ApiProperty({ type: ApprovalPolicy })
	@ManyToOne((type) => ApprovalPolicy, {
		nullable: true,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	approvalPolicy: ApprovalPolicy;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((policy: RequestApproval) => policy.approvalPolicy)
	@IsString()
	@Column({ nullable: true })
	approvalPolicyId: string;

	@OneToMany(
		(type) => RequestApprovalEmployee,
		(employeeApprovals) => employeeApprovals.requestApproval,
		{
			cascade: true
		}
	)
	employeeApprovals?: RequestApprovalEmployee[];

	@OneToMany(
		(type) => RequestApprovalTeam,
		(teamApprovals) => teamApprovals.requestApproval,
		{
			cascade: true
		}
	)
	teamApprovals?: RequestApprovalTeam[];

	@ApiProperty({ type: Number })
	@IsNumber()
	@Column({ nullable: true })
	status: number;

	@ApiProperty({ type: String, readOnly: true })
	@IsString()
	@Column({ nullable: true })
	createdBy: string;

	@ApiProperty({ type: Number })
	@IsNumber()
	@Column({ nullable: true })
	min_count: number;

	@ApiProperty({ type: String })
	@IsString()
	@Column({ nullable: true })
	createdByName: string;

	@ApiProperty({ type: String, readOnly: true })
	@IsString()
	@Column({ nullable: true })
	requestId: string;
}
