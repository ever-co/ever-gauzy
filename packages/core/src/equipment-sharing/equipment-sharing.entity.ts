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
	IOrganizationTeam,
	RequestApprovalStatusTypesEnum
} from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { IsDate, IsEnum, IsNotEmpty, IsString } from 'class-validator';
import {
	Employee,
	Equipment,
	EquipmentSharingPolicy,
	OrganizationTeam,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';

@Entity('equipment_sharing')
export class EquipmentSharing
	extends TenantOrganizationBaseEntity
	implements IEquipmentSharing {
	@ApiProperty({ type: () => String })
	@IsString()
	@Column({ nullable: true })
	name: string;

	@ApiProperty({ type: () => Date })
	@IsDate()
	@Column({ nullable: true })
	shareRequestDay: Date;

	@ApiProperty({ type: () => Date })
	@IsDate()
	@Column({ nullable: true })
	shareStartDay: Date;

	@ApiProperty({ type: () => Date })
	@IsDate()
	@Column({ nullable: true })
	shareEndDay: Date;

	@IsEnum(RequestApprovalStatusTypesEnum)
	@IsNotEmpty()
	@Column()
	status: number;

	@ApiProperty({ type: () => String, readOnly: true })
	@IsString()
	@Column({ nullable: true })
	createdBy: string;

	@ApiProperty({ type: () => String })
	@IsString()
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
	@IsString()
	@Index()
	@Column({ nullable: true })
	equipmentId: string;

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
	@IsString()
	@Index()
	@Column({ nullable: true })
	equipmentSharingPolicyId: string;

	/*
    |--------------------------------------------------------------------------
    | @ManyToMany 
    |--------------------------------------------------------------------------
    */

	/**
	 * Employee
	 */
	@ApiProperty({ type: () => Employee })
	@ManyToMany(() => Employee, { cascade: true })
	@JoinTable({
		name: 'equipment_shares_employees'
	})
	employees?: IEmployee[];

	/**
	 * OrganizationTeam
	 */
	@ApiProperty({ type: () => OrganizationTeam })
	@ManyToMany(() => OrganizationTeam, { cascade: true })
	@JoinTable({
		name: 'equipment_shares_teams'
	})
	teams?: IOrganizationTeam[];
}
