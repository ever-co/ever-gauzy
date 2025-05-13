/*
  - Request Approval is a request which is made by the employee. The employee can ask the approver for approvals different things.
  E.g. business trips, job referral awards, etc.
  - Request Approval table has the many to one relationship to ApprovalPolicy table by approvalPolicyId
  - Request Approval table has the one to many relationships to RequestApprovalEmployee table
  - Request Approval table has the many to many relationships to the Employee table through the RequestApprovalEmployee table.
*/
import { RelationId, JoinColumn, JoinTable } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsEnum, IsOptional, IsUUID, IsObject } from 'class-validator';
import {
	IRequestApproval,
	ApprovalPolicyTypesStringEnum,
	IApprovalPolicy,
	IRequestApprovalEmployee,
	IRequestApprovalTeam,
	ITag,
	ID
} from '@gauzy/contracts';
import {
	ApprovalPolicy,
	RequestApprovalEmployee,
	RequestApprovalTeam,
	Tag,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToMany,
	MultiORMManyToOne,
	MultiORMOneToMany
} from './../core/decorators/entity';
import { MikroOrmRequestApprovalRepository } from './repository/mikro-orm-request-approval.repository';

@MultiORMEntity('request_approval', { mikroOrmRepository: () => MikroOrmRequestApprovalRepository })
export class RequestApproval extends TenantOrganizationBaseEntity implements IRequestApproval {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@ColumnIndex()
	@MultiORMColumn()
	name: string;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ nullable: true })
	status: number;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ nullable: true })
	min_count: number;

	@ApiPropertyOptional({ type: () => String })
	@IsString()
	@MultiORMColumn({ nullable: true })
	requestId: ID;

	@ApiPropertyOptional({ type: () => String, enum: ApprovalPolicyTypesStringEnum })
	@IsOptional()
	@IsEnum(ApprovalPolicyTypesStringEnum)
	@MultiORMColumn({ nullable: true })
	requestType: ApprovalPolicyTypesStringEnum;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/
	/**
	 * The approval policy associated with this request approval.
	 */
	@ApiPropertyOptional({ type: () => ApprovalPolicy })
	@IsOptional()
	@IsObject()
	@MultiORMManyToOne(() => ApprovalPolicy, {
		nullable: true, // Indicates if relation column value can be nullable or not.
		onDelete: 'CASCADE' // Database cascade action on delete.
	})
	@JoinColumn()
	approvalPolicy?: IApprovalPolicy;

	/**
	 * The ID for the associated approval policy.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: RequestApproval) => it.approvalPolicy)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	approvalPolicyId?: ID;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/
	/**
	 * The employees associated with this request approval.
	 */
	@MultiORMOneToMany(() => RequestApprovalEmployee, (it) => it.requestApproval, { cascade: true })
	employeeApprovals?: IRequestApprovalEmployee[];

	/**
	 * The teams associated with this request approval.
	 */
	@MultiORMOneToMany(() => RequestApprovalTeam, (it) => it.requestApproval, { cascade: true })
	teamApprovals?: IRequestApprovalTeam[];

	/*
	|--------------------------------------------------------------------------
	| @ManyToMany
	|--------------------------------------------------------------------------
	*/
	/**
	 * The tags associated with this request approval.
	 */
	@MultiORMManyToMany(() => Tag, (it) => it.requestApprovals, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE',
		owner: true,
		pivotTable: 'tag_request_approval',
		joinColumn: 'requestApprovalId',
		inverseJoinColumn: 'tagId'
	})
	@JoinTable({ name: 'tag_request_approval' })
	tags?: ITag[];
}
