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
	JoinColumn,
	ManyToMany,
	JoinTable
} from 'typeorm';
import {
	IRequestApproval,
	ApprovalPolicyTypesStringEnum
} from '@gauzy/contracts';
import { DeepPartial } from '@gauzy/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsEnum } from 'class-validator';
import {
	ApprovalPolicy,
	RequestApprovalEmployee,
	RequestApprovalTeam,
	Tag,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';

@Entity('request_approval')
export class RequestApproval
	extends TenantOrganizationBaseEntity
	implements IRequestApproval {
	constructor(input?: DeepPartial<RequestApproval>) {
		super(input);
	}

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	name: string;

	@ApiProperty({ type: ApprovalPolicy })
	@ManyToOne(() => ApprovalPolicy, {
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
		() => RequestApprovalEmployee,
		(employeeApprovals) => employeeApprovals.requestApproval,
		{
			cascade: true
		}
	)
	employeeApprovals?: RequestApprovalEmployee[];

	@OneToMany(
		() => RequestApprovalTeam,
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

	@ApiProperty()
	@ManyToMany(() => Tag, (tag) => tag.requestApproval)
	@JoinTable({
		name: 'tag_request_approval'
	})
	tags?: Tag[];

	@ApiProperty({ type: String, enum: ApprovalPolicyTypesStringEnum })
	@IsEnum(ApprovalPolicyTypesStringEnum)
	@Column({ nullable: true })
	requestType: string;
}
