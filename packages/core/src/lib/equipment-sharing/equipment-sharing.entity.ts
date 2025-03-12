import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';
import { RelationId, JoinTable, JoinColumn } from 'typeorm';
import {
	ID,
	IEmployee,
	IEquipment,
	IEquipmentSharing,
	IEquipmentSharingPolicy,
	IOrganizationTeam
} from '@gauzy/contracts';
import {
	Employee,
	Equipment,
	EquipmentSharingPolicy,
	OrganizationTeam,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToMany,
	MultiORMManyToOne
} from './../core/decorators/entity';
import { MikroOrmEquipmentSharingRepository } from './repository/mikro-orm-equipment-sharing.repository';

@MultiORMEntity('equipment_sharing', { mikroOrmRepository: () => MikroOrmEquipmentSharingRepository })
export class EquipmentSharing extends TenantOrganizationBaseEntity implements IEquipmentSharing {
	/**
	 * Represents the name of the equipment sharing record.
	 * This optional string field may be used to label or identify the sharing entry.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	name: string;

	/**
	 * Represents the date when the share request was initiated.
	 * This optional field captures the moment a sharing request was made.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	shareRequestDay: Date;

	/**
	 * Represents the starting date of the equipment sharing period.
	 * This optional field indicates when the sharing period begins.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	shareStartDay: Date;

	/**
	 * Represents the ending date of the equipment sharing period.
	 * This optional field indicates when the sharing period ends.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	shareEndDay: Date;

	/**
	 * Represents the status of the equipment sharing record.
	 * This mandatory numeric field is used to reflect the current state or phase of the sharing process.
	 */
	@ApiProperty({ type: () => Number })
	@IsNumber()
	@MultiORMColumn()
	status: number;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/
	/**
	 * The equipment for which this sharing is created.
	 */
	@ApiPropertyOptional({ type: () => Equipment })
	@IsOptional()
	@IsObject()
	@MultiORMManyToOne(() => Equipment, (equipment) => equipment.equipmentSharings, {
		nullable: true, // Indicates if relation column value can be nullable or not.
		onDelete: 'CASCADE' // Database cascade action on delete.
	})
	@JoinColumn()
	equipment: IEquipment;

	/**
	 * The ID unique identifier of the equipment.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: EquipmentSharing) => it.equipment)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	equipmentId: ID;

	/**
	 * Equipment
	 */
	@ApiPropertyOptional({ type: () => EquipmentSharingPolicy })
	@IsOptional()
	@IsObject()
	@MultiORMManyToOne(() => EquipmentSharingPolicy, (it) => it.equipmentSharings, {
		nullable: true, // Indicates if relation column value can be nullable or not.
		onDelete: 'CASCADE' // Database cascade action on delete.
	})
	@JoinColumn()
	equipmentSharingPolicy: IEquipmentSharingPolicy;

	/**
	 * The ID unique identifier of the equipment sharing policy.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: EquipmentSharing) => it.equipmentSharingPolicy)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	equipmentSharingPolicyId: ID;

	/*
	|--------------------------------------------------------------------------
	| @ManyToMany
	|--------------------------------------------------------------------------
	*/
	/**
	 * The employees who are sharing the equipment.
	 */
	@MultiORMManyToMany(() => Employee, (it) => it.equipmentSharings, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE',
		owner: true,
		pivotTable: 'equipment_shares_employees',
		joinColumn: 'equipmentSharingId',
		inverseJoinColumn: 'employeeId'
	})
	@JoinTable({
		name: 'equipment_shares_employees'
	})
	employees?: IEmployee[];

	/**
	 * The organization teams who are sharing the equipment.
	 */
	@MultiORMManyToMany(() => OrganizationTeam, (it) => it.equipmentSharings, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE',
		owner: true,
		pivotTable: 'equipment_shares_teams',
		joinColumn: 'equipmentSharingId',
		inverseJoinColumn: 'organizationTeamId'
	})
	@JoinTable({
		name: 'equipment_shares_teams'
	})
	teams?: IOrganizationTeam[];
}
