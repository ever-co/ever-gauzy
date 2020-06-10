import { Base } from '../core/entities/base';
import { Entity, Column, Unique } from 'typeorm';
import { Language as ILanguage } from '@gauzy/models';
import { ApiProperty } from '@nestjs/swagger';

@Entity('language')
@Unique(['name'])
export class Language extends Base implements ILanguage {
	@ApiProperty({ type: String })
	@Column()
	name?: string;

	@ApiProperty({ type: String })
	@Column()
	description?: string;

	@ApiProperty({ type: String })
	@Column()
	color?: string;
}
