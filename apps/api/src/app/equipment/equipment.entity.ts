import { Equipment as IEquipment, CurrenciesEnum } from '@gauzy/models';
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
import { EquipmentSharing } from '../equipment-sharing/equipment-sharing.entity';
import { Tag } from '../tags/tag.entity';
import { TenantBase } from '../core/entities/tenant-base';

@Entity('equipment')
export class Equipment extends TenantBase implements IEquipment {
	@ApiProperty()
	@ManyToMany((type) => Tag, (tag) => tag.equipment)
	@JoinTable({ name: 'tag_equipment' })
	tags: Tag[];

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
		(type) => EquipmentSharing,
		(equipmentSharing) => equipmentSharing.equipment
	)
	equipmentSharings: EquipmentSharing[];
}
