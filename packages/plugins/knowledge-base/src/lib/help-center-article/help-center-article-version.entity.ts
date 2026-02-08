import { RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { ID, IEmployee, IHelpCenterArticle, IHelpCenterArticleVersion, JsonData } from '@gauzy/contracts';
import { isMySQL, isPostgres } from '@gauzy/config';
import {
    ColumnIndex,
    Employee,
    MultiORMColumn,
    MultiORMEntity,
    MultiORMManyToOne,
    TenantOrganizationBaseEntity
} from '@gauzy/core';
import { HelpCenterArticle } from './help-center-article.entity';
import { MikroOrmHelpCenterArticleVersionRepository } from './repository/mikro-orm-help-center-article-version.repository';

@MultiORMEntity('knowledge_base_article_version', { mikroOrmRepository: () => MikroOrmHelpCenterArticleVersionRepository })
export class HelpCenterArticleVersion extends TenantOrganizationBaseEntity implements IHelpCenterArticleVersion {
	/*
	|--------------------------------------------------------------------------
	| Content snapshot
	|--------------------------------------------------------------------------
	*/
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'text', nullable: true })
	descriptionHtml?: string;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@MultiORMColumn({ type: isPostgres() ? 'jsonb' : isMySQL() ? 'json' : 'text', nullable: true })
	descriptionJson?: JsonData;

	/** 
	 * When this version was saved 
	*/
	@ApiProperty({ type: () => Date })
	@Type(() => Date)
	@IsNotEmpty()
	@IsDate()
	@MultiORMColumn()
	lastSavedAt: Date;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/** 
	 * Article relation 
	*/
	@MultiORMManyToOne(() => HelpCenterArticle, (article) => article.versions, {
		onDelete: 'CASCADE'
	})
	article?: IHelpCenterArticle;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: HelpCenterArticleVersion) => it.article)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	articleId: ID;

	/** 
	 * Owner (who created this version) 
	*/
	@MultiORMManyToOne(() => Employee, {
		nullable: true,
		onDelete: 'SET NULL'
	})
	ownedBy?: IEmployee;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: HelpCenterArticleVersion) => it.ownedBy)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	ownedById?: ID;
}
