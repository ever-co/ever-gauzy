import { Entity, Index, Column, AfterLoad } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import * as moment from 'moment';
import { IPasswordReset } from '@gauzy/contracts';
import { BaseEntity } from './../core/entities/base.entity';

@Entity('password_reset')
export class PasswordReset extends BaseEntity 
	implements IPasswordReset {
	
	@ApiProperty({ type: () => String })
	@Index()
	@Column()
	email: string;

	@ApiProperty({ type: () => String })
	@Index()
	@Column()
	token: string;

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