import { Entity, Index, Column, AfterLoad } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import * as moment from 'moment';
import { IsEmail, IsNotEmpty } from 'class-validator';
import { IEmailReset } from '@gauzy/contracts';
import { TenantBaseEntity } from '../core/entities/internal';

@Entity('email_reset')
export class EmailReset extends TenantBaseEntity
	implements IEmailReset {

	@ApiProperty({ type: () => String, required: true })
	@IsEmail()
	@Index()
	@Column()
	email: string;

	@ApiProperty({ type: () => String, required: true })
	@IsNotEmpty()
	@Index()
	@Column()
	token: string;

	@ApiProperty({ type: () => Number, required: true })
	@IsNotEmpty()
	@Index()
	@Column()
	code: number;

	expired?: boolean;

	/**
	* Called after entity is loaded.
	*/
	@AfterLoad()
	afterLoadEntity?() {
		const createdAt = moment(this.createdAt, 'YYYY-MM-DD HH:mm:ss');
		const expiredAt = moment(moment(), 'YYYY-MM-DD HH:mm:ss');
		this.expired = expiredAt.diff(createdAt, 'minutes') > 10;
	}
}
