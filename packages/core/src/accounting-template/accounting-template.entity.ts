import { ApiProperty } from '@nestjs/swagger';
import { Column, Index } from 'typeorm';
import { AccountingTemplateTypeEnum, IAccountingTemplate } from '@gauzy/contracts';
import { isMySQL } from '@gauzy/config';
import { TenantOrganizationBaseEntity } from '../core/entities/internal';
import { MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmAccountingTemplateRepository } from './repository/mikro-orm-accounting-template.repository';

@MultiORMEntity('accounting_template', { mikroOrmRepository: () => MikroOrmAccountingTemplateRepository })
export class AccountingTemplate extends TenantOrganizationBaseEntity
	implements IAccountingTemplate {

	@ApiProperty({ type: () => String })
	@Index()
	@Column()
	name?: string;

	@ApiProperty({ type: () => String })
	@Index()
	@Column()
	languageCode?: string;

	@ApiProperty({ type: () => String })
	@Column({ type: 'text', nullable: true })
	mjml?: string;

	@ApiProperty({ type: () => String })
	@Column({ ...(isMySQL() ? { type: "longtext" } : {}) })
	hbs?: string;

	@ApiProperty({ type: () => String, enum: AccountingTemplateTypeEnum })
	@Column()
	templateType?: string;
}
