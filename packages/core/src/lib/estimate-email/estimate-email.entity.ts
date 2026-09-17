import { IEstimateEmail } from '@gauzy/contracts';
import { isMySQL } from '@gauzy/config';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TenantOrganizationBaseEntity } from '../core/entities/internal';
import { MultiORMColumn, MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmEstimateEmailRepository } from './repository/mikro-orm-estimate-email.repository';
import { ExportRedacted } from '../export-import/export-redact.decorator';

@MultiORMEntity('estimate_email', { mikroOrmRepository: () => MikroOrmEstimateEmailRepository })
export class EstimateEmail extends TenantOrganizationBaseEntity implements IEstimateEmail {
	/** Bearer token for the public estimate view; signed with the application JWT secret. */
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
