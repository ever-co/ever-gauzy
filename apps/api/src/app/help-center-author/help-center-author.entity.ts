import { Entity, Column } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IHelpCenterAuthor } from '@gauzy/models';
import { TenantOrganizationBase } from '../core/entities/tenant-organization-base';

@Entity('knowledge_base_author')
export class HelpCenterAuthor extends TenantOrganizationBase
	implements IHelpCenterAuthor {
	@ApiProperty({ type: String })
	@Column()
	employeeId: string;

	@ApiProperty({ type: String })
	@Column()
	articleId: string;
}
