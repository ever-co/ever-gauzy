import {
	Entity,
	Index,
	Column,
	JoinColumn,
	RelationId,
	ManyToOne
} from 'typeorm';
import { IUser, IUserOrganization } from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import { TenantOrganizationBaseEntity, User } from '../core/entities/internal';

@Entity('user_organization')
export class UserOrganization
	extends TenantOrganizationBaseEntity
	implements IUserOrganization {
	
	@ApiProperty({ type: () => Boolean, default: true })
	@Index()
	@Column({ default: true })
	isDefault: boolean;

	@ApiProperty({ type: () => Boolean, default: true })
	@Index()
	@Column({ default: true })
	isActive: boolean;

	/*
    |--------------------------------------------------------------------------
    | @ManyToOne 
    |--------------------------------------------------------------------------
    */

	/**
	 * User
	 */
	@ApiProperty({ type: () => User })
	@ManyToOne(() => User, (user) => user.organizations, {
		nullable: true,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	user?: IUser;

	@ApiProperty({ type: () => String })
	@RelationId((it: UserOrganization) => it.user)
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	userId: string;
}
