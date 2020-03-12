import { Equipment as IEquipment, CurrenciesEnum } from '@gauzy/models';
import { Entity, Column } from 'typeorm';
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

@Entity('equipment')
export class Equipment extends Base implements IEquipment {
	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column()
	name: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column()
	type: string;

	@ApiPropertyOptional({ type: String })
	@IsOptional()
	@Column()
	serialNumber?: string;

	@ApiProperty({ type: Number })
	@IsNumber()
	@IsNotEmpty()
	@Column({ type: 'numeric' })
	manufacturedYear: number;

	@ApiProperty({ type: Number })
	@IsNumber()
	@IsNotEmpty()
	@Column({ type: 'numeric' })
	initialCost: number;

	@ApiProperty({ type: String, enum: CurrenciesEnum })
	@IsEnum(CurrenciesEnum)
	@IsNotEmpty()
	@Column()
	currency: string;

	@ApiProperty({ type: Number })
	@IsNumber()
	@IsNotEmpty()
	@Column({ nullable: true, type: 'numeric' })
	maxSharePeriod: number;

	@ApiProperty({ type: Boolean })
	@IsBoolean()
	@IsNotEmpty()
	@Column()
	autoApproveShare: boolean;
}
