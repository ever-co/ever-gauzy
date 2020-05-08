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
		(requestApprovalEmployee) => requestApprovalEmployee.requestApproval
	)
	requestApprovalEmployee?: RequestApprovalEmployee[];

	@ApiProperty({ type: Number })
	@IsNumber()
	@Column({ nullable: true })
	status: number;
}
