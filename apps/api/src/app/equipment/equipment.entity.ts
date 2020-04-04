import { Equipment as IEquipment, CurrenciesEnum } from '@gauzy/models';
import { Entity, Column, OneToMany } from 'typeorm';
import { Base } from '../core/entities/base';
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

@Entity('equipment')
export class Equipment extends Base implements IEquipment {
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
