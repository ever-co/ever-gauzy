import { JoinTable, RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ID, IEmployee, IHelpCenter, IHelpCenterArticle, IHelpCenterArticleVersion, IHelpCenterAuthor, IOrganizationProject, ITag, JsonData } from '@gauzy/contracts';
import { isMySQL, isPostgres } from '@gauzy/config';
import {
	ColumnIndex,
	Employee,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToMany,
	MultiORMManyToOne,
	MultiORMOneToMany,
	OrganizationProject,
	Tag,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { HelpCenter, HelpCenterArticleVersion, HelpCenterAuthor } from './../entities';
import { MikroOrmHelpCenterArticleRepository } from './repository/mikro-orm-help-center-article.repository';

@MultiORMEntity('knowledge_base_article', { mikroOrmRepository: () => MikroOrmHelpCenterArticleRepository })
export class HelpCenterArticle extends TenantOrganizationBaseEntity implements IHelpCenterArticle {
	/*
	|--------------------------------------------------------------------------
	| Existing fields (For original articles)
	|--------------------------------------------------------------------------
	*/
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MultiORMColumn()
	name: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	description?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	data?: string;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ default: false })
	draft?: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ default: false })
	privacy?: boolean;

	@ApiProperty({ type: () => Number })
	@MultiORMColumn()
	index: number;

	/*
	|--------------------------------------------------------------------------
	| Rich content for collaborative articles
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

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@MultiORMColumn({ type: isPostgres() ? 'bytea' : isMySQL() ? 'longblob' : 'blob', nullable: true })
	descriptionBinary?: Uint8Array;

	/*
	|--------------------------------------------------------------------------
	| Metadata
	|--------------------------------------------------------------------------
	*/
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ default: false })
	isLocked?: boolean;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	color?: string;

	/*
	|--------------------------------------------------------------------------
	| External integration
	|--------------------------------------------------------------------------
	*/
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	externalId?: string;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * Category (HelpCenter)
	*/
	@MultiORMManyToOne(() => HelpCenter, (center) => center.articles, {
		onDelete: 'CASCADE'
	})
	category?: IHelpCenter;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@RelationId((it: HelpCenterArticle) => it.category)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	categoryId: ID;

	/**
	 * Parent-child hierarchy (self-referencing)
	*/
	@MultiORMManyToOne(() => HelpCenterArticle, (article) => article.children, {
		nullable: true,
		onDelete: 'CASCADE'
	})
	parent?: IHelpCenterArticle;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: HelpCenterArticle) => it.parent)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	parentId?: ID;

	/**
	 * Owner (Employee)
	*/
	@MultiORMManyToOne(() => Employee, {
		nullable: true,
		onDelete: 'SET NULL'
	})
	ownedBy?: IEmployee;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: HelpCenterArticle) => it.ownedBy)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	ownedById?: ID;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/
	/**
	 * Children articles
	*/
	@MultiORMOneToMany(() => HelpCenterArticle, (article) => article.parent)
	children?: IHelpCenterArticle[];

	/**
	 * Authors
	*/
	@MultiORMOneToMany(() => HelpCenterAuthor, (author) => author.article, {
		cascade: true
	})
	authors?: IHelpCenterAuthor[];

	/**
	 * Versions
	*/
	@MultiORMOneToMany(() => HelpCenterArticleVersion, (version) => version.article, {
		cascade: true
	})
	versions?: IHelpCenterArticleVersion[];

	/*
	|--------------------------------------------------------------------------
	| @ManyToMany
	|--------------------------------------------------------------------------
	*/

	/**
	 * Projects
	*/
	@MultiORMManyToMany(() => OrganizationProject, {
		/**  Database cascade action on update. */
		onUpdate: 'CASCADE',
		/** Database cascade action on delete. */
		onDelete: 'CASCADE',
		/** This column is a boolean flag indicating whether the current entity is the 'owning' side of a relationship.  */
		owner: true,
		/** Pivot table for many-to-many relationship. */
		pivotTable: 'knowledge_base_article_project',
		/** Column in pivot table referencing 'help_center_article' primary key. */
		joinColumn: 'knowledgeBaseArticleId',
		/** Column in pivot table referencing 'project' primary key. */
		inverseJoinColumn: 'organizationProjectId'
	})
	@JoinTable({ name: 'knowledge_base_article_project' })
	@ApiPropertyOptional({ type: () => Array, isArray: true })
	@IsOptional()
	@IsArray()
	projects?: IOrganizationProject[];

	/**
	 * Tags
	*/
	@MultiORMManyToMany(() => Tag, {
		/**  Database cascade action on update. */
		onUpdate: 'CASCADE',
		/** Database cascade action on delete. */
		onDelete: 'CASCADE',
		/** This column is a boolean flag indicating whether the current entity is the 'owning' side of a relationship.  */
		owner: true,
		/** Pivot table for many-to-many relationship. */
		pivotTable: 'tag_help_center_article',
		/** Column in pivot table referencing 'help_center_article' primary key. */
		joinColumn: 'knowledgeBaseArticleId',
		/** Column in pivot table referencing 'tag' primary key. */
		inverseJoinColumn: 'tagId'
	})
	@JoinTable({ name: 'tag_help_center_article' })
	@ApiPropertyOptional({ type: () => Array, isArray: true })
	@IsOptional()
	@IsArray()
	tags?: ITag[];
}
