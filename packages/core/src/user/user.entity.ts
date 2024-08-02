// Modified code from https://github.com/xmlking/ngx-starter-kit.
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

import { ApiPropertyOptional } from '@nestjs/swagger';
import { JoinColumn, RelationId, JoinTable } from 'typeorm';
import { EntityRepositoryType } from '@mikro-orm/core';
import { Exclude } from 'class-transformer';
import { IsEmail, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import {
	IUser,
	IRole,
	LanguagesEnum,
	ComponentLayoutStyleEnum,
	ITag,
	IUserOrganization,
	IInvite,
	IImageAsset,
	TimeFormatEnum,
	ISocialAccount,
	IOrganizationTeam
} from '@gauzy/contracts';
import {
	ImageAsset,
	Invite,
	OrganizationTeam,
	Role,
	SocialAccount,
	Tag,
	TenantBaseEntity,
	UserOrganization
} from '../core/entities/internal';
import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToMany,
	MultiORMManyToOne,
	MultiORMOneToMany,
	VirtualMultiOrmColumn
} from './../core/decorators/entity';
import { MikroOrmUserRepository } from './repository/mikro-orm-user.repository';

@MultiORMEntity('user', { mikroOrmRepository: () => MikroOrmUserRepository })
export class User extends TenantBaseEntity implements IUser {
	[EntityRepositoryType]?: MikroOrmUserRepository;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	thirdPartyId?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	firstName?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	lastName?: string;

	@ApiPropertyOptional({ type: () => String, minLength: 3, maxLength: 100 })
	@IsOptional()
	@IsEmail()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	email?: string;

	@ApiPropertyOptional({ type: () => String, minLength: 4, maxLength: 12 })
	@IsOptional()
	@IsString()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	phoneNumber?: string;

	@ApiPropertyOptional({ type: () => String, minLength: 3, maxLength: 20 })
	@IsOptional()
	@IsString()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	username?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	timeZone?: string;

	@ApiPropertyOptional({ type: () => String, enum: TimeFormatEnum })
	@IsOptional()
	@IsEnum(TimeFormatEnum)
	@MultiORMColumn({
		type: 'simple-enum',
		enum: TimeFormatEnum,
		default: TimeFormatEnum.FORMAT_12_HOURS
	})
	timeFormat?: TimeFormatEnum;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@Exclude({ toPlainOnly: true })
	@MultiORMColumn({ nullable: true })
	hash?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@Exclude({ toPlainOnly: true })
	@MultiORMColumn({ insert: false, nullable: true })
	refreshToken?: string;

	@ApiPropertyOptional({ type: () => String, maxLength: 500 })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ length: 500, nullable: true })
	imageUrl?: string;

	@ApiPropertyOptional({ type: () => String, enum: LanguagesEnum })
	@IsOptional()
	@IsEnum(LanguagesEnum)
	@MultiORMColumn({ nullable: true, default: LanguagesEnum.ENGLISH })
	preferredLanguage?: string;

	@ApiPropertyOptional({ type: () => String, enum: ComponentLayoutStyleEnum })
	@IsOptional()
	@IsEnum(ComponentLayoutStyleEnum)
	@MultiORMColumn({
		type: 'simple-enum',
		nullable: true,
		default: ComponentLayoutStyleEnum.TABLE,
		enum: ComponentLayoutStyleEnum
	})
	preferredComponentLayout?: ComponentLayoutStyleEnum;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@Exclude({ toPlainOnly: true })
	@MultiORMColumn({ insert: false, nullable: true })
	code?: string;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@Exclude({ toPlainOnly: true })
	@MultiORMColumn({ insert: false, nullable: true })
	codeExpireAt?: Date;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@Exclude({ toPlainOnly: true })
	@MultiORMColumn({ insert: false, nullable: true })
	emailVerifiedAt?: Date;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@Exclude({ toPlainOnly: true })
	@MultiORMColumn({ insert: false, nullable: true })
	emailToken?: string;

	/** Additional virtual columns */
	@VirtualMultiOrmColumn()
	name?: string;

	@VirtualMultiOrmColumn()
	isEmailVerified?: boolean;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * Role
	 */
	@MultiORMManyToOne(() => Role, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	role?: IRole;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: User) => it.role)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	roleId?: string;

	/**
	 * ImageAsset
	 */
	@MultiORMManyToOne(() => ImageAsset, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'SET NULL',

		/** Eager relations are always loaded automatically when relation's owner entity is loaded using find* methods. */
		eager: true
	})
	@JoinColumn()
	image?: IImageAsset;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: User) => it.image)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	imageId?: IImageAsset['id'];

	/**
	 * Default Team
	 */
	@MultiORMManyToOne(() => OrganizationTeam, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	defaultTeam?: IOrganizationTeam;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: User) => it.defaultTeam)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	defaultTeamId?: IOrganizationTeam['id'];

	/*
	|--------------------------------------------------------------------------
	| @ManyToMany
	|--------------------------------------------------------------------------
	*/
	// Tags
	@MultiORMManyToMany(() => Tag, (tag) => tag.users, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE',
		owner: true,
		pivotTable: 'tag_user',
		joinColumn: 'userId',
		inverseJoinColumn: 'tagId'
	})
	@JoinTable({
		name: 'tag_user'
	})
	tags?: ITag[];

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/

	/**
	 * UserOrganization
	 */
	@MultiORMOneToMany(() => UserOrganization, (it) => it.user, {
		cascade: true
	})
	@JoinColumn()
	organizations?: IUserOrganization[];

	/**
	 * User belongs to invites
	 */
	@MultiORMOneToMany(() => Invite, (it) => it.user)
	invites?: IInvite[];

	/**
	 * User social accounts
	 */
	@MultiORMOneToMany(() => SocialAccount, (it) => it.user)
	socialAccounts?: ISocialAccount[];
}
