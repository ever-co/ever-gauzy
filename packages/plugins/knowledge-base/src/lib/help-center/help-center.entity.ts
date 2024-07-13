import { RelationId } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { IHelpCenter, IHelpCenterArticle } from '@gauzy/contracts';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne, MultiORMOneToMany, TenantOrganizationBaseEntity } from '@gauzy/core';
import { HelpCenterArticle } from './../entities';
import { MikroOrmHelpCenterRepository } from './repository/mikro-orm-help-center.repository';

@MultiORMEntity('knowledge_base', { mikroOrmRepository: () => MikroOrmHelpCenterRepository })
export class HelpCenter extends TenantOrganizationBaseEntity
	implements IHelpCenter {

	@ApiProperty({ type: () => String })
	@MultiORMColumn()
	name: string;

	@ApiProperty({ type: () => String })
	@MultiORMColumn()
	flag: string;

	@ApiProperty({ type: () => String })
	@MultiORMColumn()
	icon: string;

	@ApiProperty({ type: () => String })
	@MultiORMColumn()
	privacy: string;

	@ApiProperty({ type: () => String })
	@MultiORMColumn()
	language: string;

	@ApiProperty({ type: () => String })
	@MultiORMColumn()
	color: string;

	@ApiProperty({ type: () => String })
	@MultiORMColumn({ nullable: true })
	description?: string;

	@ApiProperty({ type: () => String })
	@MultiORMColumn({ nullable: true })
	data?: string;

	@ApiProperty({ type: () => Number })
	@MultiORMColumn({ nullable: true })
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
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
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
