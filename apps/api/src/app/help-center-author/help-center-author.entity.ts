import { Entity, Column, RelationId } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IHelpCenterAuthor } from '@gauzy/models';
import { TenantBase } from '../core/entities/tenant-base';
import { IsString } from 'class-validator';

@Entity('knowledge_base_author')
export class HelpCenterAuthor extends TenantBase implements IHelpCenterAuthor {
	@ApiProperty({ type: String })
	@Column()
	employeeId: string;

	@ApiProperty({ type: String })
	@Column()
	articleId: string;

	@ApiProperty({ type: String })
	@Column()
	organization: string;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId(
		(helpCenterAuthor: HelpCenterAuthor) => helpCenterAuthor.organization
	)
	@IsString()
	@Column({ nullable: true })
	organizationId: string;
}
