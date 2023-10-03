import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column, Entity, Index, JoinColumn, ManyToOne, RelationId } from 'typeorm';
import { Exclude } from 'class-transformer';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import {
	IOrganizationTeam,
	IOrganizationTeamJoinRequest,
	IUser,
	OrganizationTeamJoinRequestStatusEnum
} from '@gauzy/contracts';
import { OrganizationTeam, TenantOrganizationBaseEntity, User } from '../core/entities/internal';

@Entity('organization_team_join_request')
export class OrganizationTeamJoinRequest extends TenantOrganizationBaseEntity
	implements IOrganizationTeamJoinRequest {

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsEmail()
	@Column()
	email: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@Column({ nullable: true })
	fullName: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@Column({ nullable: true })
	linkAddress: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@Column({ nullable: true })
	position: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsEnum(OrganizationTeamJoinRequestStatusEnum)
	@Column({ nullable: true })
	status: OrganizationTeamJoinRequestStatusEnum;

	@Exclude({ toPlainOnly: true })
	@Column({ nullable: true })
	code: string;

	@Exclude({ toPlainOnly: true })
	@Column({ nullable: true })
	token: string;

	@Exclude({ toPlainOnly: true })
	@Column({ nullable: true })
	expiredAt: Date;

	/** Additional fields */
	isExpired: boolean;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * Join request belongs to user
	 */
	@ManyToOne(() => User, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	user?: IUser;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: OrganizationTeamJoinRequest) => it.user)
	@Index()
	@Column({ nullable: true })
	userId?: IUser['id'];

	/**
	 * Join request belongs to organization team
	 */
	@ManyToOne(() => OrganizationTeam, {
		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	organizationTeam?: IOrganizationTeam;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: OrganizationTeamJoinRequest) => it.organizationTeam)
	@Index()
	@Column()
	organizationTeamId?: IOrganizationTeam['id'];
}
