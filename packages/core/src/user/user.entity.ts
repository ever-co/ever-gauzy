// Modified code from https://github.com/xmlking/ngx-starter-kit.
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta
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
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';
import { IsEmail, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import {
	Column,
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	RelationId,
	ManyToMany,
	JoinTable,
	OneToOne,
	OneToMany
} from 'typeorm';
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

@Entity('user')
export class User extends TenantBaseEntity implements IUser {

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@Index()
	@Column({ nullable: true })
	thirdPartyId?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@Index()
	@Column({ nullable: true })
	firstName?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@Index()
	@Column({ nullable: true })
	lastName?: string;

	@ApiPropertyOptional({ type: () => String, minLength: 3, maxLength: 100 })
	@IsOptional()
	@IsEmail()
	@Index({ unique: false })
	@Column({ nullable: true })
	email?: string;

	@ApiPropertyOptional({ type: () => String, minLength: 4, maxLength: 12 })
	@IsOptional()
	@IsString()
	@Index()
	@Column({ nullable: true })
	phoneNumber?: string;

	@ApiPropertyOptional({ type: () => String, minLength: 3, maxLength: 20 })
	@IsOptional()
	@IsString()
	@Index({ unique: false })
	@Column({ nullable: true })
	username?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@Column({ nullable: true })
	timeZone?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@Exclude({ toPlainOnly: true })
	@Column({ nullable: true })
	hash?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@Exclude({ toPlainOnly: true })
	@Column({ insert: false, nullable: true })
	public refreshToken?: string;

	@ApiPropertyOptional({ type: () => String, maxLength: 500 })
	@IsOptional()
	@IsString()
	@Column({ length: 500, nullable: true })
	imageUrl?: string;

	@ApiPropertyOptional({ type: () => String, enum: LanguagesEnum })
	@IsOptional()
	@IsEnum(LanguagesEnum)
	@Column({ nullable: true, default: LanguagesEnum.ENGLISH })
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
	preferredComponentLayout?: ComponentLayoutStyleEnum;


	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@Exclude({ toPlainOnly: true })
	@Column({ insert: false, nullable: true })
	public code?: string;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@Exclude({ toPlainOnly: true })
	@Column({ insert: false, nullable: true })
	public codeExpireAt?: Date;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@Exclude({ toPlainOnly: true })
	@Column({ insert: false, nullable: true })
	public emailVerifiedAt?: Date;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@Exclude({ toPlainOnly: true })
	@Column({ insert: false, nullable: true })
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
	@ManyToOne(() => Role, {
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
	roleId?: string;

	/**
	 * ImageAsset
	 */
	@ManyToOne(() => ImageAsset, {
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
	imageId?: IImageAsset['id'];

	/*
	|--------------------------------------------------------------------------
	| @OneToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * Employee
	 */
	@OneToOne(() => Employee, (employee: Employee) => employee.user)
	employee?: IEmployee;

	/**
	 * Candidate
	 */
	@OneToOne(() => Candidate, (candidate: Candidate) => candidate.user)
	candidate?: ICandidate;

	/*
	|--------------------------------------------------------------------------
	| @ManyToMany
	|--------------------------------------------------------------------------
	*/
	// Tags
	@ManyToMany(() => Tag, (tag) => tag.users, {
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
	@OneToMany(() => UserOrganization, (it) => it.user, {
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
	@OneToMany(() => OrganizationTeam, (it) => it.createdBy, {
		onDelete: 'CASCADE'
	})
	teams?: IOrganizationTeam[];
}
