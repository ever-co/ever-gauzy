import {
	RelationId,
	Column,
	JoinTable,
	JoinColumn,
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
import { MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmEquipmentSharingRepository } from './repository/mikro-orm-equipment-sharing.repository';
import { MultiORMManyToMany, MultiORMManyToOne } from '../core/decorators/entity/relations';

@MultiORMEntity('equipment_sharing', { mikroOrmRepository: () => MikroOrmEquipmentSharingRepository })
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
	@MultiORMManyToOne(() => Equipment, (equipment) => equipment.equipmentSharings, {
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
	@MultiORMManyToOne(() => EquipmentSharingPolicy, (it) => it.equipmentSharings, {
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
	@MultiORMManyToMany(() => Employee, (it) => it.equipmentSharings, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE',
		owner: true,
		pivotTable: 'equipment_shares_employees',
	})
	@JoinTable({
		name: 'equipment_shares_employees'
	})
	employees?: IEmployee[];

	/**
	 * OrganizationTeam
	 */
	@MultiORMManyToMany(() => OrganizationTeam, (it) => it.equipmentSharings, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE',
		owner: true,
		pivotTable: 'equipment_shares_teams',
	})
	@JoinTable({
		name: 'equipment_shares_teams'
	})
	teams?: IOrganizationTeam[];
}
