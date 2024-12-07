import {
	IEquipment,
	CurrenciesEnum,
	IEquipmentSharing,
	ITag,
	IImageAsset
} from '@gauzy/contracts';
import {
	JoinTable,
	JoinColumn
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsString,
	IsNotEmpty,
	IsOptional,
	IsNumber,
	IsEnum,
	IsBoolean
} from 'class-validator';
import {
	EquipmentSharing,
	Tag,
	TenantOrganizationBaseEntity,
	ImageAsset
} from '../core/entities/internal';
import { ColumnNumericTransformerPipe } from './../shared/pipes';
import { MultiORMColumn, MultiORMEntity, MultiORMManyToMany, MultiORMManyToOne, MultiORMOneToMany } from './../core/decorators/entity';
import { MikroOrmEquipmentRepository } from './repository/mikro-orm-equipment.repository';

@MultiORMEntity('equipment', { mikroOrmRepository: () => MikroOrmEquipmentRepository })
export class Equipment extends TenantOrganizationBaseEntity implements IEquipment {

	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@MultiORMColumn()
	name: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@IsOptional()
	@MultiORMColumn()
	type: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@MultiORMColumn()
	serialNumber?: string;

	@ApiProperty({ type: () => Number })
	@IsNumber()
	@IsOptional()
	@MultiORMColumn({
		nullable: true,
		type: 'numeric',
		transformer: new ColumnNumericTransformerPipe()
	})
	manufacturedYear: number;

	@ApiProperty({ type: () => Number })
	@IsNumber()
	@IsOptional()
	@MultiORMColumn({
		nullable: true,
		type: 'numeric',
		transformer: new ColumnNumericTransformerPipe()
	})
	initialCost: number;

	@ApiProperty({ type: () => String, enum: CurrenciesEnum })
	@IsEnum(CurrenciesEnum)
	@IsOptional()
	@MultiORMColumn()
	currency: string;

	@ApiProperty({ type: () => Number })
	@IsNumber()
	@IsOptional()
	@MultiORMColumn({
		nullable: true,
		type: 'numeric',
		transformer: new ColumnNumericTransformerPipe()
	})
	maxSharePeriod: number;

	@ApiProperty({ type: () => Boolean })
	@IsBoolean()
	@IsOptional()
	@MultiORMColumn()
	autoApproveShare: boolean;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * ImageAsset
	 */
	@ApiProperty({ type: () => ImageAsset })
	@MultiORMManyToOne(() => ImageAsset, (imageAsset) => imageAsset.equipmentImage, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	image: IImageAsset;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/

	/**
	 * EquipmentSharing
	 */
	@ApiProperty({ type: () => EquipmentSharing, isArray: true })
	@MultiORMOneToMany(() => EquipmentSharing, (equipmentSharing) => equipmentSharing.equipment, {
		onDelete: 'CASCADE'
	})
	equipmentSharings: IEquipmentSharing[];

	/*
	|--------------------------------------------------------------------------
	| @ManyToMany
	|--------------------------------------------------------------------------
	*/

	@ApiProperty({ type: () => Tag, isArray: true })
	@MultiORMManyToMany(() => Tag, (tag) => tag.equipments, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE',
		owner: true,
		pivotTable: 'tag_equipment',
		joinColumn: 'equipmentId',
		inverseJoinColumn: 'tagId',
	})
	@JoinTable({ name: 'tag_equipment' })
	tags: ITag[];
}
