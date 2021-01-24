import { Entity, Column } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IHelpCenterAuthor } from '@gauzy/contracts';
import { DeepPartial } from '@gauzy/common';
import { TenantOrganizationBaseEntity } from '../internal';

@Entity('knowledge_base_author')
export class HelpCenterAuthor
	extends TenantOrganizationBaseEntity
	implements IHelpCenterAuthor {
	constructor(input?: DeepPartial<HelpCenterAuthor>) {
		super(input);
	}

	@ApiProperty({ type: String })
	@Column()
	employeeId: string;

	@ApiProperty({ type: String })
	@Column()
	articleId: string;
}
