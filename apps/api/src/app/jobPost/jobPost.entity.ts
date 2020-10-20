import { Base } from '../core/entities/base';
import { Entity, Column } from 'typeorm';
import { IJobPost } from '@gauzy/models';
import { ApiProperty } from '@nestjs/swagger';

@Entity('jobPost')
export class JobPost extends Base implements IJobPost {
	@ApiProperty({ type: String })
	@Column()
	name?: string;
}
