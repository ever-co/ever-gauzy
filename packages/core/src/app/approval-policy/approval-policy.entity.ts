/*
 *  Approval Policy is predefined approval types for the organization.
 *	E.g. for example, "Business Trip", "Borrow Items", ...
 *  Approval Policy table has the many to one relationship to the Organization table and Tenant by organizationId and tenantId
 */
import { Entity, Index, Column } from 'typeorm';
import {
	IApprovalPolicy,
	ApprovalPolicyTypesStringEnum
} from '@gauzy/contracts';
import { DeepPartial } from '@gauzy/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEnum } from 'class-validator';
import { TenantOrganizationBaseEntity } from '../core/entities/internal';

@Entity('approval_policy')
export class ApprovalPolicy
	extends TenantOrganizationBaseEntity
	implements IApprovalPolicy {
	constructor(input?: DeepPartial<ApprovalPolicy>) {
		super(input);
	}

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	name: string;

	@ApiProperty({ type: String })
	@IsString()
	@Column({ nullable: true })
	description: string;

	@ApiProperty({ type: String, enum: ApprovalPolicyTypesStringEnum })
	@IsEnum(ApprovalPolicyTypesStringEnum)
	@Column({ nullable: true })
	approvalType: string;
}
