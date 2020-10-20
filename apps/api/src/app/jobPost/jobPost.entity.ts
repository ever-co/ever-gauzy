import { Base } from '../core/entities/base';
import { Entity, Column, Unique } from 'typeorm';
import { IJobPost } from '@gauzy/models';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';

@Entity('jobPost')
export class JobPost extends Base implements IJobPost {
	@ApiProperty({ type: String })
	@Column()
	name?: string;
}
