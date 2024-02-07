import {
	RelationId,
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
import { MultiORMColumn, MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmEquipmentSharingRepository } from './repository/mikro-orm-equipment-sharing.repository';
import { MultiORMManyToMany, MultiORMManyToOne } from '../core/decorators/entity/relations';

@MultiORMEntity('equipment_sharing', { mikroOrmRepository: () => MikroOrmEquipmentSharingRepository })
export class EquipmentSharing extends TenantOrganizationBaseEntity
	implements IEquipmentSharing {

	@ApiProperty({ type: () => String })
	@MultiORMColumn({ nullable: true })
	name: string;

	@ApiProperty({ type: () => Date })
	@MultiORMColumn({ nullable: true })
	shareRequestDay: Date;

	@ApiProperty({ type: () => Date })
	@MultiORMColumn({ nullable: true })
	shareStartDay: Date;

	@ApiProperty({ type: () => Date })
	@MultiORMColumn({ nullable: true })
	shareEndDay: Date;

	@MultiORMColumn()
	status: number;

	@ApiProperty({ type: () => String, readOnly: true })
	@MultiORMColumn({ nullable: true })
	createdBy: string;

	@ApiProperty({ type: () => String })
	@MultiORMColumn({ nullable: true })
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
	@MultiORMColumn({ nullable: true })
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
	@MultiORMColumn({ nullable: true })
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
