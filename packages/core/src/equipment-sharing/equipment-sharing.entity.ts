import {
	Entity,
	RelationId,
	Column,
	ManyToMany,
	JoinTable,
	JoinColumn,
	ManyToOne,
	Index
} from 'typeorm';
import {
	IEmployee,
	IEquipment,
	IEquipmentSharing,
	IEquipmentSharingPolicy,
	IOrganizationTeam
} from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import {
	Employee,
	Equipment,
	EquipmentSharingPolicy,
	OrganizationTeam,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';

@Entity('equipment_sharing')
export class EquipmentSharing extends TenantOrganizationBaseEntity
	implements IEquipmentSharing {

	@ApiProperty({ type: () => String })
	@Column({ nullable: true })
	name: string;

	@ApiProperty({ type: () => Date })
	@Column({ nullable: true })
	shareRequestDay: Date;

	@ApiProperty({ type: () => Date })
	@Column({ nullable: true })
	shareStartDay: Date;

	@ApiProperty({ type: () => Date })
	@Column({ nullable: true })
	shareEndDay: Date;

	@Column()
	status: number;

	@ApiProperty({ type: () => String, readOnly: true })
	@Column({ nullable: true })
	createdBy: string;

	@ApiProperty({ type: () => String })
	@Column({ nullable: true })
	createdByName: string;

	/*
    |--------------------------------------------------------------------------
    | @ManyToOne
    |--------------------------------------------------------------------------
    */

	/**
	 * Equipment
	 */
	@ApiProperty({ type: () => Equipment })
	@ManyToOne(() => Equipment, (equipment) => equipment.equipmentSharings, {
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	equipment: IEquipment;

	@ApiProperty({ type: () => String })
	@RelationId((it: EquipmentSharing) => it.equipment)
	@Index()
	@Column({ nullable: true })
	equipmentId: IEquipment['id'];

	/**
	* Equipment
	*/
	@ApiProperty({ type: () => EquipmentSharingPolicy })
	@ManyToOne(() => EquipmentSharingPolicy, (it) => it.equipmentSharings, {
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	equipmentSharingPolicy: IEquipmentSharingPolicy;

	@ApiProperty({ type: () => String })
	@RelationId((it: EquipmentSharing) => it.equipmentSharingPolicy)
	@Index()
	@Column({ nullable: true })
	equipmentSharingPolicyId: IEquipmentSharingPolicy['id'];

	/*
    |--------------------------------------------------------------------------
    | @ManyToMany
    |--------------------------------------------------------------------------
    */

	/**
	 * Employee
	 */
	@ManyToMany(() => Employee, (it) => it.equipmentSharings, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE'
	})
	@JoinTable({
		name: 'equipment_shares_employees'
	})
	employees?: IEmployee[];

	/**
	 * OrganizationTeam
	 */
	@ManyToMany(() => OrganizationTeam, (it) => it.equipmentSharings, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE'
	})
	@JoinTable({
		name: 'equipment_shares_teams'
	})
	teams?: IOrganizationTeam[];
}
