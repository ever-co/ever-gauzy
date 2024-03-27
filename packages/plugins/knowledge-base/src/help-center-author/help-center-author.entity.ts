import { RelationId } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { IEmployee, IHelpCenterArticle, IHelpCenterAuthor } from '@gauzy/contracts';
import { MultiORMEntity, Employee, TenantOrganizationBaseEntity, MultiORMManyToOne, ColumnIndex, MultiORMColumn } from '@gauzy/core';
import { HelpCenterArticle } from './../entities';
import { MikroOrmHelpCenterAuthorRepository } from './repository/mikro-orm-help-center-author.repository';

@MultiORMEntity('knowledge_base_author', { mikroOrmRepository: () => MikroOrmHelpCenterAuthorRepository })
export class HelpCenterAuthor extends TenantOrganizationBaseEntity implements IHelpCenterAuthor {

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/
	@ApiProperty({ type: () => Employee })
	@MultiORMManyToOne(() => Employee, {
		onDelete: 'CASCADE'
	})
	employee?: IEmployee;

	@ApiProperty({ type: () => String })
	@RelationId((it: HelpCenterAuthor) => it.employee)
	@IsString()
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	employeeId: string;

	@ApiProperty({ type: () => HelpCenterArticle })
	@MultiORMManyToOne(() => HelpCenterArticle, (article) => article.authors, {
		onDelete: 'CASCADE'
	})
	article?: IHelpCenterArticle;

	@ApiProperty({ type: () => String })
	@RelationId((it: HelpCenterAuthor) => it.article)
	@IsString()
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	articleId: string;
}
