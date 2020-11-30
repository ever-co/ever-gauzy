import { ICurrency } from '@gauzy/models';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { Column, Entity, Index } from 'typeorm';
import { Base } from '../core/entities/base';

@Entity('currency')
export class Currency extends Base implements ICurrency {
	@ApiProperty({ type: String })
	@Index()
	@IsString()
	@IsNotEmpty()
	@Column({ nullable: false })
	isoCode: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column({ nullable: false })
	currency: string;
}
