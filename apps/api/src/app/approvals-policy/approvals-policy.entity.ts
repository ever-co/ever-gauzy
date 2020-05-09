/*
  Approvals Policy is predefined approvals types for the organization.
E.g. for example, "Business Trip", "Borrow Items", ...
  Approvals Policy table has the many to one relationship to the Organization table and Tenant by organizationId and tenantId
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
import { ApprovalsPolicy as IApprovalsPolicy } from '@gauzy/models';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber } from 'class-validator';
import { Organization } from '../organization/organization.entity';
import { Tenant } from '../tenant/tenant.entity';

@Entity('approvals-policy')
export class ApprovalsPolicy extends Base implements IApprovalsPolicy {
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
	@RelationId((policy: ApprovalsPolicy) => policy.organization)
	@IsString()
	@Column({ nullable: true })
	organizationId: string;

	@ApiProperty({ type: Tenant })
	@ManyToOne((type) => Tenant, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn()
	tenant: Tenant;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((policy: ApprovalsPolicy) => policy.tenant)
	@IsString()
	@Column({ nullable: true })
	tenantId: string;

	@ApiProperty({ type: Number })
	@IsNumber()
	@Column({ nullable: true })
	type: number;

	@ApiProperty({ type: String })
	@IsString()
	@Column({ nullable: true })
	description: string;
}
