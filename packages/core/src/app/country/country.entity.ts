import { ICountry } from '@gauzy/contracts';
import { DeepPartial } from '@gauzy/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../core/entities/internal';

@Entity('country')
export class Country extends BaseEntity implements ICountry {
	constructor(input?: DeepPartial<Country>) {
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
	country: string;
}
