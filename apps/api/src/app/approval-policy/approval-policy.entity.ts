/*
  Approval Policy is predefined approval types for the organization.
E.g. for example, "Business Trip", "Borrow Items", ...
  Approval Policy table has the many to one relationship to the Organization table and Tenant by organizationId and tenantId
*/
import {
	Entity,
	Index,
	Column,
	ManyToOne,
	JoinColumn,
	RelationId
} from 'typeorm';
import { Base } from '../core/entities/base';
import { ApprovalPolicy as IApprovalPolicy } from '@gauzy/models';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import { Organization } from '../organization/organization.entity';
import { Tenant } from '../tenant/tenant.entity';

@Entity('approval_policy')
export class ApprovalPolicy extends Base implements IApprovalPolicy {
	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	name: string;

	@ApiProperty({ type: Organization })
	@ManyToOne((type) => Organization, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn()
	organization: Organization;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((policy: ApprovalPolicy) => policy.organization)
	@IsString()
	@Column({ nullable: true })
	organizationId: string;

	@ApiProperty({ type: Tenant })
	@ManyToOne((type) => Tenant, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn()
	tenant: Tenant;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((policy: ApprovalPolicy) => policy.tenant)
	@IsString()
	@Column({ nullable: true })
	tenantId: string;

	@ApiProperty({ type: String })
	@IsString()
	@Column({ nullable: true })
	description: string;
}
