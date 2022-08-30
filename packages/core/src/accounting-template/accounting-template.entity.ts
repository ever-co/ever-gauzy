import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, Index } from 'typeorm';
import { AccountingTemplateTypeEnum, IAccountingTemplate } from '@gauzy/contracts';
import { TenantOrganizationBaseEntity } from '../core/entities/internal';

@Entity('accounting_template')
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
	@Column()
	hbs?: string;

	@ApiProperty({ type: () => String, enum: AccountingTemplateTypeEnum })
	@Column()
	templateType?: string;
}
