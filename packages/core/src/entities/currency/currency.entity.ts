import { DeepPartial, ICurrency } from '@gauzy/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../internal';

@Entity('currency')
export class Currency extends BaseEntity implements ICurrency {
	constructor(input?: DeepPartial<Currency>) {
		super(input);
	}

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
