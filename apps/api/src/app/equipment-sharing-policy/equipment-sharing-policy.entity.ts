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
import { EquipmentSharingPolicy as IEquipmentSharingPolicy } from '@gauzy/models';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import { Organization } from '../organization/organization.entity';

@Entity('equipment_sharing_policy')
export class EquipmentSharingPolicy extends Base
	implements IEquipmentSharingPolicy {
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
	@RelationId((policy: EquipmentSharingPolicy) => policy.organization)
	@IsString()
	@Column({ nullable: true })
	organizationId: string;

	@ApiProperty({ type: String })
	@IsString()
	@Column({ nullable: true })
	description: string;
}
