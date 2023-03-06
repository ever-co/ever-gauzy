import { Entity, Index, Column, AfterLoad, ManyToOne, JoinColumn, RelationId } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import * as moment from 'moment';
import { IEmailReset, IUser } from '@gauzy/contracts';
import { BaseEntity } from './../core/entities/base.entity';
import { User } from 'core';

@Entity('email_reset')
export class EmailReset extends BaseEntity 
	implements IEmailReset {
    deletedAt?: Date;
	
	@ApiProperty({ type: () => String })
	@Index()
	@Column()
	oldEmail: string;

    @ApiProperty({ type: () => String })
	@Index()
	@Column()
	newEmail: string;

	@ApiProperty({ type: () => String })
	@Index()
	@Column()
	token: string;

    @ApiProperty({ type: () => Number })
	@Index()
	@Column()
	code: number;

	expired?: boolean;

    /**
	 * User
	 */
	@ManyToOne(() => User, (user) => user.teams, {
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
