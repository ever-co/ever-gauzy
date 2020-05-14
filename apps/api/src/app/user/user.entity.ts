// Modified code from https://github.com/xmlking/ngx-starter-kit.
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

import { User as IUser, LanguagesEnum } from '@gauzy/models';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsAscii,
	IsEmail,
	IsNotEmpty,
	IsOptional,
	IsString,
	MaxLength,
	MinLength,
	IsEnum
} from 'class-validator';
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
	AfterLoad
} from 'typeorm';
import { Base } from '../core/entities/base';
import { Role } from '../role/role.entity';
import { Tenant } from '../tenant/tenant.entity';
import { Tag } from '../tags/tag.entity';
import { Employee } from '../employee/employee.entity';

@Entity('user')
export class User extends Base implements IUser {
	@ManyToMany(() => Tag)
	@JoinTable({
		name: 'tag_user'
	})
	tags: Tag[];

	@ApiProperty({ type: Tenant })
	@ManyToOne(() => Tenant, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn()
	tenant: Tenant;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((user: User) => user.tenant)
	readonly tenantId?: string;

	@ApiPropertyOptional({ type: String })
	@IsString()
	@Index()
	@IsOptional()
	@Column({ nullable: true })
	thirdPartyId?: string;

	@ApiPropertyOptional({ type: String })
	@IsString()
	@Index()
	@IsOptional()
	@Column({ nullable: true })
	firstName?: string;

	@ApiPropertyOptional({ type: String })
	@IsString()
	@Index()
	@IsOptional()
	@Column({ nullable: true })
	lastName?: string;

	@ApiProperty({ type: String, minLength: 3, maxLength: 100 })
	@IsEmail()
	@IsNotEmpty()
	@Index({ unique: true })
	@IsOptional()
	@Column({ nullable: true })
	email?: string;

	@ApiPropertyOptional({ type: String, minLength: 3, maxLength: 20 })
	@IsAscii()
	@MinLength(3)
	@MaxLength(20)
	@Index({ unique: true })
	@IsOptional()
	@Column({ nullable: true })
	username?: string;

	@OneToOne('Employee', (employee: Employee) => employee.user)
	employee?: Employee;

	@ApiPropertyOptional({ type: Role })
	@ManyToOne(() => Role, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn()
	role?: Role;

	@ApiPropertyOptional({ type: String, readOnly: true })
	@RelationId((user: User) => user.role)
	readonly roleId?: string;

	@ApiProperty({ type: String })
	@IsString()
	@Column()
	@IsOptional()
	@Column({ nullable: true })
	hash?: string;

	@ApiPropertyOptional({ type: String, maxLength: 500 })
	@IsOptional()
	@Column({ length: 500, nullable: true })
	imageUrl?: string;

	@ApiProperty({ type: String, enum: LanguagesEnum })
	@IsEnum(LanguagesEnum)
	@Column({ nullable: true })
	preferredLanguage?: string;
	
	name: string;
	@AfterLoad()
	getDuration() {
		const name = this.firstName + ' ' + this.lastName;
		this.name = name;
	}
}
