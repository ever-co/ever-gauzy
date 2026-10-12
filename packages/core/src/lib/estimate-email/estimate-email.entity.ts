import { IEstimateEmail } from '@gauzy/contracts';
import { isMySQL } from '@gauzy/config';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';
import { TenantOrganizationBaseEntity } from '../core/entities/internal';
import { MultiORMColumn, MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmEstimateEmailRepository } from './repository/mikro-orm-estimate-email.repository';
import { ExportRedacted } from '../export-import/export-redact.decorator';

@MultiORMEntity('estimate_email', { mikroOrmRepository: () => MikroOrmEstimateEmailRepository })
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
}
