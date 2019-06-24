// Modified code from https://github.com/xmlking/ngx-starter-kit. 
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

import {
  Column,
  Entity,
  Index,
  ManyToOne,
  RelationId,
  JoinColumn,
} from 'typeorm';
import { ApiModelProperty } from '@nestjs/swagger';
import { IsAscii, IsEmail, IsNotEmpty, IsString, MaxLength, MinLength, IsOptional } from 'class-validator';
import { Base } from '../core/entities/base';
import { User as IUser } from '@gauzy/models';
import { Role } from '../role';

@Entity('user')
export class User extends Base implements IUser {
  @ApiModelProperty({ type: String })
  @IsString()
  @Index()
  @IsOptional()
  @Column({ nullable: true })
  firstName?: string;

  @ApiModelProperty({ type: String })
  @IsString()
  @Index()
  @IsOptional()
  @Column({ nullable: true })
  lastName?: string;

  @ApiModelProperty({ type: String, minLength: 3, maxLength: 100 })
  @IsEmail()
  @IsNotEmpty()
  @Index()
  @Column()
  email: string;

  @ApiModelProperty({ type: String, minLength: 3, maxLength: 20 })
  @IsAscii()
  @MinLength(3)
  @MaxLength(20)
  @Index({ unique: true })
  @IsOptional()
  @Column({ nullable: true })
  username?: string;

  @ApiModelProperty({ type: Role })
  @ManyToOne(type => Role, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn()
  role?: Role;

  @ApiModelProperty({ type: String, readOnly: true })
  @RelationId((user: User) => user.role)
  readonly roleId?: string;
}
