import { Entity, Index, Column, AfterLoad, ManyToOne, JoinColumn, RelationId } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import * as moment from 'moment';
import { IsEmail, IsNotEmpty } from 'class-validator';
import { IEmailReset, IUser } from '@gauzy/contracts';
import { TenantBaseEntity, User } from '../core/entities/internal';

@Entity('email_reset')
export class EmailReset extends TenantBaseEntity
	implements IEmailReset {

	@ApiProperty({ type: () => String, required: true })
	@IsEmail()
	@Index()
	@Column()
	email: string;

	@ApiProperty({ type: () => String, required: true })
	@IsEmail()
	@Index()
	@Column()
	oldEmail: string;

	@ApiProperty({ type: () => Number, required: true })
	@IsNotEmpty()
	@Index()
	@Column()
	code: number;

	expired?: boolean;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * User
	 */
	@ManyToOne(() => User, (user) => user.emailReset, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	user?: IUser;

	@RelationId((it: EmailReset) => it.user)
	@Index()
	@Column({ nullable: true })
	userId?: IUser['id'];

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
