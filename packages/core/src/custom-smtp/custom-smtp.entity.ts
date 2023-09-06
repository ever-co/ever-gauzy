import { Entity, Column } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsNumber, IsOptional, IsString } from 'class-validator';
import { Exclude, Expose } from 'class-transformer';
import { ICustomSmtp } from '@gauzy/contracts';
import { ISMTPConfig } from '@gauzy/common';
import { TenantOrganizationBaseEntity } from '../core/entities/internal';
import { IsSecret } from './../core/decorators';

@Entity('custom_smtp')
export class CustomSmtp extends TenantOrganizationBaseEntity
	implements ICustomSmtp {

	@ApiProperty({ type: () => String, examples: ['noreply@domain.com'] })
	@IsEmail()
	@Column({ nullable: true })
	fromAddress?: string

	@ApiProperty({ type: () => String, examples: ['smtp.postmarkapp.com', 'smtp.gmail.com'] })
	@IsString()
	@Column()
	host: string;

	@ApiProperty({ type: () => Number, examples: [587, 465] })
	@IsNumber()
	@Column()
	port: number;

	@ApiProperty({ type: () => Boolean, examples: [true, false] })
	@IsBoolean()
	@Column()
	secure: boolean;

	@Exclude({ toPlainOnly: true })
	@Column()
	username: string;

	@Exclude({ toPlainOnly: true })
	@Column()
	password: string;

	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsOptional()
	@IsBoolean()
	@Column({ default: false })
	isValidate?: boolean;

	/**
	 * Additional fields to expose secret fields
	 */
	@Expose({ toPlainOnly: true, name: 'username' })
	@IsSecret()
	secretKey?: string;

	@Expose({ toPlainOnly: true, name: 'password' })
	@IsSecret()
	secretPassword?: string;

	/**
	 * Get SMTP transporter configuration
	 *
	 * @returns
	 */
	getSmtpTransporter?(): ISMTPConfig {
		return {
			fromAddress: this.fromAddress,
			host: this.host,
			port: this.port,
			secure: this.secure || false, // true for 465, false for other ports
			auth: {
				user: this.username,
				pass: this.password
			}
		} as ISMTPConfig;
	}
}
