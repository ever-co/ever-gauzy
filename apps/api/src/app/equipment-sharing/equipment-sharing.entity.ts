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
	EquipmentSharingStatusEnum
} from '@gauzy/models';
import { ApiProperty } from '@nestjs/swagger';
import { Equipment } from '../equipment/equipment.entity';
import { IsDate, IsEnum, IsNotEmpty } from 'class-validator';
import { Employee } from '../employee';
import { OrganizationTeams } from '../organization-teams';

@Entity('equipment_sharing')
export class EquipmentSharing extends Base implements IEquipmentSharing {
	@ApiProperty({ type: Equipment })
	@ManyToOne(
		(type) => Equipment,
		(equipment) => equipment.equipmentSharings
	)
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

	@IsEnum(EquipmentSharingStatusEnum)
	@IsNotEmpty()
	@Column()
	status: string;

	@ManyToMany((type) => Employee, { cascade: true })
	@JoinTable({
		name: 'equipment_shares_employees'
	})
	employees: Employee[];

	@ManyToMany((type) => OrganizationTeams, { cascade: true })
	@JoinTable({
		name: 'equipment_shares_teams'
	})
	teams: OrganizationTeams[];
}
