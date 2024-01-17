import { ICountry } from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { Column, Index } from 'typeorm';
import { BaseEntity } from '../core/entities/internal';
import { Entity } from '@gauzy/common';

@Entity('country')
export class Country extends BaseEntity implements ICountry {
	@ApiProperty({ type: () => String })
	@Index()
	@IsString()
	@IsNotEmpty()
	@Column({ nullable: false })
	isoCode: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@Column({ nullable: false })
	country: string;
}
