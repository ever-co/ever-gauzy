import { Entity, Column } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Base } from '../core/entities/base';
import { IHelpCenterAuthor } from '@gauzy/models';

@Entity('knowledge_base_author')
export class HelpCenterAuthor extends Base implements IHelpCenterAuthor {
	@ApiProperty({ type: String })
	@Column()
	employeeId: string;

	@ApiProperty({ type: String })
	@Column()
	articleId: string;
}
