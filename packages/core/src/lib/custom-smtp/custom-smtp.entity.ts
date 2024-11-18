import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsNumber, IsOptional, IsString } from 'class-validator';
import { Exclude, Expose } from 'class-transformer';
import { ICustomSmtp } from '@gauzy/contracts';
import { ISMTPConfig } from '@gauzy/common';
import { TenantOrganizationBaseEntity } from '../core/entities/internal';
import { IsSecret } from './../core/decorators';
import { MultiORMColumn, MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmCustomSmtpRepository } from './repository/mikro-orm-custom-smtp.repository';

@MultiORMEntity('custom_smtp', { mikroOrmRepository: () => MikroOrmCustomSmtpRepository })
export class CustomSmtp extends TenantOrganizationBaseEntity
	implements ICustomSmtp {

	@ApiProperty({ type: () => String, examples: ['noreply@domain.com'] })
	@IsEmail()
	@MultiORMColumn({ nullable: true })
	fromAddress?: string

	@ApiProperty({ type: () => String, examples: ['smtp.postmarkapp.com', 'smtp.gmail.com'] })
	@IsString()
	@MultiORMColumn()
	host: string;

	@ApiProperty({ type: () => Number, examples: [587, 465] })
	@IsNumber()
	@MultiORMColumn()
	port: number;

	@ApiProperty({ type: () => Boolean, examples: [true, false] })
	@IsBoolean()
	@MultiORMColumn()
	secure: boolean;

	@Exclude({ toPlainOnly: true })
	@MultiORMColumn()
	username: string;

	@Exclude({ toPlainOnly: true })
	@MultiORMColumn()
	password: string;

	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ default: false })
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
