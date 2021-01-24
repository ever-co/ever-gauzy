/*
 *  Approval Policy is predefined approval types for the organization.
 * E.g. for example, "Business Trip", "Borrow Items", ...
 * Approval Policy table has the many to one relationship to the Organization table and Tenant by organizationId and tenantId
 */
import { Entity, Index, Column } from 'typeorm';
import { IEquipmentSharingPolicy } from '@gauzy/contracts';
import { DeepPartial } from '@gauzy/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import { TenantOrganizationBaseEntity } from '../internal';

@Entity('equipment_sharing_policy')
export class EquipmentSharingPolicy
	extends TenantOrganizationBaseEntity
	implements IEquipmentSharingPolicy {
	constructor(input?: DeepPartial<EquipmentSharingPolicy>) {
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
}
