import {
	Entity,
	RelationId,
	Column,
	ManyToMany,
	JoinTable,
	JoinColumn,
	ManyToOne
} from 'typeorm';
import { Base } from '../core/entities/base';
import {
	EquipmentSharing as IEquipmentSharing,
	ApprovalPolicyTypesEnum
} from '@gauzy/models';
import { ApiProperty } from '@nestjs/swagger';
import { IsDate, IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { Equipment } from '../equipment/equipment.entity';
import { Employee } from '../employee/employee.entity';
import { OrganizationTeam } from '../organization-team/organization-team.entity';
import { ApprovalPolicy } from '../approval-policy/approval-policy.entity';

@Entity('equipment_sharing')
export class EquipmentSharing extends Base implements IEquipmentSharing {
	@ApiProperty({ type: String })
	@IsString()
	@Column({ nullable: true })
	name: string;

	@ApiProperty({ type: Equipment })
	@ManyToOne(() => Equipment, (equipment) => equipment.equipmentSharings)
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

	@IsEnum(ApprovalPolicyTypesEnum)
	@IsNotEmpty()
	@Column()
	status: number;

	@ManyToMany(() => Employee, { cascade: true })
	@JoinTable({
		name: 'equipment_shares_employees'
	})
	employees: Employee[];

	@ManyToMany(() => OrganizationTeam, { cascade: true })
	@JoinTable({
		name: 'equipment_shares_teams'
	})
	teams: OrganizationTeam[];

	@ApiProperty({ type: ApprovalPolicy })
	@ManyToOne(() => ApprovalPolicy, {
		nullable: true,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	approvalPolicy: ApprovalPolicy;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((policy: EquipmentSharing) => policy.approvalPolicy)
	@IsString()
	@Column({ nullable: true })
	approvalPolicyId: string;

	@ApiProperty({ type: String, readOnly: true })
	@IsString()
	@Column({ nullable: true })
	createdBy: string;
}
