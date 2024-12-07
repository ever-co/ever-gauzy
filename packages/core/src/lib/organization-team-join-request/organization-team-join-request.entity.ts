import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JoinColumn, RelationId } from 'typeorm';
import { Exclude } from 'class-transformer';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import {
	IOrganizationTeam,
	IOrganizationTeamJoinRequest,
	IUser,
	OrganizationTeamJoinRequestStatusEnum
} from '@gauzy/contracts';
import { OrganizationTeam, TenantOrganizationBaseEntity, User } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne, VirtualMultiOrmColumn } from './../core/decorators/entity';
import { MikroOrmOrganizationTeamJoinRequestRepository } from './repository/mikro-orm-organization-team-join-request.repository';

@MultiORMEntity('organization_team_join_request', { mikroOrmRepository: () => MikroOrmOrganizationTeamJoinRequestRepository })
export class OrganizationTeamJoinRequest extends TenantOrganizationBaseEntity
	implements IOrganizationTeamJoinRequest {

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsEmail()
	@MultiORMColumn()
	email: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	fullName: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	linkAddress: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	position: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsEnum(OrganizationTeamJoinRequestStatusEnum)
	@MultiORMColumn({ nullable: true })
	status: OrganizationTeamJoinRequestStatusEnum;

	@Exclude({ toPlainOnly: true })
	@MultiORMColumn({ nullable: true })
	code: string;

	@Exclude({ toPlainOnly: true })
	@MultiORMColumn({ nullable: true })
	token: string;

	@Exclude({ toPlainOnly: true })
	@MultiORMColumn({ nullable: true })
	expiredAt: Date;

	/** Additional virtual columns */
	@VirtualMultiOrmColumn()
	isExpired: boolean;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * Join request belongs to user
	 */
	@MultiORMManyToOne(() => User, {
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
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	userId?: IUser['id'];

	/**
	 * Join request belongs to organization team
	 */
	@MultiORMManyToOne(() => OrganizationTeam, {
		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	organizationTeam?: IOrganizationTeam;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: OrganizationTeamJoinRequest) => it.organizationTeam)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	organizationTeamId?: IOrganizationTeam['id'];
}
