import { ApiProperty } from '@nestjs/swagger';
import { IEmailTemplate } from '@gauzy/contracts';
import { isMySQL } from "@gauzy/config";
import { TenantOrganizationBaseEntity } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, VirtualMultiOrmColumn } from './../core/decorators/entity';
import { MikroOrmEmailTemplateRepository } from './repository/mikro-orm-email-template.repository';

@MultiORMEntity('email_template', { mikroOrmRepository: () => MikroOrmEmailTemplateRepository })
export class EmailTemplate extends TenantOrganizationBaseEntity
	implements IEmailTemplate {

	@ApiProperty({ type: () => String })
	@ColumnIndex()
	@MultiORMColumn()
	name: string;

	@ApiProperty({ type: () => String })
	@ColumnIndex()
	@MultiORMColumn()
	languageCode: string;

	@ApiProperty({ type: () => String })
	@MultiORMColumn({ type: 'text', nullable: true })
	mjml: string;

	@ApiProperty({ type: () => String })
	@MultiORMColumn({ ...(isMySQL() ? { type: "longtext" } : {}) })
	hbs: string;

	/** Additional virtual columns */
	@VirtualMultiOrmColumn()
	title?: string;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/
}
