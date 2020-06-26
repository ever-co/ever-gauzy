import {
	Column,
	Entity
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber } from 'class-validator';
import { Base } from '../core/entities/base';
import { Contacts as IContacts } from '../../../../../libs/models/src/lib/contacts.model';

@Entity('contact')
export class Contacts extends Base implements IContacts {
	@ApiProperty({ type: String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	name?: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	firstName?: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	lastName?: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	country?: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	street?: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	city?: string;

	@ApiPropertyOptional({ type: Number })
	@IsNumber()
	@IsOptional()
	@Column({ nullable: true })
	zipCode?: number;

	@ApiPropertyOptional({ type: String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	state?: string;

}
