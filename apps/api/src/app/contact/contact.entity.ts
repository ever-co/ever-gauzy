import { contactType, Contact as IContact } from '@gauzy/models';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsEmail, IsOptional } from 'class-validator';
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
	@IsOptional()
	firstName?: string;

	@ApiProperty({ type: String })
	@IsString()
	@Column({ nullable: true })
	@IsOptional()
	lastName?: string;

	@ApiProperty({ type: String })
	@IsString()
	@Column({ nullable: false })
	address: string;

	@ApiProperty({ type: String })
	@IsString()
	@Column({ nullable: true })
	contactType: contactType;

	@ApiProperty({ type: String })
	@IsEmail()
	@Column({ nullable: false })
	email: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	country?: string;
}
