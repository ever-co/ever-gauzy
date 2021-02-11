import { Entity, Column } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IHelpCenterAuthor } from '@gauzy/contracts';
import { TenantOrganizationBaseEntity } from '@gauzy/core';

@Entity('knowledge_base_author')
export class HelpCenterAuthor
	extends TenantOrganizationBaseEntity
	implements IHelpCenterAuthor {
	@ApiProperty({ type: () => String })
	@Column()
	employeeId: string;

	@ApiProperty({ type: () => String })
	@Column()
	articleId: string;
}
