import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsObject, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { RelationId, JoinTable, JoinColumn, VersionColumn } from 'typeorm';
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
import { MikroOrmVersionProperty } from './../concurrency/mikro-orm-version-property.decorator';
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

	/**
	 * The row's optimistic-concurrency version: 1 when the sharing is filed, and moved on by every write — TypeORM's
	 * update and save increment a `@VersionColumn` themselves, and `CrudService.update` does it in the statement under
	 * MikroORM.
	 *
	 * Two authorized editors who read the same sharing and both write it back used to interleave column by column
	 * (`save()` writes only the columns that differ from what it loaded; ever-co/ever-gauzy#11359). An edit is now a
	 * compare-and-set on the version it is based on — the one the body states, else the one the server read — and is
	 * refused with 409 `ENTITY_VERSION_CONFLICT` when the stored row has moved on. Stating it is optional, so a client
	 * that never sends it keeps working.
	 */
	@ApiPropertyOptional({
		type: () => Number,
		description: 'Optimistic-concurrency version: the edit is refused (409) when the stored row has moved on',
		example: 1
	})
	@IsOptional()
	@IsInt()
	@Min(1)
	// Default 1, as the migration declares it (`integer NOT NULL DEFAULT 1`), so a schema built from the entities
	// accepts a row inserted without a version too
	@VersionColumn({ default: 1 })
	@MikroOrmVersionProperty()
	version?: number;

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
