// Modified code from https://github.com/xmlking/ngx-starter-kit.
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

import { ApiPropertyOptional } from '@nestjs/swagger';
import {
	Column,
	Index,
	JoinColumn,
	RelationId,
	JoinTable,
	OneToMany
} from 'typeorm';
import { Property } from '@mikro-orm/core';
import { Exclude } from 'class-transformer';
import { IsEmail, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import {
	IUser,
	IRole,
	LanguagesEnum,
	ComponentLayoutStyleEnum,
	ITag,
	IEmployee,
	IUserOrganization,
	IInvite,
	IOrganizationTeam,
	ICandidate,
	IImageAsset
} from '@gauzy/contracts';
import {
	Candidate,
	Employee,
	ImageAsset,
	Invite,
	OrganizationTeam,
	Role,
	Tag,
	TenantBaseEntity,
	UserOrganization
} from '../core/entities/internal';
import { MultiORMEntity } from './../core/decorators/entity';
import { MikroManyToOne } from './../core/decorators/entity/relations/mikro-orm';
import { TypeManyToOne } from './../core/decorators/entity/relations/type-orm';
import { MikroOrmUserRepository } from './repository/mikro-orm-user.repository';
import { MultiORMManyToMany, MultiORMManyToOne, MultiORMOneToMany, MultiORMOneToOne } from './../core/decorators/entity/relations';

@MultiORMEntity('user', { mikroOrmRepository: () => MikroOrmUserRepository })
export class User extends TenantBaseEntity implements IUser {

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@Index()
	@Column({ nullable: true })
	@Property({ nullable: true })
	thirdPartyId?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@Index()
	@Column({ nullable: true })
	@Property({ nullable: true })
	firstName?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@Index()
	@Column({ nullable: true })
	@Property({ nullable: true })
	lastName?: string;

	@ApiPropertyOptional({ type: () => String, minLength: 3, maxLength: 100 })
	@IsOptional()
	@IsEmail()
	@Index({ unique: false })
	@Column({ nullable: true })
	@Property({ nullable: true })
	email?: string;

	@ApiPropertyOptional({ type: () => String, minLength: 4, maxLength: 12 })
	@IsOptional()
	@IsString()
	@Index()
	@Column({ nullable: true })
	@Property({ nullable: true })
	phoneNumber?: string;

	@ApiPropertyOptional({ type: () => String, minLength: 3, maxLength: 20 })
	@IsOptional()
	@IsString()
	@Index({ unique: false })
	@Column({ nullable: true })
	@Property({ nullable: true })
	username?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@Column({ nullable: true })
	@Property({ nullable: true })
	timeZone?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@Exclude({ toPlainOnly: true })
	@Column({ nullable: true })
	@Property({ nullable: true })
	hash?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@Exclude({ toPlainOnly: true })
	@Column({ insert: false, nullable: true })
	@Property({ nullable: true })
	public refreshToken?: string;

	@ApiPropertyOptional({ type: () => String, maxLength: 500 })
	@IsOptional()
	@IsString()
	@Column({ length: 500, nullable: true })
	@Property({ nullable: true })
	imageUrl?: string;

	@ApiPropertyOptional({ type: () => String, enum: LanguagesEnum })
	@IsOptional()
	@IsEnum(LanguagesEnum)
	@Column({ nullable: true, default: LanguagesEnum.ENGLISH })
	@Property({ nullable: true })
	preferredLanguage?: string;

	@ApiPropertyOptional({ type: () => String, enum: ComponentLayoutStyleEnum })
	@IsOptional()
	@IsEnum(ComponentLayoutStyleEnum)
	@Column({
		type: 'simple-enum',
		nullable: true,
		default: ComponentLayoutStyleEnum.TABLE,
		enum: ComponentLayoutStyleEnum
	})
	@Property({ nullable: true })
	preferredComponentLayout?: ComponentLayoutStyleEnum;


	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@Exclude({ toPlainOnly: true })
	@Column({ insert: false, nullable: true })
	@Property({ default: false, nullable: true })
	public code?: string;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@Exclude({ toPlainOnly: true })
	@Column({ insert: false, nullable: true })
	@Property({ default: false, nullable: true })
	public codeExpireAt?: Date;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@Exclude({ toPlainOnly: true })
	@Column({ insert: false, nullable: true })
	@Property({ default: false, nullable: true })
	public emailVerifiedAt?: Date;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@Exclude({ toPlainOnly: true })
	@Column({ insert: false, nullable: true })
	@Property({ default: false, nullable: true })
	public emailToken?: string;

	name?: string;
	employeeId?: string;
	isEmailVerified?: boolean;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * Role
	 */
	@MikroManyToOne(() => Role, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		deleteRule: 'set null'
	})
	@TypeManyToOne(() => Role, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'SET NULL',
	})
	@JoinColumn()
	role?: IRole;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: User) => it.role)
	@Index()
	@Column({ nullable: true })
	@Property({ nullable: true })
	roleId?: string;

	/**
	 * ImageAsset
	 */
	@MultiORMManyToOne(() => ImageAsset, {
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
	@Index()
	@Column({ nullable: true })
	@Property({ nullable: true })
	imageId?: IImageAsset['id'];

	/*
	|--------------------------------------------------------------------------
	| @OneToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * Employee
	 */
	@MultiORMOneToOne(() => Employee, (employee: Employee) => employee.user)
	employee?: IEmployee;

	/**
	 * Candidate
	 */
	@MultiORMOneToOne(() => Candidate, (candidate: Candidate) => candidate.user)
	candidate?: ICandidate;

	/*
	|--------------------------------------------------------------------------
	| @ManyToMany
	|--------------------------------------------------------------------------
	*/
	// Tags
	@MultiORMManyToMany(() => Tag, (tag) => tag.users, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE'
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
	@OneToMany(() => Invite, (it) => it.user)
	invites?: IInvite[];

	/**
	 * User belongs to teams
	 */
	@MultiORMOneToMany(() => OrganizationTeam, (it) => it.createdBy, {
		onDelete: 'CASCADE'
	})
	teams?: IOrganizationTeam[];
}
