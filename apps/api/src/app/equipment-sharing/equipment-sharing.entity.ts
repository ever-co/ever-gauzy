import {
	Entity,
	OneToOne,
	RelationId,
	Column,
	ManyToMany,
	JoinTable
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

@Entity('equipmentsharing')
export class EquipmentSharing extends Base implements IEquipmentSharing {
	@ApiProperty({ type: Equipment })
	@OneToOne((type) => Equipment)
	equipment?: Equipment;

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
	@Column()
	shareStartDay: Date;

	@ApiProperty({ type: Date })
	@IsDate()
	@Column({ nullable: true })
	shareEndDay: Date;

	@IsEnum(EquipmentSharingStatusEnum)
	@IsNotEmpty()
	@Column()
	status: string;

	@ManyToMany((type) => Employee)
	@JoinTable({
		name: 'equipment_shares_employees'
	})
	employees: Employee[];

	@ManyToMany((type) => OrganizationTeams)
	@JoinTable({
		name: 'equipment_shares_teams'
	})
	teams: OrganizationTeams[];
}
