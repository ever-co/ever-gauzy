import { Entity, Column, RelationId } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Base } from '../core/entities/base';
import { IHelpCenterArticle } from '@gauzy/models';
import { TenantBase } from '../core/entities/tenant-base';
import { IsString } from 'class-validator';

@Entity('knowledge_base_article')
export class HelpCenterArticle extends TenantBase
	implements IHelpCenterArticle {
	@ApiProperty({ type: String })
	@Column()
	name: string;

	@ApiProperty({ type: String })
	@Column()
	description: string;

	@ApiProperty({ type: String })
	@Column()
	data: string;

	@ApiProperty({ type: String })
	@Column()
	categoryId: string;

	@ApiProperty({ type: Boolean })
	@Column()
	draft: boolean;

	@ApiProperty({ type: Boolean })
	@Column()
	privacy: boolean;

	@ApiProperty({ type: Number })
	@Column()
	index: number;

	@ApiProperty({ type: String })
	@Column()
	organization: string;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId(
		(helpCenterArticle: HelpCenterArticle) => helpCenterArticle.organization
	)
	@IsString()
	@Column({ nullable: true })
	organizationId: string;
}
