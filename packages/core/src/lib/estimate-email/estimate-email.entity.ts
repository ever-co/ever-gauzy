import { ID, IEstimateEmail } from '@gauzy/contracts';
import { isMySQL } from '@gauzy/config';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { TenantOrganizationBaseEntity } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmEstimateEmailRepository } from './repository/mikro-orm-estimate-email.repository';
import { ExportRedacted } from '../export-import/export-redact.decorator';

/**
 * One email of an estimate or an invoice: where it went, and the token of its links. An invoice's email also records,
 * once the mail transport took it, which invoice it delivered and in which language (`invoiceId`, `languageCode`): the
 * payment reminders of that invoice go to the same address, in the same language.
 */
@MultiORMEntity('estimate_email', { mikroOrmRepository: () => MikroOrmEstimateEmailRepository })
@ColumnIndex('IDX_estimate_email_invoice', ['invoiceId'])
export class EstimateEmail extends TenantOrganizationBaseEntity implements IEstimateEmail {
	/**
	 * Bearer token for the public estimate view; signed with the application JWT secret.
	 *
	 * Never serialised: the public `/estimate-email/validate` response returned it, handing the
	 * bearer credential for accepting / rejecting the estimate to whoever could read the row
	 * (GHSA-28wv-vrxj-rp4q). The mailer reads it in-process only.
	 */
	@Exclude({ toPlainOnly: true })
	@ExportRedacted()
	@ApiProperty({ type: () => String })
	@MultiORMColumn({
		...(isMySQL() ? { type: 'text' } : {})
	})
	token?: string;

	@ApiProperty({ type: () => String })
	@MultiORMColumn()
	email?: string;

	@ApiProperty({ type: () => Date })
	@MultiORMColumn()
	expireDate?: Date;

	@ApiPropertyOptional({ type: () => Boolean })
	@MultiORMColumn({ nullable: true })
	convertAcceptedEstimates?: boolean;

	/**
	 * The invoice this email delivered, recorded once the mail transport took it; unset for an estimate's email and for
	 * one that did not go. A plain column, as the row's other fields: the row records an email that went, whatever
	 * becomes of the invoice since.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ type: 'uuid', nullable: true })
	invoiceId?: ID;

	/** The language the invoice was emailed in, recorded with `invoiceId`. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	languageCode?: string;
}
