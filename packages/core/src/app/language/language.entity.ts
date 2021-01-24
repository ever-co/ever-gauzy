import { Entity, Column, Unique } from 'typeorm';
import { ILanguage } from '@gauzy/contracts';
import { DeepPartial } from '@gauzy/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { BaseEntity } from '../core/entities/internal';

@Entity('language')
@Unique(['name'])
export class Language extends BaseEntity implements ILanguage {
	constructor(input?: DeepPartial<Language>) {
		super(input);
	}

	@ApiProperty({ type: String })
	@Column()
	name?: string;

	@ApiProperty({ type: String })
	@Column({ nullable: true })
	@IsOptional()
	code?: string;

	@ApiProperty({ type: Boolean, default: false })
	@Column({ default: true, nullable: true })
	@IsOptional()
	is_system?: boolean;

	@ApiProperty({ type: String })
	@Column()
	description?: string;

	@ApiProperty({ type: String })
	@Column()
	color?: string;
}
