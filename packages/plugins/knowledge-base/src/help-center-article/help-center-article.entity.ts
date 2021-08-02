import { Entity, Column, ManyToOne, RelationId, Index, OneToMany } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { IHelpCenter, IHelpCenterArticle, IHelpCenterAuthor } from '@gauzy/contracts';
import { TenantOrganizationBaseEntity } from '@gauzy/core';
import { HelpCenter } from './../help-center';
import { HelpCenterAuthor } from './../help-center-author';

@Entity('knowledge_base_article')
export class HelpCenterArticle
	extends TenantOrganizationBaseEntity
	implements IHelpCenterArticle {
	@ApiProperty({ type: () => String })
	@Column()
	name: string;

	@ApiProperty({ type: () => String })
	@Column()
	description: string;

	@ApiProperty({ type: () => String })
	@Column()
	data: string;

	@ApiProperty({ type: () => Boolean })
	@Column()
	draft: boolean;

	@ApiProperty({ type: () => Boolean })
	@Column()
	privacy: boolean;

	@ApiProperty({ type: () => Number })
	@Column()
	index: number;

	/*
    |--------------------------------------------------------------------------
    | @ManyToOne 
    |--------------------------------------------------------------------------
    */
	@ManyToOne(() => HelpCenter, (center) => center.articles)
	category?: IHelpCenter;

	@ApiProperty({ type: () => String })
	@RelationId((it: HelpCenterArticle) => it.category)
	@IsString()
	@Index()
	@Column()
	categoryId: string;

	/*
    |--------------------------------------------------------------------------
    | @OneToMany 
    |--------------------------------------------------------------------------
    */
	@OneToMany(() => HelpCenterAuthor, (author) => author.article)
	authors?: IHelpCenterAuthor[];
}
