import { Entity, Column, ManyToMany, JoinTable } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Base } from '../core/entities/base';
import { IHelpCenterArticle, IHelpCenterAuthor } from '@gauzy/models';
import { HelpCenterAuthor } from '../help-center-author/help-center-author.entity';

@Entity('knowledge_base_article')
export class HelpCenterArticle extends Base implements IHelpCenterArticle {
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

	@ManyToMany(
		(type) => HelpCenterAuthor,
		(helpCenterAuthor) => helpCenterAuthor.articles
	)
	@JoinTable({
		name: 'help_center_author'
	})
	authors?: IHelpCenterAuthor[];
}
