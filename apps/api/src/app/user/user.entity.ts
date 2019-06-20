import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  UpdateDateColumn,
} from 'typeorm';
import { ApiModelProperty } from '@nestjs/swagger';
import { IsAscii, IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { Base } from '../core/entities/base';
import { User as IUser } from '@gauzy/models';

@Entity('user')
export class User extends Base implements IUser {
  @ApiModelProperty({ type: String })
  @IsString()
  @IsNotEmpty()
  @Index()
  @Column()
  firstName: string;

  @ApiModelProperty({ type: String })
  @IsString()
  @IsNotEmpty()
  @Index()
  @Column()
  lastName: string;

  @ApiModelProperty({ type: String, minLength: 10, maxLength: 100 })
  @IsEmail()
  @IsNotEmpty()
  @Index()
  @Column()
  email: string;

  @ApiModelProperty({ type: String, minLength: 8, maxLength: 20 })
  @IsAscii()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(20)
  @Index({ unique: true })
  @Column()
  username: string;

  @ApiModelProperty({ type: 'string', format: 'date-time', example: '2018-11-21T06:20:32.232Z' })
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt?: Date;

  @ApiModelProperty({ type: 'string', format: 'date-time', example: '2018-11-21T06:20:32.232Z' })
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt?: Date;
}
