import { Column, ManyToOne, RelationId, Index } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { IEmployee, IHelpCenterArticle, IHelpCenterAuthor } from '@gauzy/contracts';
import { MultiORMEntity, Employee, TenantOrganizationBaseEntity } from '@gauzy/core';
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
	@ManyToOne(() => Employee, {
		onDelete: 'CASCADE'
	})
	employee?: IEmployee;

	@ApiProperty({ type: () => String })
	@RelationId((it: HelpCenterAuthor) => it.employee)
	@IsString()
	@Index()
	@Column()
	employeeId: string;

	@ApiProperty({ type: () => HelpCenterArticle })
	@ManyToOne(() => HelpCenterArticle, (article) => article.authors, {
		onDelete: 'CASCADE'
	})
	article?: IHelpCenterArticle;

	@ApiProperty({ type: () => String })
	@RelationId((it: HelpCenterAuthor) => it.article)
	@IsString()
	@Index()
	@Column()
	articleId: string;
}
