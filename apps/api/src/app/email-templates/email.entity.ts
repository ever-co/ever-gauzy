import { Entity, Index, Column } from 'typeorm';
import { Base } from '../core/entities/base';
import { EmailTemplate as IEmailTemplate } from '@gauzy/models';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

@Entity('email')
export class EmailTemplate extends Base implements IEmailTemplate {
	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	name: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	content: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	languageCode: string;
}
