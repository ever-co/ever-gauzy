import { Entity, Index, Column } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import { BaseEntity } from './../core/entities/base.entity';

@Entity('password_reset')
export class PasswordReset extends BaseEntity {
	
	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	email: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	token: string;
}
