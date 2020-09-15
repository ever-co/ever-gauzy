import {
	Entity,
	RelationId,
	Column,
	ManyToMany,
	JoinTable,
	JoinColumn,
	ManyToOne
} from 'typeorm';
import {
	IEquipmentSharing,
	RequestApprovalStatusTypesEnum
} from '@gauzy/models';
import { ApiProperty } from '@nestjs/swagger';
import { IsDate, IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { Equipment } from '../equipment/equipment.entity';
import { Employee } from '../employee/employee.entity';
import { OrganizationTeam } from '../organization-team/organization-team.entity';
import { EquipmentSharingPolicy } from '../equipment-sharing-policy/equipment-sharing-policy.entity';
import { TenantOrganizationBase } from '../core/entities/tenant-organization-base';

@Entity('equipment_sharing')
export class EquipmentSharing extends TenantOrganizationBase
	implements IEquipmentSharing {
	@ApiProperty({ type: String })
	@IsString()
	@Column({ nullable: true })
	name: string;

	@ApiProperty({ type: Equipment })
	@ManyToOne((type) => Equipment, (equipment) => equipment.equipmentSharings)
	@JoinColumn()
	equipment: Equipment;

	@ApiProperty({ type: String })
	@RelationId(
		(equipmentSharing: EquipmentSharing) => equipmentSharing.equipment
	)
	@Column({ nullable: true })
	equipmentId: string;

	@ApiProperty({ type: Date })
	@IsDate()
	@Column({ nullable: true })
	shareRequestDay: Date;

	@ApiProperty({ type: Date })
	@IsDate()
	@Column({ nullable: true })
	shareStartDay: Date;

	@ApiProperty({ type: Date })
	@IsDate()
	@Column({ nullable: true })
	shareEndDay: Date;

	@IsEnum(RequestApprovalStatusTypesEnum)
	@IsNotEmpty()
	@Column()
	status: number;

	@ManyToMany((type) => Employee, { cascade: true })
	@JoinTable({
		name: 'equipment_shares_employees'
	})
	employees: Employee[];

	@ManyToMany((type) => OrganizationTeam, { cascade: true })
	@JoinTable({
		name: 'equipment_shares_teams'
	})
	teams: OrganizationTeam[];

	@ApiProperty({ type: String, readOnly: true })
	@IsString()
	@Column({ nullable: true })
	createdBy: string;

	@ApiProperty({ type: String })
	@IsString()
	@Column({ nullable: true })
	createdByName: string;

	@ApiProperty({ type: EquipmentSharingPolicy })
	@ManyToOne((type) => EquipmentSharingPolicy, {
		nullable: true,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	equipmentSharingPolicy: EquipmentSharingPolicy;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((policy: EquipmentSharing) => policy.equipmentSharingPolicy)
	@IsString()
	@Column({ nullable: true })
	equipmentSharingPolicyId: string;
}
