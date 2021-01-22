import {
	IEquipment,
	CurrenciesEnum,
	IEquipmentSharing,
	ITag,
	DeepPartial
} from '@gauzy/common';
import { Entity, Column, OneToMany, ManyToMany, JoinTable } from 'typeorm';
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
	TenantOrganizationBaseEntity
} from '../internal';

@Entity('equipment')
export class Equipment
	extends TenantOrganizationBaseEntity
	implements IEquipment {
	constructor(input?: DeepPartial<Equipment>) {
		super(input);
	}

	@ApiProperty()
	@ManyToMany(() => Tag, (tag) => tag.equipment)
	@JoinTable({ name: 'tag_equipment' })
	tags: ITag[];

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column()
	name: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsOptional()
	@Column()
	type: string;

	@ApiPropertyOptional({ type: String })
	@IsOptional()
	@Column()
	serialNumber?: string;

	@ApiProperty({ type: Number })
	@IsNumber()
	@IsOptional()
	@Column({ nullable: true, type: 'numeric' })
	manufacturedYear: number;

	@ApiProperty({ type: Number })
	@IsNumber()
	@IsOptional()
	@Column({ nullable: true, type: 'numeric' })
	initialCost: number;

	@ApiProperty({ type: String, enum: CurrenciesEnum })
	@IsEnum(CurrenciesEnum)
	@IsOptional()
	@Column()
	currency: string;

	@ApiProperty({ type: Number })
	@IsNumber()
	@IsOptional()
	@Column({ nullable: true, type: 'numeric' })
	maxSharePeriod: number;

	@ApiProperty({ type: Boolean })
	@IsBoolean()
	@IsOptional()
	@Column()
	autoApproveShare: boolean;

	@OneToMany(
		() => EquipmentSharing,
		(equipmentSharing) => equipmentSharing.equipment
	)
	equipmentSharings: IEquipmentSharing[];
}
