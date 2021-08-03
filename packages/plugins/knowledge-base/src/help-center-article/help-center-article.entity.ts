import { Entity, Column, ManyToOne, RelationId, Index, OneToMany } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { IHelpCenter, IHelpCenterArticle, IHelpCenterAuthor } from '@gauzy/contracts';
import { TenantOrganizationBaseEntity } from '@gauzy/core';
import { HelpCenter, HelpCenterAuthor } from './../entities';

@Entity('knowledge_base_article')
export class HelpCenterArticle
	extends TenantOrganizationBaseEntity
	implements IHelpCenterArticle {
	@ApiProperty({ type: () => String })
	@Column()
	name: string;

	@ApiProperty({ type: () => String })
	@Column({ nullable: true })
	description: string;

	@ApiProperty({ type: () => String })
	@Column({ nullable: true })
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
	@ManyToOne(() => HelpCenter, (center) => center.articles, {
		onDelete: 'CASCADE'
	})
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
	@OneToMany(() => HelpCenterAuthor, (author) => author.article, {
		cascade: true
	})
	authors?: IHelpCenterAuthor[];
}