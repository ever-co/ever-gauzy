import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JoinColumn, RelationId } from 'typeorm';
import { Exclude } from 'class-transformer';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import {
	ID,
	IOrganizationTeam,
	IOrganizationTeamJoinRequest,
	IUser,
	OrganizationTeamJoinRequestStatusEnum
} from '@gauzy/contracts';
import { OrganizationTeam, TenantOrganizationBaseEntity, User } from '../core/entities/internal';
import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	VirtualMultiOrmColumn
} from './../core/decorators/entity';
import { MikroOrmOrganizationTeamJoinRequestRepository } from './repository/mikro-orm-organization-team-join-request.repository';

@MultiORMEntity('organization_team_join_request', {
	mikroOrmRepository: () => MikroOrmOrganizationTeamJoinRequestRepository
})
export class OrganizationTeamJoinRequest extends TenantOrganizationBaseEntity implements IOrganizationTeamJoinRequest {
	/**
	 * The email address associated with the user.
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsEmail()
	@MultiORMColumn()
	email: string;

	/**
	 * The full name of the user.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	fullName: string;

	/**
	 * The link address associated with the user or entity.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	linkAddress: string;

	/**
	 * The position of the user.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	position: string;

	/**
	 * The status of the organization team join request.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsEnum(OrganizationTeamJoinRequestStatusEnum)
	@MultiORMColumn({ nullable: true })
	status: OrganizationTeamJoinRequestStatusEnum;

	/**
	 * A confidential code associated with the entity.
	 */
	@Exclude({ toPlainOnly: true })
	@MultiORMColumn({ nullable: true })
	code: string;

	/**
	 * A confidential token for authentication or validation.
	 */
	@Exclude({ toPlainOnly: true })
	@MultiORMColumn({ nullable: true })
	token: string;

	/**
	 * The expiration date and time for the associated token or code.
	 */
	@Exclude({ toPlainOnly: true })
	@MultiORMColumn({ nullable: true })
	expiredAt: Date;

	/**
	 * Additional Virtual Columns
	 */
	@VirtualMultiOrmColumn()
	isExpired: boolean;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/
	/**
	 * The associated user for the organization team join request.
	 */
	@MultiORMManyToOne(() => User, {
		nullable: true, // Indicates if relation column value can be nullable or not.
		onDelete: 'CASCADE' // Database cascade action on delete.
	})
	@JoinColumn()
	user?: IUser;

	/**
	 * The unique identifier (UUID) of the associated user.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: OrganizationTeamJoinRequest) => it.user)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	userId?: ID;

	/**
	 * The organization team associated with this join request.
	 */
	@MultiORMManyToOne(() => OrganizationTeam, {
		// Database cascade action on delete
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	organizationTeam?: IOrganizationTeam;

	/**
	 * The unique identifier (UUID) for the associated organization team.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: OrganizationTeamJoinRequest) => it.organizationTeam)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	organizationTeamId?: ID;
}
