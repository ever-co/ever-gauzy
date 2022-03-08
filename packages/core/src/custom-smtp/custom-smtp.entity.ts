import { Entity, Column, AfterLoad } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { ICustomSmtp } from '@gauzy/contracts';
import { ISMTPConfig } from '@gauzy/common';
import { Exclude, Expose } from 'class-transformer';
import { IsNotEmpty } from 'class-validator';
import { TenantOrganizationBaseEntity } from '../core/entities/internal';
import { IsSecret, WrapSecrets } from './../core/decorators';

@Entity('custom_smtp')
export class CustomSmtp
	extends TenantOrganizationBaseEntity
	implements ICustomSmtp {
	@ApiProperty({ type: () => String })
	@Column()
	host: string;

	@ApiProperty({ type: () => Number })
	@Column()
	port: number;

	@ApiProperty({ type: () => Boolean })
	@Column()
	secure: boolean;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@Exclude({ toPlainOnly: true })
	@Column()
	username: string;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@Exclude({ toPlainOnly: true })
	@Column()
	password: string;

	@ApiProperty({ type: () => Boolean, default: false })
	@Column({ default: false })
	isValidate?: boolean;

	@ApiProperty({ type: () => String })
	@Expose({ toPlainOnly: true, name: 'username' })
	@IsSecret()
	secretKey?: string;

	@ApiProperty({ type: () => String })
	@Expose({ toPlainOnly: true, name: 'password' })
	@IsSecret()
	secretPassword?: string;

	/**
    * Called after entity is loaded.
    */
	@AfterLoad()
	afterLoadEntity?() {
		this.secretKey = this.username;
		this.secretPassword = this.password;
		WrapSecrets(this, this);
	}

	getSmtpTransporter?() {
		return {
			host: this.host,
			port: this.port,
			secure: this.secure || false, // true for 465, false for other ports
			auth: {
				user: this.username,
				pass: this.password
			}
		} as ISMTPConfig
	}
}
