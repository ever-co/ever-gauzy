import { Entity, Column, ManyToMany, JoinTable } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Base } from '../core/entities/base';
import { IHelpCenterAuthor, IHelpCenterArticle } from '@gauzy/models';
import { HelpCenterArticle } from '../help-center-article/help-center-article.entity';

@Entity('knowledge_base_author')
export class HelpCenterAuthor extends Base implements IHelpCenterAuthor {
	@ApiProperty({ type: String })
	@Column()
	employeeId: string;

	@ApiProperty({ type: String })
	@Column()
	articleId: string;

	@ManyToMany(
		(type) => HelpCenterArticle,
		(helpCenterArticle) => helpCenterArticle.authors
	)
	@JoinTable({
		name: 'help_center_author'
	})
	articles: IHelpCenterArticle[];
}
