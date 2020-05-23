import { ContactType, Contact as IContact } from '@gauzy/models';
import { ApiProperty } from '@nestjs/swagger';
import {
	IsNotEmpty,
	IsString,
	IsEmail,
	IsOptional,
	IsEnum
} from 'class-validator';
import { Column, Entity, Index } from 'typeorm';
import { Base } from '../core/entities/base';
@Entity('contact')
export class Contact extends Base implements IContact {
	@ApiProperty({ type: String })
	@Index()
	@IsString()
	@Column({ nullable: true })
	@IsOptional()
	businessName?: string;

	@ApiProperty({ type: String })
	@IsString()
	@Column({ nullable: true })
	firstName?: string;

	@ApiProperty({ type: String })
	@IsString()
	@Column({ nullable: true })
	lastName?: string;

	@ApiProperty({ type: String })
	@IsString()
	@Column({ nullable: false })
	address: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsEnum(ContactType)
	@Column({ nullable: false, default: ContactType.Client })
	contactType: string;

	@ApiProperty({ type: String })
	@IsString()
	@Column({ nullable: false })
	primaryEmail: string;

	@ApiProperty({ type: String })
	@IsString()
	@Column({ nullable: false })
	primaryPhone: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	country?: string;
}
