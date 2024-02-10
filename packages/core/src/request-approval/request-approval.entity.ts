/*
  - Request Approval is a request which is made by the employee. The employee can ask the approver for approvals different things.
  E.g. business trips, job referral awards, etc.
  - Request Approval table has the many to one relationship to ApprovalPolicy table by approvalPolicyId
  - Request Approval table has the one to many relationships to RequestApprovalEmployee table
  - Request Approval table has the many to many relationships to the Employee table through the RequestApprovalEmployee table.
*/
import {
	Index,
	Column,
	RelationId,
	JoinColumn,
	JoinTable
} from 'typeorm';
import {
	IRequestApproval,
	ApprovalPolicyTypesStringEnum,
	IApprovalPolicy,
	IRequestApprovalEmployee,
	IRequestApprovalTeam,
	ITag
} from '@gauzy/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsEnum } from 'class-validator';
import {
	ApprovalPolicy,
	RequestApprovalEmployee,
	RequestApprovalTeam,
	Tag,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmRequestApprovalRepository } from './repository/mikro-orm-request-approval.repository';
import { MultiORMManyToMany, MultiORMManyToOne, MultiORMOneToMany } from '../core/decorators/entity/relations';

@MultiORMEntity('request_approval', { mikroOrmRepository: () => MikroOrmRequestApprovalRepository })
export class RequestApproval extends TenantOrganizationBaseEntity implements IRequestApproval {
	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	name: string;

	@ApiProperty({ type: () => Number })
	@IsNumber()
	@Column({ nullable: true })
	status: number;

	@ApiProperty({ type: () => String, readOnly: true })
	@IsString()
	@Column({ nullable: true })
	createdBy: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@Column({ nullable: true })
	createdByName: string;

	@ApiProperty({ type: () => Number })
	@IsNumber()
	@Column({ nullable: true })
	min_count: number;

	@ApiProperty({ type: () => String, readOnly: true })
	@IsString()
	@Column({ nullable: true })
	requestId: string;

	@ApiProperty({ type: () => String, enum: ApprovalPolicyTypesStringEnum })
	@IsEnum(ApprovalPolicyTypesStringEnum)
	@Column({ nullable: true })
	requestType: string;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	*  ApprovalPolicy
	*/
	@ApiProperty({ type: () => ApprovalPolicy })
	@MultiORMManyToOne(() => ApprovalPolicy, {
		nullable: true,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	approvalPolicy: IApprovalPolicy;

	@ApiProperty({ type: () => String })
	@RelationId((it: RequestApproval) => it.approvalPolicy)
	@IsString()
	@Index()
	@Column({ nullable: true })
	approvalPolicyId: string;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/

	/**
	 * RequestApprovalEmployee
	 */
	@ApiPropertyOptional({ type: () => RequestApprovalEmployee, isArray: true })
	@MultiORMOneToMany(() => RequestApprovalEmployee, (employeeApprovals) => employeeApprovals.requestApproval, {
		cascade: true
	})
	employeeApprovals?: IRequestApprovalEmployee[];

	/**
	 * RequestApprovalTeam
	 */
	@ApiPropertyOptional({ type: () => RequestApprovalTeam, isArray: true })
	@MultiORMOneToMany(() => RequestApprovalTeam, (teamApprovals) => teamApprovals.requestApproval, {
		cascade: true
	})
	teamApprovals?: IRequestApprovalTeam[];

	/*
	|--------------------------------------------------------------------------
	| @ManyToMany
	|--------------------------------------------------------------------------
	*/
	@ApiPropertyOptional({ type: () => RequestApprovalTeam, isArray: true })
	@MultiORMManyToMany(() => Tag, (tag) => tag.requestApprovals, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE',
		owner: true,
		pivotTable: 'tag_request_approval'
	})
	@JoinTable({
		name: 'tag_request_approval'
	})
	tags?: ITag[];
}
