/*
  Approval Policy is predefined approval types for the organization.
E.g. for example, "Business Trip", "Borrow Items", ...
  Approval Policy table has the many to one relationship to the Organization table and Tenant by organizationId and tenantId
*/
import {
	Entity,
	Index,
	Column
} from 'typeorm';
import { EquipmentSharingPolicy as IEquipmentSharingPolicy } from '@gauzy/models';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import { TenantOrganizationBase } from '../core/entities/tenant-organization-base';

@Entity('equipment_sharing_policy')
export class EquipmentSharingPolicy extends TenantOrganizationBase
	implements IEquipmentSharingPolicy {
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
}
