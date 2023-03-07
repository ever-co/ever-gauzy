import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column, Entity, Index, ManyToOne, RelationId } from 'typeorm';
import { Exclude } from 'class-transformer';
import {
	IsEmail,
	IsEnum,
	IsNotEmpty,
	IsOptional,
	IsString,
	IsUUID
} from 'class-validator';
import {
	IOrganizationTeam,
	IOrganizationTeamJoinRequest,
	IUser,
	OrganizationTeamJoinRequestStatusEnum
} from '@gauzy/contracts';
import { OrganizationTeam, TenantOrganizationBaseEntity, User } from '../core/entities/internal';

@Entity('organization_team_join_request')
export class OrganizationTeamJoinRequest extends TenantOrganizationBaseEntity implements IOrganizationTeamJoinRequest {

	@ApiProperty({ type: () => String, required: true })
	@IsNotEmpty()
	@IsEmail()
	@Column()
	email: string;

	@ApiPropertyOptional({ type: () => String, required: true })
	@IsNotEmpty()
	@IsString()
	@Column({ nullable: true })
	fullName: string;

	@ApiPropertyOptional({ type: () => String, required: false })
	@IsOptional()
	@IsString()
	@Column({ nullable: true })
	linkAddress: string;

	@ApiPropertyOptional({ type: () => String, required: false })
	@IsOptional()
	@IsString()
	@Column({ nullable: true })
	position: string;

	@ApiProperty({ type: () => String, enum: OrganizationTeamJoinRequestStatusEnum })
	@IsEnum(OrganizationTeamJoinRequestStatusEnum)
	@Column({ default: OrganizationTeamJoinRequestStatusEnum.REQUESTED })
	status: OrganizationTeamJoinRequestStatusEnum;

	@ApiPropertyOptional({ type: () => Number, required: false })
	@IsOptional()
	@Exclude({ toPlainOnly: true })
	@Column({ nullable: true })
	code: number;

	@ApiPropertyOptional({ type: () => String, required: false })
	@IsOptional()
	@Exclude({ toPlainOnly: true })
	@Column({ nullable: true })
	token: string;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@Exclude({ toPlainOnly: true })
	@Column({ nullable: true })
	expireAt: Date;

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
	@ApiPropertyOptional({ type: () => User })
	@ManyToOne(() => User, {
		onDelete: "SET NULL"
	})
	user?: IUser;

	@ApiProperty({ type: () => String })
	@RelationId((it: OrganizationTeamJoinRequest) => it.user)
	@Index()
	@Column({ nullable: true })
	userId?: IUser['id'];

	/**
	 * Organization Team
	 */
	@ManyToOne(() => OrganizationTeam, {
		onDelete: 'SET NULL',
	})
	organizationTeam?: IOrganizationTeam;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: OrganizationTeamJoinRequest) => it.organizationTeam)
	@Index()
	@Column({ nullable: true })
	organizationTeamId?: IOrganizationTeam['id'];
}
