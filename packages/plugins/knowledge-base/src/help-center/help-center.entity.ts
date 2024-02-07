import { Column, RelationId, Index } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { IHelpCenter, IHelpCenterArticle } from '@gauzy/contracts';
import { MultiORMEntity, TenantOrganizationBaseEntity } from '@gauzy/core';
import { HelpCenterArticle } from './../entities';
import { MikroOrmHelpCenterRepository } from './repository/mikro-orm-help-center.repository';
import { MultiORMManyToOne, MultiORMOneToMany } from '@gauzy/core';

@MultiORMEntity('knowledge_base', { mikroOrmRepository: () => MikroOrmHelpCenterRepository })
export class HelpCenter extends TenantOrganizationBaseEntity
	implements IHelpCenter {

	@ApiProperty({ type: () => String })
	@Column()
	name: string;

	@ApiProperty({ type: () => String })
	@Column()
	flag: string;

	@ApiProperty({ type: () => String })
	@Column()
	icon: string;

	@ApiProperty({ type: () => String })
	@Column()
	privacy: string;

	@ApiProperty({ type: () => String })
	@Column()
	language: string;

	@ApiProperty({ type: () => String })
	@Column()
	color: string;

	@ApiProperty({ type: () => String })
	@Column({ nullable: true })
	description?: string;

	@ApiProperty({ type: () => String })
	@Column({ nullable: true })
	data?: string;

	@ApiProperty({ type: () => Number })
	@Column({ nullable: true })
	index: number;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/
	@MultiORMManyToOne(() => HelpCenter, (children) => children.children, {
		onDelete: 'CASCADE'
	})
	parent?: IHelpCenter;

	@ApiProperty({ type: () => String })
	@RelationId((it: HelpCenter) => it.parent)
	@IsString()
	@IsOptional()
	@Index()
	@Column({ nullable: true })
	parentId?: string;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/
	@MultiORMOneToMany(() => HelpCenter, (children) => children.parent, {
		cascade: true
	})
	children?: IHelpCenter[];

	@MultiORMOneToMany(() => HelpCenterArticle, (article) => article.category, {
		cascade: true
	})
	articles?: IHelpCenterArticle[];
}
