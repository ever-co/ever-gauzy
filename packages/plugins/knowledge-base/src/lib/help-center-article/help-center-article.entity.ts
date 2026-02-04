import { JoinTable, RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';
import { ID, IEmployee, IHelpCenter, IHelpCenterArticle, IHelpCenterAuthor, IOrganizationProject, ITag } from '@gauzy/contracts';
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
import { HelpCenter, HelpCenterAuthor } from './../entities';
import { MikroOrmHelpCenterArticleRepository } from './repository/mikro-orm-help-center-article.repository';

@MultiORMEntity('knowledge_base_article', { mikroOrmRepository: () => MikroOrmHelpCenterArticleRepository })
export class HelpCenterArticle extends TenantOrganizationBaseEntity implements IHelpCenterArticle {
	/*
	|--------------------------------------------------------------------------
	| Existing fields (For original articles)
	|--------------------------------------------------------------------------
	*/
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
	@MultiORMColumn({ default: false })
	draft: boolean;

	@ApiProperty({ type: () => Boolean })
	@MultiORMColumn({ default: false })
	privacy: boolean;

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
	@MultiORMColumn({ type: 'json', nullable: true })
	descriptionJson?: object;

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

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	externalSource?: string;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne - Category (HelpCenter)
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
	| @ManyToOne - Parent-child hierarchy (self-referencing)
	|--------------------------------------------------------------------------
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

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne - Owner (Employee)
	|--------------------------------------------------------------------------
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
	| @ManyToOne - Project relation
	|--------------------------------------------------------------------------
	*/
	@MultiORMManyToOne(() => OrganizationProject, {
		nullable: true,
		onDelete: 'CASCADE'
	})
	project?: IOrganizationProject;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: HelpCenterArticle) => it.project)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	projectId?: ID;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany - Children articles
	|--------------------------------------------------------------------------
	*/
	@MultiORMOneToMany(() => HelpCenterArticle, (article) => article.parent)
	children?: IHelpCenterArticle[];

	/*
	|--------------------------------------------------------------------------
	| @OneToMany - Authors
	|--------------------------------------------------------------------------
	*/
	@MultiORMOneToMany(() => HelpCenterAuthor, (author) => author.article, {
		cascade: true
	})
	authors?: IHelpCenterAuthor[];

	/*
	|--------------------------------------------------------------------------
	| @ManyToMany - Tags
	|--------------------------------------------------------------------------
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
		joinColumn: 'helpCenterArticleId',
		/** Column in pivot table referencing 'tag' primary key. */
		inverseJoinColumn: 'tagId'
	})
	@JoinTable({ name: 'tag_help_center_article' })
	tags?: ITag[];
}

