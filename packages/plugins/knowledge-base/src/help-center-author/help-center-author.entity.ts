import { Entity, Column, ManyToOne, RelationId, Index } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { IEmployee, IHelpCenterArticle, IHelpCenterAuthor } from '@gauzy/contracts';
import { Employee, TenantOrganizationBaseEntity } from '@gauzy/core';
import { HelpCenterArticle } from './../help-center-article';

@Entity('knowledge_base_author')
export class HelpCenterAuthor
	extends TenantOrganizationBaseEntity
	implements IHelpCenterAuthor {
	/*
    |--------------------------------------------------------------------------
    | @ManyToOne 
    |--------------------------------------------------------------------------
    */
	@ManyToOne(() => Employee)
	employee: IEmployee;

	@ApiProperty({ type: () => String })
	@RelationId((it: HelpCenterAuthor) => it.employee)
	@IsString()
	@Index()
	@Column()
	employeeId: string;

	@ManyToOne(() => HelpCenterArticle, (article) => article.authors)
	article: IHelpCenterArticle;

	@ApiProperty({ type: () => String })
	@RelationId((it: HelpCenterAuthor) => it.article)
	@IsString()
	@Index()
	@Column()
	articleId: string;
}
