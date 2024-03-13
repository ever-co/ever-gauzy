import { RelationId } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { IHelpCenter, IHelpCenterArticle, IHelpCenterAuthor } from '@gauzy/contracts';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne, MultiORMOneToMany, TenantOrganizationBaseEntity } from '@gauzy/core';
import { HelpCenter, HelpCenterAuthor } from './../entities';
import { MikroOrmHelpCenterArticleRepository } from './repository/mikro-orm-help-center-article.repository';

@MultiORMEntity('knowledge_base_article', { mikroOrmRepository: () => MikroOrmHelpCenterArticleRepository })
export class HelpCenterArticle extends TenantOrganizationBaseEntity
	implements IHelpCenterArticle {

	@ApiProperty({ type: () => String })
	@MultiORMColumn()
	name: string;

	@ApiProperty({ type: () => String })
	@MultiORMColumn({ nullable: true })
	description: string;

	@ApiProperty({ type: () => String })
	@MultiORMColumn({ nullable: true })
	data: string;

	@ApiProperty({ type: () => Boolean })
	@MultiORMColumn()
	draft: boolean;

	@ApiProperty({ type: () => Boolean })
	@MultiORMColumn()
	privacy: boolean;

	@ApiProperty({ type: () => Number })
	@MultiORMColumn()
	index: number;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/
	@MultiORMManyToOne(() => HelpCenter, (center) => center.articles, {
		onDelete: 'CASCADE'
	})
	category?: IHelpCenter;

	@ApiProperty({ type: () => String })
	@RelationId((it: HelpCenterArticle) => it.category)
	@IsString()
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	categoryId: string;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/
	@MultiORMOneToMany(() => HelpCenterAuthor, (author) => author.article, {
		cascade: true
	})
	authors?: IHelpCenterAuthor[];
}
