import { IEstimateEmail } from '@gauzy/contracts';
import { isMySQL } from '@gauzy/config';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TenantOrganizationBaseEntity } from '../core/entities/internal';
import { MultiORMColumn, MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmEstimateEmailRepository } from './repository/mikro-orm-estimate-email.repository';

@MultiORMEntity('estimate_email', { mikroOrmRepository: () => MikroOrmEstimateEmailRepository })
export class EstimateEmail extends TenantOrganizationBaseEntity
	implements IEstimateEmail {

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
